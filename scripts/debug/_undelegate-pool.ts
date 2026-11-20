/**
 * Force commit+undelegate of pool_v3 so we can re-delegate a fresh TEE clone.
 */
import {
  createCommitAndUndelegateInstruction,
  getAuthToken,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, Transaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import { housePda, poolPda, solanaProvider, TEE_RPC } from "../lib/env";

async function main() {
  const { wallet, connection, program } = solanaProvider();
  const house = housePda();
  const pool = poolPda(house);
  console.log("pool", pool.toBase58());

  const before = await connection.getAccountInfo(pool);
  console.log(
    "base before",
    before && { owner: before.owner.toBase58().slice(0, 12), len: before.data.length },
  );

  const { token } = await getAuthToken(
    TEE_RPC,
    wallet.publicKey,
    async (msg) => nacl.sign.detached(msg, wallet.secretKey),
  );
  const tee = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");

  const ix = createCommitAndUndelegateInstruction(wallet.publicKey, [pool]);
  console.log(
    "ix keys",
    ix.keys.map((k) => k.pubkey.toBase58().slice(0, 10)),
  );
  const tx = new Transaction().add(ix);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await tee.getLatestBlockhash()).blockhash;
  tx.sign(wallet);

  const sim = await tee.simulateTransaction(tx);
  console.log("sim err", sim.value.err);
  console.log("sim logs\n", (sim.value.logs || []).join("\n"));

  if (!sim.value.err) {
    const sig = await tee.sendRawTransaction(tx.serialize(), { skipPreflight: true });
    await tee.confirmTransaction(sig, "confirmed");
    console.log("undelegate sig", sig);
  }

  for (let i = 0; i < 40; i++) {
    const info = await connection.getAccountInfo(pool);
    if (info && info.owner.equals(program.programId)) {
      console.log("pool back on program after", i * 2, "s");
      break;
    }
    console.log(
      "wait",
      i,
      info ? info.owner.toBase58().slice(0, 12) : null,
    );
    await new Promise((r) => setTimeout(r, 2000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
