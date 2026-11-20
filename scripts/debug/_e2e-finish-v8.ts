/**
 * Poll Vault 8 until deadline, then hints → end → reveal → settle → close peek → finalize.
 */
import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAuthToken,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../../target/idl/blind_vault.json";
import { associatedTokenAddress } from "../lib/ata";
import {
  contentsPda,
  hintsPda,
  housePda,
  itemPda,
  poolPda,
  solanaProvider,
  TEE_RPC,
} from "../lib/env";

function statusName(status: unknown): string {
  if (status && typeof status === "object") {
    return Object.keys(status as object)[0] ?? "?";
  }
  return String(status);
}

async function main() {
  const { program, wallet, connection } = solanaProvider();
  const house = housePda();
  const houseAcct = await (program.account as any).house.fetch(house);
  const vaultPk = houseAcct.activeVault as PublicKey;
  const scripMint = houseAcct.scripMint as PublicKey;
  const treasury = houseAcct.treasury as PublicKey;
  if (vaultPk.equals(PublicKey.default)) throw new Error("no active vault");

  const hints = hintsPda(vaultPk);
  const contents = contentsPda(vaultPk);
  const poolLedger = poolPda(house);
  const bid = PublicKey.findProgramAddressSync(
    [Buffer.from("bid"), vaultPk.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId,
  )[0];
  const peek = PublicKey.findProgramAddressSync(
    [Buffer.from("peek"), vaultPk.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId,
  )[0];
  const winnerAta = associatedTokenAddress(scripMint, wallet.publicKey);
  // House treasury ATA is often unwritable on TEE — operator ATA sink (Vault 5 pattern).
  const operatorTreasury = associatedTokenAddress(scripMint, wallet.publicKey);

  const { token } = await getAuthToken(
    TEE_RPC,
    wallet.publicKey,
    async (msg) => nacl.sign.detached(msg, wallet.secretKey),
  );
  const tee = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");
  const teeProgram = new Program(
    idl as Idl,
    new AnchorProvider(tee, new Wallet(wallet), { commitment: "confirmed" }),
  );

  for (;;) {
    const vault = await (teeProgram.account as any).vault.fetch(vaultPk);
    const st = statusName(vault.status);
    const now = Math.floor(Date.now() / 1000);
    const left = Number(vault.deadlineTs) - now;
    console.log(
      `[e2e] status=${st} left=${left}s bids=${vault.bidCount} peeks=${vault.peeksSold} closedBids=${vault.closedBidCount} closedPeeks=${vault.closedPeekCount}`,
    );

    if (st === "open") {
      const hintsAcct = await (teeProgram.account as any).vaultHints.fetch(
        hints,
      );
      for (let i = 0; i < 4; i++) {
        if (hintsAcct.hints[i].released) continue;
        if (now < Number(vault.hintTimes[i])) continue;
        try {
          const sig = await (teeProgram.methods as any)
            .publishHint(i)
            .accounts({ vault: vaultPk, hints, contents, poolLedger })
            .rpc();
          console.log("publish_hint", i, sig);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          console.log("publish_hint skip", i, msg.slice(0, 100));
        }
      }
      if (left <= 0) {
        const sig = await (teeProgram.methods as any)
          .endAuction()
          .accounts({ vault: vaultPk })
          .remainingAccounts([
            { pubkey: bid, isWritable: false, isSigner: false },
          ])
          .rpc();
        console.log("end_auction", sig);
      } else {
        await new Promise((r) =>
          setTimeout(r, Math.min(20_000, Math.max(3000, left * 1000))),
        );
      }
      continue;
    }

    if (st === "ended" || st === "abandoned") {
      const sig = await (teeProgram.methods as any)
        .revealContents()
        .accounts({
          vault: vaultPk,
          contents,
          poolLedger,
          contentsPermission: permissionPdaFromAccount(contents),
          ephemeralVault: EPHEMERAL_VAULT_ID,
          magicProgram: MAGIC_PROGRAM_ID,
          permissionProgram: PERMISSION_PROGRAM_ID,
        })
        .rpc();
      console.log("reveal_contents", sig);
      continue;
    }

    if (st === "revealed") {
      const v = await (teeProgram.account as any).vault.fetch(vaultPk);
      if (!v.abandoned && Number(v.closedBidCount) < Number(v.bidCount)) {
        const settle = await (teeProgram.methods as any)
          .settleWinningBid()
          .accounts({
            lot: vaultPk,
            bid,
            bidPermission: permissionPdaFromAccount(bid),
            escrow: winnerAta,
            treasury: operatorTreasury,
            permissionProgram: PERMISSION_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();
        console.log("settle_winning_bid", settle);
        continue;
      }

      if (Number(v.closedPeekCount) < Number(v.peeksSold)) {
        const closePeek = await (teeProgram.methods as any)
          .closePeek()
          .accounts({
            buyer: wallet.publicKey,
            lot: vaultPk,
            peek,
            peekPermission: permissionPdaFromAccount(peek),
            ephemeralVault: EPHEMERAL_VAULT_ID,
            magicProgram: MAGIC_PROGRAM_ID,
            permissionProgram: PERMISSION_PROGRAM_ID,
          })
          .rpc();
        console.log("close_peek", closePeek);
        continue;
      }

      const close = await (teeProgram.methods as any)
        .closeRound()
        .accounts({
          payer: wallet.publicKey,
          vault: vaultPk,
          hints,
          contents,
          poolLedger,
          contentsPermission: permissionPdaFromAccount(contents),
          poolPermission: permissionPdaFromAccount(poolLedger),
          ephemeralVault: EPHEMERAL_VAULT_ID,
          permissionProgram: PERMISSION_PROGRAM_ID,
        })
        .rpc();
      console.log("close_round", close);
      continue;
    }

    if (st === "closed") break;

    await new Promise((r) => setTimeout(r, 5000));
  }

  console.log("waiting undelegate…");
  for (let i = 0; i < 90; i++) {
    const info = await connection.getAccountInfo(vaultPk);
    if (info && info.owner.equals(program.programId)) {
      console.log("undelegated after", i * 2, "s");
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  const vaultSol = await (program.account as any).vault.fetch(vaultPk);
  const contentsSol = await (program.account as any).vaultContents.fetch(
    contents,
  );
  const len = Number(contentsSol.len);
  const indices: number[] = [];
  for (let i = 0; i < len; i++) {
    indices.push(Number(contentsSol.items[i]));
  }
  console.log("items", indices, "winner", vaultSol.winner.toBase58());

  if (indices.length > 0) {
    const rel = await (teeProgram.methods as any)
      .releasePoolItems(indices)
      .accounts({
        authority: wallet.publicKey,
        house,
        poolLedger,
      })
      .rpc();
    console.log("release_pool_items", rel);
  }

  const remaining: {
    pubkey: PublicKey;
    isWritable: boolean;
    isSigner: boolean;
  }[] = [];
  for (const idx of indices) {
    const item = itemPda(idx);
    const itemAcct = await (program.account as any).item.fetch(item);
    const mint = itemAcct.mint as PublicKey;
    const poolAta = associatedTokenAddress(mint, house, true);
    const winnerItemAta = associatedTokenAddress(
      mint,
      vaultSol.winner as PublicKey,
    );
    if (!(await connection.getAccountInfo(winnerItemAta))) {
      const ix = {
        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: winnerItemAta, isSigner: false, isWritable: true },
          {
            pubkey: vaultSol.winner as PublicKey,
            isSigner: false,
            isWritable: false,
          },
          { pubkey: mint, isSigner: false, isWritable: false },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.alloc(0),
      };
      const tx = new Transaction().add(ix as never);
      await (program.provider as AnchorProvider).sendAndConfirm(tx);
      console.log("create winner ATA", mint.toBase58().slice(0, 8));
    }
    remaining.push(
      { pubkey: item, isWritable: true, isSigner: false },
      { pubkey: poolAta, isWritable: true, isSigner: false },
      { pubkey: winnerItemAta, isWritable: true, isSigner: false },
    );
  }

  const fin = await (program.methods as any)
    .finalize()
    .accounts({
      house,
      vault: vaultPk,
      contents,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(remaining)
    .rpc();
  console.log("finalize", fin);
  console.log("E2E Vault 8 COMPLETE");
}

main().catch((e) => {
  console.error("FAIL", e.message?.slice?.(0, 500) ?? e);
  if (e.getLogs) e.getLogs().then((l: string[]) => console.error(l?.slice(-25)));
  process.exit(1);
});
