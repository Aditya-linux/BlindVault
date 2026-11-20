/**
 * Init House + SCRIP mint + treasury on Solana Devnet.
 * Usage: npx tsx scripts/01-init-house.ts
 */
import { BN } from "@coral-xyz/anchor";
import {
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { associatedTokenAddress } from "./lib/ata";
import { housePda, solanaProvider } from "./lib/env";

async function main() {
  const { program, wallet, connection } = solanaProvider();
  const house = housePda();
  const existing = await connection.getAccountInfo(house);
  if (existing) {
    console.log("House already exists:", house.toBase58());
    return;
  }

  const scripMint = Keypair.generate();
  // treasury ATA derived after mint exists — Anchor init creates it
  const peekFee = [new BN(15_000_000), new BN(25_000_000), new BN(40_000_000)];
  const minBid = [new BN(25_000_000), new BN(45_000_000), new BN(80_000_000)];
  const durationSecs = [new BN(180), new BN(300), new BN(480)];

  // Pre-compute treasury ATA address for logging (created by ix)
  const treasury = associatedTokenAddress(scripMint.publicKey, house, true);

  console.log("authority", wallet.publicKey.toBase58());
  console.log("house", house.toBase58());
  console.log("scripMint", scripMint.publicKey.toBase58());
  console.log("treasury", treasury.toBase58());

  const sig = await (program.methods as any)
    .initHouse(peekFee, minBid, durationSecs)
    .accounts({
      authority: wallet.publicKey,
      house,
      scripMint: scripMint.publicKey,
      treasury,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .signers([scripMint])
    .rpc();

  console.log("init_house ok", sig);
  console.log("Save SCRIP mint:", scripMint.publicKey.toBase58());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
