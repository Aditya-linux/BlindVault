/**
 * End → reveal → settle (approve-delegate pull) → close → finalize for Vault 5.
 */
import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  ensureMagicAtaDestinationIx,
  getAuthToken,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../../target/idl/blind_vault.json";
import { associatedTokenAddress } from "../lib/ata";
import {
  contentsPda,
  hintsPda,
  housePda,
  poolPda,
  solanaProvider,
  TEE_RPC,
} from "../lib/env";

async function main() {
  const { program, wallet, connection } = solanaProvider();
  const house = housePda();
  const houseAcct = await (program.account as any).house.fetch(house);
  const vaultPk = houseAcct.activeVault as PublicKey;
  const scripMint = houseAcct.scripMint as PublicKey;
  const treasury = houseAcct.treasury as PublicKey;
  const hints = hintsPda(vaultPk);
  const contents = contentsPda(vaultPk);
  const poolLedger = poolPda(house);

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

  let vault = await (teeProgram.account as any).vault.fetch(vaultPk);
  let status = Object.keys(vault.status)[0];
  console.log("start", {
    vault: vaultPk.toBase58(),
    status,
    left: Number(vault.deadlineTs) - Math.floor(Date.now() / 1000),
    bids: vault.bidCount,
  });

  const bid = PublicKey.findProgramAddressSync(
    [Buffer.from("bid"), vaultPk.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId,
  )[0];
  const winnerAta = associatedTokenAddress(scripMint, wallet.publicKey);

  if (status === "open") {
    const now = Math.floor(Date.now() / 1000);
    if (now < Number(vault.deadlineTs)) {
      const wait = Number(vault.deadlineTs) - now + 2;
      console.log(`waiting ${wait}s for deadline…`);
      await new Promise((r) => setTimeout(r, wait * 1000));
    }
    const sig = await (teeProgram.methods as any)
      .endAuction()
      .accounts({ vault: vaultPk })
      .remainingAccounts([
        { pubkey: bid, isWritable: false, isSigner: false },
      ])
      .rpc();
    console.log("end_auction", sig);
    vault = await (teeProgram.account as any).vault.fetch(vaultPk);
    status = Object.keys(vault.status)[0];
    console.log("after end", status, "winner", vault.winner.toBase58(), "high", Number(vault.highestBid) / 1e6);
  }

  if (status === "ended" || status === "abandoned") {
    const sig = await (teeProgram.methods as any)
      .revealContents()
      .accounts({
        vault: vaultPk,
        contents,
        poolLedger,
        contentsPermission: permissionPdaFromAccount(contents),
        ephemeralVault: EPHEMERAL_VAULT_ID,
        permissionProgram: PERMISSION_PROGRAM_ID,
      })
      .rpc();
    console.log("reveal_contents", sig);
    vault = await (teeProgram.account as any).vault.fetch(vaultPk);
    status = Object.keys(vault.status)[0];
  }

  if (status === "revealed" && !vault.abandoned) {
    // Treasury must exist on TEE for settle CPI
    if (!(await tee.getAccountInfo(treasury))) {
      const ensureIx = ensureMagicAtaDestinationIx(
        wallet.publicKey,
        house,
        scripMint,
        TOKEN_PROGRAM_ID,
      );
      const tx = new Transaction().add(ensureIx);
      tx.feePayer = wallet.publicKey;
      tx.recentBlockhash = (await tee.getLatestBlockhash()).blockhash;
      tx.sign(wallet);
      const ens = await tee.sendRawTransaction(tx.serialize(), {
        skipPreflight: true,
      });
      await tee.confirmTransaction(ens, "confirmed");
      console.log("ensureMagicAta treasury", ens);
    }

    try {
      const sig = await (teeProgram.methods as any)
        .settleWinningBid()
        .accounts({
          lot: vaultPk,
          bid,
          bidPermission: permissionPdaFromAccount(bid),
          escrow: winnerAta,
          treasury,
          ephemeralVault: EPHEMERAL_VAULT_ID,
          magicProgram: MAGIC_PROGRAM_ID,
          permissionProgram: PERMISSION_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      console.log("settle_winning_bid", sig);
    } catch (e: any) {
      console.log("settle_winning_bid ERR", e.message?.slice(0, 200));
      if (e.getLogs) console.log(await e.getLogs());
    }
    vault = await (teeProgram.account as any).vault.fetch(vaultPk);
  }

  if (
    status === "revealed" ||
    Object.keys((await (teeProgram.account as any).vault.fetch(vaultPk)).status)[0] ===
      "revealed"
  ) {
    vault = await (teeProgram.account as any).vault.fetch(vaultPk);
    if (vault.closedBidCount < vault.bidCount) {
      console.log(
        "closed_bid_count",
        vault.closedBidCount,
        "/",
        vault.bidCount,
        "— settle may have failed; not closing yet",
      );
    } else {
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

      console.log("waiting undelegate…");
      for (let i = 0; i < 60; i++) {
        const info = await connection.getAccountInfo(vaultPk);
        if (info && info.owner.equals(program.programId)) {
          console.log("undelegated after", i * 2, "s");
          break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }

      const fin = await (program.methods as any)
        .finalize()
        .accounts({
          house,
          vault: vaultPk,
          contents,
          poolLedger,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      console.log("finalize", fin);
    }
  }

  const after = await (teeProgram.account as any).vault.fetch(vaultPk).catch(() => null);
  if (after) {
    console.log("final tee status", Object.keys(after.status)[0], {
      closedBids: after.closedBidCount,
      revealedValue: after.revealedValue,
      winner: after.winner.toBase58(),
    });
  } else {
    const base = await (program.account as any).vault.fetch(vaultPk);
    console.log("final base status", Object.keys(base.status)[0], {
      closedBids: base.closedBidCount,
      revealedValue: base.revealedValue,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
