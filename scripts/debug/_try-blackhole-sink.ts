import {
  TOKEN_PROGRAM_ID,
  ensureMagicAtaDestinationIx,
  getAuthToken,
  getAssociatedTokenAddressSync,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, Keypair, Transaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import { housePda, solanaProvider, TEE_RPC } from "../lib/env";

async function main() {
  const { program, wallet } = solanaProvider();
  const h = await (program.account as any).house.fetch(housePda());
  const mint = h.scripMint;
  const sinkOwner = Keypair.generate();
  const sink = getAssociatedTokenAddressSync(mint, sinkOwner.publicKey, true);
  console.log("sinkOwner", sinkOwner.publicKey.toBase58());
  console.log("sink", sink.toBase58());

  const { token } = await getAuthToken(
    TEE_RPC,
    wallet.publicKey,
    async (msg) => nacl.sign.detached(msg, wallet.secretKey),
  );
  const tee = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");

  const ix = ensureMagicAtaDestinationIx(
    wallet.publicKey,
    sinkOwner.publicKey,
    mint,
    TOKEN_PROGRAM_ID,
  );
  const tx = new Transaction().add(ix);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await tee.getLatestBlockhash()).blockhash;
  tx.sign(wallet);
  try {
    const sig = await tee.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
    });
    await tee.confirmTransaction(sig, "confirmed");
    console.log("ensure PASS", sig);
  } catch (e: any) {
    console.log("ensure FAIL", e.message?.slice?.(0, 500));
    return;
  }
  const info = await tee.getAccountInfo(sink);
  console.log(
    "after",
    info ? `owner=${info.owner.toBase58()} len=${info.data.length}` : "MISS",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
