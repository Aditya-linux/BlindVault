import { BN } from "@coral-xyz/anchor";
import { housePda, solanaProvider } from "../lib/env";

async function main() {
  const { program, wallet } = solanaProvider();
  const house = housePda();
  const sig = await (program.methods as any)
    .updateHouseTiming(
      [new BN(5_000_000), new BN(8_000_000), new BN(12_000_000)],
      [new BN(10_000_000), new BN(25_000_000), new BN(50_000_000)],
      [new BN(300), new BN(300), new BN(300)],
    )
    .accounts({ authority: wallet.publicKey, house })
    .rpc();
  console.log("update_house_timing", sig);
  const h = await (program.account as any).house.fetch(house);
  console.log({
    durationSecs: (h.durationSecs as (number | bigint)[]).map(Number),
    minBid: (h.minBid as (number | bigint)[]).map((n) => Number(n) / 1_000_000),
    peekFee: (h.peekFee as (number | bigint)[]).map((n) => Number(n) / 1_000_000),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
