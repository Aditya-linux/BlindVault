/**
 * Init PoolLedger with item metadata snapshots.
 * Uses an Address Lookup Table so 40 Item PDAs fit in one tx.
 * Usage: npx tsx scripts/03-init-pool.ts
 */
import {
  AddressLookupTableAccount,
  AddressLookupTableProgram,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { housePda, itemPda, poolPda, solanaProvider } from "./lib/env";

async function main() {
  const { program, wallet, connection, provider } = solanaProvider();
  const house = housePda();
  const poolLedger = poolPda(house);
  const existing = await connection.getAccountInfo(poolLedger);
  if (existing) {
    console.log("PoolLedger already exists:", poolLedger.toBase58());
    return;
  }

  const houseAcct = await (program.account as any).house.fetch(house);
  const count = Number(houseAcct.itemCount);
  const items: PublicKey[] = [];
  for (let i = 0; i < count; i++) items.push(itemPda(i));

  // Devnet finalized can lag beyond the ALT program's recent-slot window.
  const slot = await connection.getSlot("processed");
  const [createIx, lutAddress] = AddressLookupTableProgram.createLookupTable({
    authority: wallet.publicKey,
    payer: wallet.publicKey,
    recentSlot: slot - 1,
  });
  const createSig = await provider.sendAndConfirm(
    new Transaction().add(createIx),
  );
  console.log("ALT create", lutAddress.toBase58(), createSig);

  for (let i = 0; i < items.length; i += 20) {
    const chunk = items.slice(i, i + 20);
    const extendIx = AddressLookupTableProgram.extendLookupTable({
      payer: wallet.publicKey,
      authority: wallet.publicKey,
      lookupTable: lutAddress,
      addresses: chunk,
    });
    const sig = await provider.sendAndConfirm(
      new Transaction().add(extendIx),
    );
    console.log(`ALT extend ${i}..${i + chunk.length - 1}`, sig);
  }

  let lutAccount: AddressLookupTableAccount | null = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const res = await connection.getAddressLookupTable(lutAddress);
    lutAccount = res.value;
    if (lutAccount && lutAccount.isActive()) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!lutAccount || !lutAccount.isActive()) {
    throw new Error("ALT not active in time");
  }

  const remaining = items.map((pubkey) => ({
    pubkey,
    isWritable: false,
    isSigner: false,
  }));

  const ix = await (program.methods as any)
    .initPoolLedger()
    .accounts({
      authority: wallet.publicKey,
      house,
      poolLedger,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(remaining)
    .instruction();

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message([lutAccount]);
  const tx = new VersionedTransaction(message);
  tx.sign([wallet]);
  const sig = await connection.sendTransaction(tx, { skipPreflight: false });
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  console.log("init_pool_ledger ok", sig, poolLedger.toBase58());
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
