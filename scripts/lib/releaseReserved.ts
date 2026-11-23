/**
 * Clear PoolLedger reserved bits so the next fill can run after force_clear
 * skipped close_round (Devnet only — reserved can leak across stuck rounds).
 */
import type { Program } from "@coral-xyz/anchor";
import type { PublicKey } from "@solana/web3.js";

function bitSet(bytes: Uint8Array | number[], i: number): boolean {
  const b = bytes[Math.floor(i / 8)] ?? 0;
  return ((b >> i % 8) & 1) === 1;
}

export async function releaseAllReserved(opts: {
  teeProgram: Program;
  authority: PublicKey;
  house: PublicKey;
  poolLedger: PublicKey;
}): Promise<number[]> {
  const { teeProgram, authority, house, poolLedger } = opts;
  const ledger = await (teeProgram.account as any).poolLedger.fetch(poolLedger);
  const n = Number(ledger.itemCount);
  const reserved = ledger.reserved as number[] | Uint8Array;
  const sold = ledger.sold as number[] | Uint8Array;
  const indices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (bitSet(reserved, i) && !bitSet(sold, i)) {
      indices.push(i);
    }
  }
  if (indices.length === 0) {
    console.log("release_pool_items: nothing reserved");
    return [];
  }
  // Chunk ≤8 (MAX_ITEMS_VAULT)
  for (let off = 0; off < indices.length; off += 8) {
    const chunk = indices.slice(off, off + 8);
    const sig = await (teeProgram.methods as any)
      .clearReservedItems(chunk)
      .accounts({
        authority,
        house,
        poolLedger,
      })
      .rpc();
    console.log("clear_reserved_items", chunk, sig);
  }
  return indices;
}
