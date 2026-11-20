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
import {
  contentsPda,
  housePda,
  solanaProvider,
  TEE_RPC,
} from "../lib/env";

async function main() {
  const { program, wallet } = solanaProvider();
  const house = housePda();
  const houseAcct = await (program.account as any).house.fetch(house);
  const vault = houseAcct.activeVault;
  const contents = contentsPda(vault);

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

  const sig = await (teeProgram.methods as any)
    .initContentsPermission()
    .accounts({
      vault,
      contents,
      contentsPermission: permissionPdaFromAccount(contents),
      ephemeralVault: EPHEMERAL_VAULT_ID,
      magicProgram: MAGIC_PROGRAM_ID,
      permissionProgram: PERMISSION_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("init_contents_permission", sig);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
