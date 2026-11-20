import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  getAuthToken,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../../target/idl/blind_vault.json";
import {
  contentsPda,
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
  const contents = contentsPda(vaultPk);
  const poolLedger = poolPda(house);
  const contentsPermission = permissionPdaFromAccount(contents);
  console.log({
    vault: vaultPk.toBase58(),
    contents: contents.toBase58(),
    poolLedger: poolLedger.toBase58(),
    contentsPermission: contentsPermission.toBase58(),
    ephemeralVault: EPHEMERAL_VAULT_ID.toBase58(),
  });

  const vault = await (teeProgram.account as any).vault.fetch(vaultPk);
  console.log("status", Object.keys(vault.status)[0], "abandoned?", vault.abandoned);

  const builder = (teeProgram.methods as any).revealContents().accounts({
    vault: vaultPk,
    contents,
    poolLedger,
    contentsPermission,
    ephemeralVault: EPHEMERAL_VAULT_ID,
    magicProgram: MAGIC_PROGRAM_ID,
    permissionProgram: PERMISSION_PROGRAM_ID,
  });

  const mode = process.argv[3] ?? "rpc";
  try {
    if (mode === "sim") {
      const tx = await builder.simulate();
      console.log("SIM OK", tx);
    } else {
      const sig = await builder.rpc();
      console.log("RPC OK", sig);
      const after = await (teeProgram.account as any).vault.fetch(vaultPk);
      console.log(
        "after",
        Object.keys(after.status)[0],
        "value",
        after.revealedValue,
        "items",
        after.revealedItems.slice(0, after.itemCount),
      );
    }
  } catch (e: any) {
    console.log("ERR message:", e?.message);
    console.log("SIM logs:", e?.simulationResponse?.logs ?? e?.logs ?? null);
    try {
      if (typeof e?.getLogs === "function") {
        console.log("getLogs:", await e.getLogs(tee));
      }
    } catch (e2) {
      console.log("getLogs fail", e2);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("fatal", e);
  process.exit(1);
});
