import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  getAuthToken,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, SystemProgram } from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../../target/idl/blind_vault.json";
import { housePda, poolPda, solanaProvider, TEE_RPC } from "../lib/env";

async function main() {
  const { program, wallet } = solanaProvider();
  const house = housePda();
  const houseAcct = await (program.account as any).house.fetch(house);
  const vault = houseAcct.activeVault;
  const poolLedger = poolPda(house);

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

  // wait for program sync
  for (let i = 0; i < 12; i++) {
    try {
      const sig = await (teeProgram.methods as any)
        .initPoolPermission()
        .accounts({
          vault,
          poolLedger,
          poolPermission: permissionPdaFromAccount(poolLedger),
          ephemeralVault: EPHEMERAL_VAULT_ID,
          magicProgram: MAGIC_PROGRAM_ID,
          permissionProgram: PERMISSION_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("init_pool_permission", sig);
      break;
    } catch (e: any) {
      const msg = e.message || String(e);
      console.log("try", i, msg.slice(0, 120));
      if (msg.includes("Fallback") || msg.includes("101")) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }
      throw e;
    }
  }

  const info = await tee.getAccountInfo(poolLedger);
  console.log("tee pool", info && { owner: info.owner.toBase58(), len: info.data.length });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
