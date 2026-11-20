import {
  TOKEN_PROGRAM_ID,
  getAuthToken,
  transferSpl,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, Transaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import { housePda, solanaProvider, TEE_RPC } from "../lib/env";

async function main() {
  const { wallet, program } = solanaProvider();
  const h = await (program.account as any).house.fetch(housePda());
  const mint = h.scripMint;
  const vault = h.activeVault;
  console.log("vault", vault.toBase58(), "left check via fetch next");

  const { token } = await getAuthToken(
    TEE_RPC,
    wallet.publicKey,
    async (m) => nacl.sign.detached(m, wallet.secretKey),
  );
  const tee = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");

  const ixs = await transferSpl(wallet.publicKey, vault, mint, 1_000_000n, {
    visibility: "public",
    fromBalance: "ephemeral",
    toBalance: "ephemeral",
    payer: wallet.publicKey,
    initIfMissing: true,
    tokenProgram: TOKEN_PROGRAM_ID,
  });
  console.log(
    "ix count",
    ixs.length,
    ixs.map((i) => i.programId.toBase58().slice(0, 10)),
  );
  const tx = new Transaction().add(...ixs);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await tee.getLatestBlockhash()).blockhash;
  tx.sign(wallet);
  const sim = await tee.simulateTransaction(tx);
  console.log("err", JSON.stringify(sim.value.err));
  console.log((sim.value.logs || []).join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
