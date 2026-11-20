import { BN, AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  EPHEMERAL_SPL_TOKEN_PROGRAM_ID,
  MAGIC_PROGRAM_ID,
  getAuthToken,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../../target/idl/blind_vault.json";
import { housePda, solanaProvider, TEE_RPC } from "../lib/env";

async function main() {
  const { program, wallet } = solanaProvider();
  const house = housePda();
  const houseAcct = await (program.account as any).house.fetch(house);
  const scripMint = houseAcct.scripMint as PublicKey;
  const vaultPk = houseAcct.activeVault as PublicKey;

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

  const vault = await (teeProgram.account as any).vault.fetch(vaultPk);
  const bidderScrip = PublicKey.findProgramAddressSync(
    [wallet.publicKey.toBuffer(), scripMint.toBuffer()],
    EPHEMERAL_SPL_TOKEN_PROGRAM_ID,
  )[0];
  const bid = PublicKey.findProgramAddressSync(
    [Buffer.from("bid"), vaultPk.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId,
  )[0];

  for (const [n, p] of [
    ["bidderScrip", bidderScrip],
    ["escrow", vault.escrow as PublicKey],
    ["bid", bid],
  ] as const) {
    const i = await tee.getAccountInfo(p);
    console.log(
      "tee",
      n,
      p.toBase58().slice(0, 12),
      i ? { owner: i.owner.toBase58().slice(0, 12), len: i.data.length } : null,
    );
  }

  const ix = await (teeProgram.methods as any)
    .placeBid(new BN(25_000_000))
    .accounts({
      bidder: wallet.publicKey,
      lot: vaultPk,
      bid,
      bidderScrip,
      escrow: vault.escrow,
      tokenProgram: EPHEMERAL_SPL_TOKEN_PROGRAM_ID,
      magicProgram: MAGIC_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  console.log(
    "keys",
    ix.keys.map((k: any) => ({
      pk: k.pubkey.toBase58().slice(0, 10),
      w: k.isWritable,
      s: k.isSigner,
    })),
  );

  const tx = new Transaction().add(ix);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await tee.getLatestBlockhash()).blockhash;
  tx.sign(wallet);
  const sim = await tee.simulateTransaction(tx);
  console.log("err", sim.value.err);
  console.log("logs\n", (sim.value.logs || []).join("\n"));
}

main().catch(console.error);
