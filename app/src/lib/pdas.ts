import { PublicKey } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  EPHEMERAL_SPL_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { PROGRAM_ID } from "./connections";

const programId = () => new PublicKey(PROGRAM_ID);

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
} as const;

export function housePda(): PublicKey {
  return PublicKey.findProgramAddressSync([SEEDS.house], programId())[0];
}

export function itemPda(index: number): PublicKey {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(index);
  return PublicKey.findProgramAddressSync([SEEDS.item, buf], programId())[0];
}

export function poolLedgerPda(house: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.pool, house.toBuffer()],
    programId(),
  )[0];
}

export function vaultPda(house: PublicKey, id: bigint | number): PublicKey {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(id));
  return PublicKey.findProgramAddressSync(
    [SEEDS.vault, house.toBuffer(), buf],
    programId(),
  )[0];
}

export function hintsPda(vault: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.hints, vault.toBuffer()],
    programId(),
  )[0];
}

export function contentsPda(vault: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.contents, vault.toBuffer()],
    programId(),
  )[0];
}

export function bidPda(vault: PublicKey, bidder: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.bid, vault.toBuffer(), bidder.toBuffer()],
    programId(),
  )[0];
}

export function paymentReceiptPda(vault: PublicKey, payer: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.payment, vault.toBuffer(), payer.toBuffer()],
    programId(),
  )[0];
}

export function peekPda(vault: PublicKey, buyer: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.peek, vault.toBuffer(), buyer.toBuffer()],
    programId(),
  )[0];
}

export function faucetTicketPda(user: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEEDS.faucet, user.toBuffer()],
    programId(),
  )[0];
}

export function ephemeralAtaPda(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), mint.toBuffer()],
    EPHEMERAL_SPL_TOKEN_PROGRAM_ID,
  )[0];
}

/** Canonical ATA (Model A balances on TEE live here). */
export function associatedTokenPda(
  mint: PublicKey,
  owner: PublicKey,
  allowOwnerOffCurve = false,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [
      owner.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

export function permissionPda(account: PublicKey): PublicKey {
  return permissionPdaFromAccount(account);
}
