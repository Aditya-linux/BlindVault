import { Connection, PublicKey } from "@solana/web3.js";
import {
  DELEGATION_PROGRAM_ID,
  getAuthToken,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import nacl from "tweetnacl";
import { housePda, poolPda, solanaProvider, TEE_RPC } from "../lib/env";

async function main() {
  const { connection, wallet } = solanaProvider();
  const pool = poolPda(housePda());
  const record = PublicKey.findProgramAddressSync(
    [Buffer.from("delegation"), pool.toBuffer()],
    DELEGATION_PROGRAM_ID,
  )[0];
  const meta = PublicKey.findProgramAddressSync(
    [Buffer.from("delegation-metadata"), pool.toBuffer()],
    DELEGATION_PROGRAM_ID,
  )[0];
  const buffer = PublicKey.findProgramAddressSync(
    [Buffer.from("buffer"), pool.toBuffer()],
    DELEGATION_PROGRAM_ID,
  )[0];

  for (const [n, p] of [
    ["pool", pool],
    ["record", record],
    ["meta", meta],
    ["buffer", buffer],
  ] as const) {
    const i = await connection.getAccountInfo(p);
    console.log(
      "base",
      n,
      p.toBase58(),
      i
        ? {
            owner: i.owner.toBase58().slice(0, 12),
            len: i.data.length,
            hex: Buffer.from(i.data).subarray(0, 64).toString("hex"),
          }
        : null,
    );
  }

  // Try Magic router / status endpoints
  const urls = [
    TEE_RPC,
    "https://devnet-tee.magicblock.app",
    "https://devnet.magicblock.app",
  ];
  const { token } = await getAuthToken(
    TEE_RPC,
    wallet.publicKey,
    async (msg) => nacl.sign.detached(msg, wallet.secretKey),
  );
  for (const base of urls) {
    try {
      const c = new Connection(
        base.includes("tee") ? `${base}?token=${token}` : base,
        "confirmed",
      );
      const i = await c.getAccountInfo(pool);
      console.log(
        "er",
        base.slice(0, 40),
        i ? { owner: i.owner.toBase58().slice(0, 12), len: i.data.length } : null,
      );
    } catch (e: any) {
      console.log("er", base.slice(0, 40), "ERR", e.message?.slice(0, 80));
    }
  }
}

main().catch(console.error);
