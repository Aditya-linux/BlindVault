/**
 * Can we materialize a system-owned SCRIP ATA on TEE for peek fees?
 */
import {
  TOKEN_PROGRAM_ID,
  ensureMagicAtaDestinationIx,
  getAuthToken,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, Transaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import { associatedTokenAddress } from "../lib/ata";
import { housePda, solanaProvider, TEE_RPC } from "../lib/env";

async function main() {
  const { program, wallet } = solanaProvider();
  const house = housePda();
  const h = await (program.account as any).house.fetch(house);
  const scripMint = h.scripMint;
  const authority = h.authority;
  const sink = associatedTokenAddress(scripMint, authority);
  console.log({
    authority: authority.toBase58(),
    sink: sink.toBase58(),
    sameAsWallet: authority.equals(wallet.publicKey),
  });

  const { token } = await getAuthToken(
    TEE_RPC,
    wallet.publicKey,
    async (msg) => nacl.sign.detached(msg, wallet.secretKey),
  );
  const tee = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");
  console.log(
    "sink before",
    (await tee.getAccountInfo(sink)) ? "EXISTS" : "MISS",
  );

  // If sink is the wallet ATA it already exists (buyerScrip).
  if (await tee.getAccountInfo(sink)) {
    console.log("fee sink already on TEE — transfer target OK");
    return;
  }

  const ix = ensureMagicAtaDestinationIx(
    wallet.publicKey,
    authority,
    scripMint,
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
    console.log("ensure authority sink PASS", sig);
  } catch (e: any) {
    console.log("ensure FAIL", e.message?.slice?.(0, 400));
  }
  console.log(
    "sink after",
    (await tee.getAccountInfo(sink))
      ? `EXISTS owner=${(await tee.getAccountInfo(sink))!.owner.toBase58().slice(0, 8)}`
      : "MISS",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
