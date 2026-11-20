import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import { getAuthToken } from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../../target/idl/blind_vault.json";
import {
  contentsPda,
  hintsPda,
  housePda,
  poolPda,
  solanaProvider,
  TEE_RPC,
} from "../lib/env";

async function main() {
  const vaultPk = new PublicKey(
    process.argv[2] ?? "8pDt6MpKZYgHtCBFq3ubSHiMPuF13tdD1avwVCp2VQQK",
  );
  const { wallet } = solanaProvider();
  const house = housePda();
  const { token } = await getAuthToken(
    TEE_RPC,
    wallet.publicKey,
    async (msg) => nacl.sign.detached(msg, wallet.secretKey),
  );
  const tee = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");
  const teeProgram = new Program(
    idl as Idl,
    new AnchorProvider(tee, new Wallet(wallet), { commitment: "confirmed" }),
  );

  for (const pk of [
    vaultPk,
    hintsPda(vaultPk),
    contentsPda(vaultPk),
    poolPda(house),
  ]) {
    const info = await tee.getAccountInfo(pk);
    console.log(pk.toBase58().slice(0, 8), {
      exists: !!info,
      owner: info?.owner.toBase58(),
      len: info?.data.length,
      lamports: info?.lamports,
    });
  }

  try {
    const sim = await (teeProgram.methods as any)
      .closeRound()
      .accounts({
        payer: wallet.publicKey,
        vault: vaultPk,
        hints: hintsPda(vaultPk),
        contents: contentsPda(vaultPk),
        poolLedger: poolPda(house),
      })
      .simulate();
    console.log("SIM OK", sim);
  } catch (e: any) {
    console.log("SIM ERR", e?.message);
    console.log("logs", e?.simulationResponse?.logs ?? e?.logs);
    if (e?.getLogs) console.log("getLogs", await e.getLogs(tee));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
