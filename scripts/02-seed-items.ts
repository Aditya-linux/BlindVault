/**
 * Mint 40 collectibles from data/items.json into the house pool.
 * Usage: npx tsx scripts/02-seed-items.ts
 */
import {
  Keypair,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import fs from "node:fs";
import path from "node:path";
import { associatedTokenAddress } from "./lib/ata";
import { housePda, itemPda, solanaProvider } from "./lib/env";

type ItemRow = {
  index: number;
  name: string;
  rarity: number;
  category: number;
  value: number;
};

async function main() {
  const { program, wallet, connection } = solanaProvider();
  const house = housePda();
  const houseAcct = await (program.account as any).house.fetch(house);
  let next = Number(houseAcct.itemCount);

  const itemsPath = path.join(process.cwd(), "data", "items.json");
  const items = JSON.parse(fs.readFileSync(itemsPath, "utf8")) as ItemRow[];

  for (const row of items) {
    if (row.index < next) {
      console.log(`skip #${row.index} (already seeded)`);
      continue;
    }
    if (row.index !== next) {
      throw new Error(`Expected next index ${next}, got ${row.index}`);
    }

    const itemMint = Keypair.generate();
    const item = itemPda(row.index);
    const poolAta = associatedTokenAddress(itemMint.publicKey, house, true);
    const nameBytes = Buffer.alloc(24);
    Buffer.from(row.name.slice(0, 24), "utf8").copy(nameBytes);

    const sig = await (program.methods as any)
      .addItem(row.index, row.rarity, row.category, row.value, [...nameBytes])
      .accounts({
        authority: wallet.publicKey,
        house,
        item,
        itemMint: itemMint.publicKey,
        poolAta,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([itemMint])
      .rpc();

    console.log(
      `add_item #${row.index} ${row.name} mint=${itemMint.publicKey.toBase58()} sig=${sig}`,
    );
    next += 1;
    // gentle pacing for RPC
    await new Promise((r) => setTimeout(r, 400));
  }

  const bal = await connection.getBalance(wallet.publicKey);
  console.log("done. wallet lamports", bal);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
