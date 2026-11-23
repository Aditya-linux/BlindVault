import { AnchorProvider, Program, Wallet, Idl } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} from "@solana/web3.js";
import fs from "node:fs";
import path from "node:path";
import idl from "../../target/idl/blind_vault.json";

/** Load gitignored root .env into process.env (no overwrite). */
function loadDotEnv() {
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}
loadDotEnv();

export const PROGRAM_ID = new PublicKey(
  process.env.PROGRAM_ID ?? "E9UmQYi4gTHyyQ3SK5B4UCpewBnUBFrEc5NqkkAjr42h",
);
export const TEE_RPC =
  process.env.TEE_RPC ?? "https://devnet-tee.magicblock.app";
export const SOLANA_RPC =
  process.env.ANCHOR_PROVIDER_URL ??
  process.env.SOLANA_RPC ??
  clusterApiUrl("devnet");

export function loadKeypair(file?: string): Keypair {
  const p =
    file ??
    process.env.ANCHOR_WALLET ??
    path.join(process.env.HOME ?? process.env.USERPROFILE ?? "", ".config/solana/id.json");
  const raw = JSON.parse(fs.readFileSync(p, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

export function solanaProvider(keypair?: Keypair): {
  connection: Connection;
  provider: AnchorProvider;
  program: Program;
  wallet: Keypair;
} {
  const wallet = keypair ?? loadKeypair();
  const connection = new Connection(SOLANA_RPC, "confirmed");
  const provider = new AnchorProvider(
    connection,
    new Wallet(wallet),
    { commitment: "confirmed" },
  );
  const program = new Program(idl as Idl, provider);
  return { connection, provider, program, wallet };
}

export const SEEDS = {
  house: Buffer.from("house"),
  item: Buffer.from("item"),
  pool: Buffer.from("pool_v9"),
  vault: Buffer.from("vault"),
  hints: Buffer.from("hints"),
  contents: Buffer.from("contents"),
  bid: Buffer.from("bid"),
  peek: Buffer.from("peek"),
  faucet: Buffer.from("faucet"),
  payment: Buffer.from("payment"),
};

export function housePda(): PublicKey {
  return PublicKey.findProgramAddressSync([SEEDS.house], PROGRAM_ID)[0];
}

export function vaultPda(house: PublicKey, id: bigint | number): PublicKey {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(id));
  return PublicKey.findProgramAddressSync(
    [SEEDS.vault, house.toBuffer(), buf],
    PROGRAM_ID,
  )[0];
}

export function hintsPda(vault: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.hints, vault.toBuffer()],
    PROGRAM_ID,
  )[0];
}

export function contentsPda(vault: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.contents, vault.toBuffer()],
    PROGRAM_ID,
  )[0];
}

export function poolPda(house: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.pool, house.toBuffer()],
    PROGRAM_ID,
  )[0];
}

export function itemPda(index: number): PublicKey {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(index);
  return PublicKey.findProgramAddressSync([SEEDS.item, buf], PROGRAM_ID)[0];
}

export function paymentReceiptPda(vault: PublicKey, payer: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.payment, vault.toBuffer(), payer.toBuffer()],
    PROGRAM_ID,
  )[0];
}
