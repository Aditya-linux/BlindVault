import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  getAuthToken,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
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
  const { program, wallet } = solanaProvider();
  const house = housePda();
  const houseAcct = await (program.account as any).house.fetch(house);
  const vault = houseAcct.activeVault as PublicKey;
  const contents = contentsPda(vault);
  const hints = hintsPda(vault);
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

  const accounts = {
    vault,
    contents,
    poolLedger,
    contentsPermission: permissionPdaFromAccount(contents),
    poolPermission: permissionPdaFromAccount(poolLedger),
    ephemeralVault: EPHEMERAL_VAULT_ID,
    magicProgram: MAGIC_PROGRAM_ID,
    permissionProgram: PERMISSION_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
  };
  console.log("perms", {
    contentsPermission: accounts.contentsPermission.toBase58(),
    poolPermission: accounts.poolPermission.toBase58(),
  });

  const ix = await (teeProgram.methods as any)
    .initPermissions()
    .accounts(accounts)
    .instruction();
  const tx = new Transaction().add(ix);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await tee.getLatestBlockhash()).blockhash;
  tx.sign(wallet);
  const sim = await tee.simulateTransaction(tx);
  console.log("err", sim.value.err);
  console.log("logs\n", (sim.value.logs || []).join("\n"));

  if (!sim.value.err) {
    const sig = await tee.sendRawTransaction(tx.serialize());
    console.log("sent", sig);
  }
}

main().catch(console.error);
