import { housePda, solanaProvider } from "../lib/env";

async function main() {
  const { program } = solanaProvider();
  const h = await (program.account as any).house.fetch(housePda());
  console.log({
    durationSecs: (h.durationSecs as any[]).map(Number),
    minBid: (h.minBid as any[]).map((x: any) => Number(x) / 1e6),
    peekFee: (h.peekFee as any[]).map((x: any) => Number(x) / 1e6),
  });
}
main();
