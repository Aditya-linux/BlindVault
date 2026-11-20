import { BN, AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  MAGIC_PROGRAM_ID,
  getAuthToken,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../../target/idl/blind_vault.json";
import { associatedTokenAddress } from "../lib/ata";
import { housePda, solanaProvider, TEE_RPC } from "../lib/env";

async function main() {
  const { program, wallet } = solanaProvider();
  const house = housePda();
  const h = await (program.account as any).house.fetch(house);
  const mint = h.scripMint as PublicKey;
  const vaultPk = h.activeVault as PublicKey;

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

  const vault = await (teeProgram.account as any).vault.fetch(vaultPk);
  const userAta = associatedTokenAddress(mint, wallet.publicKey);
  const escrowAta = associatedTokenAddress(mint, vaultPk, true);
  const bid = PublicKey.findProgramAddressSync(
    [Buffer.from("bid"), vaultPk.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId,
  )[0];

  console.log({
    left: Number(vault.deadlineTs) - Math.floor(Date.now() / 1000),
    escrowField: vault.escrow.toBase58(),
    escrowAta: escrowAta.toBase58(),
    userAta: userAta.toBase58(),
  });

  for (const [n, p] of [
    ["userAta", userAta],
    ["escrowAta", escrowAta],
    ["vault", vaultPk],
    ["bid", bid],
  ] as const) {
    const i = await tee.getAccountInfo(p);
    console.log(
      "tee",
      n,
      i
        ? {
            owner: i.owner.toBase58().slice(0, 12),
            len: i.data.length,
            lamports: i.lamports,
          }
        : null,
    );
  }

  try {
    const bal = await tee.getTokenAccountBalance(userAta);
    console.log("userAta bal", bal.value.uiAmountString);
  } catch (e: any) {
    console.log("userAta bal ERR", e.message?.slice(0, 80));
  }
  try {
    const bal = await tee.getTokenAccountBalance(escrowAta);
    console.log("escrow bal", bal.value.uiAmountString);
  } catch (e: any) {
    console.log("escrow bal ERR", e.message?.slice(0, 80));
  }

  const ix = await (teeProgram.methods as any)
    .placeBid(new BN(50_000_000))
    .accounts({
      bidder: wallet.publicKey,
      lot: vaultPk,
      bid,
      bidderScrip: userAta,
      escrow: escrowAta,
      tokenProgram: TOKEN_PROGRAM_ID,
      magicProgram: MAGIC_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  console.log(
    "keys",
    ix.keys.map((k: any) => ({
      pk: k.pubkey.toBase58().slice(0, 12),
      w: k.isWritable,
      s: k.isSigner,
    })),
  );

  const tx = new Transaction().add(ix);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await tee.getLatestBlockhash()).blockhash;
  tx.sign(wallet);
  const sim = await tee.simulateTransaction(tx);
  console.log("err", JSON.stringify(sim.value.err));
  console.log("logs\n", (sim.value.logs || []).join("\n"));
}

main().catch(console.error);
