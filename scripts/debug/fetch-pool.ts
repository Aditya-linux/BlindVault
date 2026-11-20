import { housePda, poolPda, solanaProvider } from "../lib/env";

async function main() {
  const { program, connection } = solanaProvider();
  const pool = poolPda(housePda());
  const info = await connection.getAccountInfo(pool);
  console.log("raw", info && { owner: info.owner.toBase58(), len: info.data.length });
  try {
    const pl = await (program.account as any).poolLedger.fetch(pool);
    console.log({
      itemCount: pl.itemCount,
      bump: pl.bump,
      house: pl.house.toBase58(),
    });
  } catch (e: any) {
    console.log("fetch fail", e.message);
    // owner is delegation program — Anchor can't deserialize as PoolLedger on base
  }
}

main();
