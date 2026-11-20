/**
 * Vault 8: settle (Model A winner ATA + operator treasury sink) → close peek → close → finalize.
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

async function main() {
  const { program, wallet, connection } = solanaProvider();
  const house = housePda();
  const h = await (program.account as any).house.fetch(house);
  const vaultPk = h.activeVault as PublicKey;
  const mint = h.scripMint as PublicKey;
  const hints = hintsPda(vaultPk);
  const contents = contentsPda(vaultPk);
  const poolLedger = poolPda(house);

  const { token } = await getAuthToken(
    TEE_RPC,
    wallet.publicKey,
    async (m) => nacl.sign.detached(m, wallet.secretKey),
  );
  const tee = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");
  const teeProgram = new Program(
    idl as Idl,
    new AnchorProvider(tee, new Wallet(wallet), { commitment: "confirmed" }),
  );

  let vault = await (teeProgram.account as any).vault.fetch(vaultPk);
  const bid = PublicKey.findProgramAddressSync(
    [Buffer.from("bid"), vaultPk.toBuffer(), vault.winner.toBuffer()],
    program.programId,
  )[0];
  const peek = PublicKey.findProgramAddressSync(
    [Buffer.from("peek"), vaultPk.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId,
  )[0];
  const winnerAta = associatedTokenAddress(mint, vault.winner);
  // House treasury ATA is often unwritable on TEE — use operator ATA as sink (Vault 5 pattern).
  const operatorTreasury = associatedTokenAddress(mint, wallet.publicKey);

  console.log("start", {
    status: Object.keys(vault.status)[0],
    closedBids: vault.closedBidCount,
    bids: vault.bidCount,
    closedPeeks: vault.closedPeekCount,
    peeks: vault.peeksSold,
  });

  if (Number(vault.closedBidCount) < Number(vault.bidCount)) {
    const sig = await (teeProgram.methods as any)
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
    console.log("settle_winning_bid", sig);
  }

  vault = await (teeProgram.account as any).vault.fetch(vaultPk);
  if (Number(vault.closedPeekCount) < Number(vault.peeksSold)) {
    const sig = await (teeProgram.methods as any)
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
    console.log("close_peek", sig);
  }

  vault = await (teeProgram.account as any).vault.fetch(vaultPk);
  console.log("pre-close", {
    closedBids: vault.closedBidCount,
    bids: vault.bidCount,
    closedPeeks: vault.closedPeekCount,
    peeks: vault.peeksSold,
  });

  if (
    Number(vault.closedBidCount) === Number(vault.bidCount) &&
    Number(vault.closedPeekCount) === Number(vault.peeksSold)
  ) {
    const sig = await (teeProgram.methods as any)
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
    console.log("close_round", sig);
  } else {
    throw new Error("not ready for close_round");
  }

  console.log("waiting undelegate…");
  for (let i = 0; i < 60; i++) {
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
  const indices: number[] = [];
  for (let i = 0; i < contentsSol.len; i++) {
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
    const itemMint = itemAcct.mint as PublicKey;
    const poolAta = associatedTokenAddress(itemMint, house, true);
    const winnerItemAta = associatedTokenAddress(
      itemMint,
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
          { pubkey: itemMint, isSigner: false, isWritable: false },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.alloc(0),
      };
      await (program.provider as AnchorProvider).sendAndConfirm(
        new Transaction().add(ix as never),
      );
      console.log("create ATA", itemMint.toBase58().slice(0, 8));
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

main().catch(async (e: unknown) => {
  const err = e as { message?: string; getLogs?: () => Promise<string[]> };
  console.error("FAIL", err.message?.slice?.(0, 600) ?? e);
  if (err.getLogs) {
    try {
      console.error((await err.getLogs()).slice(-25));
    } catch {
      /* ignore */
    }
  }
  process.exit(1);
});
