/**
 * Diagnose + settle Vault 8 after reveal.
 */
import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  ensureMagicAtaDestinationIx,
  getAuthToken,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
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
  const h = await (program.account as any).house.fetch(house);
  const vaultPk = h.activeVault as PublicKey;
  const scripMint = h.scripMint as PublicKey;
  const treasury = h.treasury as PublicKey;
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
  const escrow = associatedTokenAddress(scripMint, vaultPk, true);
  const winnerAta = associatedTokenAddress(scripMint, wallet.publicKey);

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

  const v = await (teeProgram.account as any).vault.fetch(vaultPk);
  console.log("vault", {
    status: Object.keys(v.status)[0],
    abandoned: v.abandoned,
    highest: Number(v.highestBid) / 1e6,
    winner: (v.winner as PublicKey).toBase58(),
    closedBids: v.closedBidCount,
    bids: v.bidCount,
    peeks: v.peeksSold,
    closedPeeks: v.closedPeekCount,
    vaultEscrow: (v.escrow as PublicKey).toBase58(),
    derivedEscrow: escrow.toBase58(),
  });

  for (const [n, pk] of [
    ["bid", bid],
    ["peek", peek],
    ["escrow", escrow],
    ["winnerAta", winnerAta],
    ["treasury", treasury],
  ] as const) {
    const i = await tee.getAccountInfo(pk);
    console.log(n, i ? `len=${i.data.length} owner=${i.owner.toBase58().slice(0, 8)}` : "MISS");
  }

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
    const ens = await tee.sendRawTransaction(tx.serialize(), { skipPreflight: true });
    await tee.confirmTransaction(ens, "confirmed");
    console.log("ensureMagicAta treasury", ens);
  }

  // Vault 5 pattern used escrow: winnerAta (approve-delegate pull Model A).
  // Try that first; also try vault escrow ATA if needed.
  const attempts = [
    { label: "escrow=winnerAta (Model A)", escrowAcc: winnerAta },
    { label: "escrow=vault ATA", escrowAcc: escrow },
  ];

  for (const attempt of attempts) {
    try {
      const sig = await (teeProgram.methods as any)
        .settleWinningBid()
        .accounts({
          closer: wallet.publicKey,
          lot: vaultPk,
          bid,
          escrow: attempt.escrowAcc,
          winnerScrip: winnerAta,
          treasury,
          bidPermission: permissionPdaFromAccount(bid),
          ephemeralVault: EPHEMERAL_VAULT_ID,
          magicProgram: MAGIC_PROGRAM_ID,
          permissionProgram: PERMISSION_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("settle PASS", attempt.label, sig);
      break;
    } catch (e: unknown) {
      const err = e as { message?: string; getLogs?: () => Promise<string[]> };
      console.log("settle FAIL", attempt.label, err.message?.slice(0, 300));
      if (err.getLogs) console.log((await err.getLogs()).slice(-20));
    }
  }

  let after = await (teeProgram.account as any).vault.fetch(vaultPk);
  console.log("after settle", {
    closedBids: after.closedBidCount,
    closedPeeks: after.closedPeekCount,
  });

  if (Number(after.closedPeekCount) < Number(after.peeksSold)) {
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
  }

  after = await (teeProgram.account as any).vault.fetch(vaultPk);
  if (
    Number(after.closedBidCount) === Number(after.bidCount) &&
    Number(after.closedPeekCount) === Number(after.peeksSold)
  ) {
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
  } else {
    console.log("not ready to close_round", {
      closedBids: after.closedBidCount,
      bids: after.bidCount,
      closedPeeks: after.closedPeekCount,
      peeks: after.peeksSold,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
