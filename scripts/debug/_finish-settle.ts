/**
 * For Vault already settled+closed on TEE: release pool bits → finalize on base.
 * Closer/winner path for settle is in prior runs; this completes base settlement.
 */
import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAuthToken,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../../target/idl/blind_vault.json";
import { associatedTokenAddress } from "../lib/ata";
import {
  contentsPda,
  housePda,
  itemPda,
  poolPda,
  solanaProvider,
  TEE_RPC,
} from "../lib/env";

async function main() {
  const { program, wallet, connection } = solanaProvider();
  const house = housePda();
  const h = await (program.account as any).house.fetch(house);
  const vaultPk = h.activeVault as PublicKey;
  if (vaultPk.equals(PublicKey.default)) {
    throw new Error("no active vault on house");
  }
  const poolLedger = poolPda(house);
  const contents = contentsPda(vaultPk);

  const vault = await (program.account as any).vault.fetch(vaultPk);
  console.log("base status", Object.keys(vault.status)[0], {
    closedBids: vault.closedBidCount,
    bids: vault.bidCount,
    revealedValue: vault.revealedValue,
    winner: vault.winner.toBase58(),
  });

  const contentsAcct = await (program.account as any).vaultContents.fetch(contents);
  const indices: number[] = [];
  for (let i = 0; i < contentsAcct.len; i++) {
    indices.push(contentsAcct.items[i] as number);
  }
  console.log("items", indices);

  const { token } = await getAuthToken(
    TEE_RPC,
    wallet.publicKey,
    async (m) => nacl.sign.detached(m, wallet.secretKey),
  );
  const tee = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");
  const teeProgram = new Program(
    idl as Idl,
    new AnchorProvider(tee, new Wallet(wallet), { commitment: "confirmed" }),
  );

  if (indices.length > 0) {
    const rel = await (teeProgram.methods as any)
      .releasePoolItems(indices)
      .accounts({
        authority: wallet.publicKey,
        house,
        poolLedger,
      })
      .rpc();
    console.log("release_pool_items", rel);
  }

  const remaining: { pubkey: PublicKey; isWritable: boolean; isSigner: boolean }[] =
    [];
  for (const idx of indices) {
    const item = itemPda(idx);
    const itemAcct = await (program.account as any).item.fetch(item);
    const mint = itemAcct.mint as PublicKey;
    const poolAta = associatedTokenAddress(mint, house, true);
    const winnerAta = associatedTokenAddress(mint, vault.winner as PublicKey);

    if (!(await connection.getAccountInfo(winnerAta))) {
      // create ATA via associated token program
      const ix = {
        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: winnerAta, isSigner: false, isWritable: true },
          { pubkey: vault.winner as PublicKey, isSigner: false, isWritable: false },
          { pubkey: mint, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.alloc(0),
      };
      const tx = new Transaction().add(ix as any);
      const sig = await (
        program.provider as AnchorProvider
      ).sendAndConfirm(tx);
      console.log("create winner ATA", mint.toBase58().slice(0, 8), sig);
    }

    remaining.push(
      { pubkey: item, isWritable: true, isSigner: false },
      { pubkey: poolAta, isWritable: true, isSigner: false },
      { pubkey: winnerAta, isWritable: true, isSigner: false },
    );
  }

  const fin = await (program.methods as any)
    .finalize()
    .accounts({
      house,
      vault: vaultPk,
      contents,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .remainingAccounts(remaining)
    .rpc();
  console.log("finalize", fin);

  const base = await (program.account as any).vault.fetch(vaultPk);
  const houseAfter = await (program.account as any).house.fetch(house);
  console.log("DONE", {
    status: Object.keys(base.status)[0],
    revealedValue: base.revealedValue,
    winner: base.winner.toBase58(),
    highestBid: Number(base.highestBid) / 1e6,
    activeVault: (houseAfter.activeVault as PublicKey).toBase58(),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
