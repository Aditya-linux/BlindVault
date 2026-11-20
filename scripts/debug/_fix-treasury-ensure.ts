import {
  TOKEN_PROGRAM_ID,
  ensureMagicAtaDestinationIx,
  getAuthToken,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, Transaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import { housePda, solanaProvider, TEE_RPC } from "../lib/env";

async function main() {
  const { program, wallet } = solanaProvider();
  const house = housePda();
  const h = await (program.account as any).house.fetch(house);
  const scripMint = h.scripMint;
  const treasury = h.treasury;
  console.log("treasury", treasury.toBase58());
  console.log("house", house.toBase58());

  const { token } = await getAuthToken(
    TEE_RPC,
    wallet.publicKey,
    async (msg) => nacl.sign.detached(msg, wallet.secretKey),
  );
  const tee = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");

  console.log("before", await tee.getAccountInfo(treasury));

  const ix = ensureMagicAtaDestinationIx(
    wallet.publicKey,
    house,
    scripMint,
    TOKEN_PROGRAM_ID,
  );
  console.log(
    "ensure keys",
    ix.keys.map((k) => `${k.pubkey.toBase58().slice(0, 10)} w=${k.isWritable}`),
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
    if (e.logs) console.log(e.logs.slice(-20).join("\n"));
    if (e.getLogs) console.log((await e.getLogs()).slice(-20).join("\n"));
  }
  const after = await tee.getAccountInfo(treasury);
  console.log(
    "after",
    after
      ? `owner=${after.owner.toBase58()} len=${after.data.length}`
      : "MISS",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
