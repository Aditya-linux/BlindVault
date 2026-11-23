/** Read-only Devnet proof of a finalized winning vault. */
import { PublicKey } from "@solana/web3.js";
import { associatedTokenAddress } from "./lib/ata";
import { contentsPda, housePda, itemPda, paymentReceiptPda, poolPda, solanaProvider, vaultPda } from "./lib/env";

async function main() {
  const id = Number(process.argv[2]);
  if (!Number.isSafeInteger(id) || id < 1) {
    throw new Error("Usage: tsx scripts/verify-settled-vault.ts <vault-id>");
  }
  const { program, connection } = solanaProvider();
  const house = housePda();
  const vaultPk = vaultPda(house, id);
  const poolInfo = await connection.getAccountInfo(poolPda(house));
  const poolCurrentlyUndelegated = Boolean(poolInfo?.owner.equals(program.programId));
  const vaultInfo = await connection.getAccountInfo(vaultPk);
  if (!vaultInfo?.owner.equals(program.programId)) {
    throw new Error("Vault is not owned by the base Solana program");
  }
  const vault = await (program.account as any).vault.fetch(vaultPk);
  if (Object.keys(vault.status)[0] !== "settled") throw new Error("Vault is not Settled on Solana");
  if (vault.abandoned) throw new Error("Vault was abandoned, not won");
  const winner = vault.winner as PublicKey;
  const receiptPk = paymentReceiptPda(vaultPk, winner);
  const receipt = await (program.account as any).paymentReceipt.fetch(receiptPk);
  if (!(receipt.vault as PublicKey).equals(vaultPk) || !(receipt.payer as PublicKey).equals(winner)) {
    throw new Error("Payment receipt does not match vault/winner");
  }
  if (receipt.amount.toString() !== vault.highestBid.toString()) {
    throw new Error("Payment receipt amount does not equal winning bid");
  }
  const contents = await (program.account as any).vaultContents.fetch(contentsPda(vaultPk));
  const cards: number[] = [];
  for (let i = 0; i < Number(contents.len); i++) {
    const index = Number(contents.items[i]);
    const item = await (program.account as any).item.fetch(itemPda(index));
    if (!item.sold || !(item.owner as PublicKey).equals(winner)) {
      throw new Error(`Item ${index} is not sold to winner`);
    }
    const balance = await connection.getTokenAccountBalance(associatedTokenAddress(item.mint as PublicKey, winner));
    if (balance.value.amount !== "1") throw new Error(`Winner token balance for item ${index} is ${balance.value.amount}`);
    cards.push(index);
  }
  console.log("VERIFY PASS", { id, vault: vaultPk.toBase58(), winner: winner.toBase58(), paidScrip: Number(receipt.amount) / 1_000_000, receipt: receiptPk.toBase58(), poolCurrentlyUndelegated, cards });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
