/**
 * close_round → wait undelegate → finalize_abandoned for a no-bid vault.
 */
import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  EPHEMERAL_VAULT_ID,
  PERMISSION_PROGRAM_ID,
  getAuthToken,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../target/idl/blind_vault.json";
import {
  contentsPda,
  hintsPda,
  housePda,
  poolPda,
  solanaProvider,
  TEE_RPC,
} from "./lib/env";

async function main() {
  const vaultPk = new PublicKey(
    process.argv[2] ?? "8pDt6MpKZYgHtCBFq3ubSHiMPuF13tdD1avwVCp2VQQK",
  );
  const { program, wallet, connection } = solanaProvider();
  const house = housePda();
  const hints = hintsPda(vaultPk);
  const contents = contentsPda(vaultPk);
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

  let vault = await (teeProgram.account as any).vault.fetch(vaultPk);
  let status = Object.keys(vault.status)[0];
  console.log("start status", status);

  if (status === "revealed") {
    const sig = await (teeProgram.methods as any)
      .closeRound()
      .accounts({
        payer: wallet.publicKey,
        vault: vaultPk,
        hints,
        contents,
        poolLedger,
        contentsPermission: permissionPdaFromAccount(contents),
        poolPermission: permissionPdaFromAccount(poolLedger),
        ephemeralVault: EPHEMERAL_VAULT_ID,
        permissionProgram: PERMISSION_PROGRAM_ID,
      })
      .rpc();
    console.log("close_round", sig);
    vault = await (teeProgram.account as any).vault.fetch(vaultPk);
    status = Object.keys(vault.status)[0];
    console.log("after close", status);
  }

  console.log("waiting for undelegation on Solana…");
  for (let i = 0; i < 60; i++) {
    const info = await connection.getAccountInfo(vaultPk);
    if (info && info.owner.equals(program.programId)) {
      console.log("undelegated after", i * 2, "s owner=", info.owner.toBase58());
      break;
    }
    if (i === 59) {
      console.log("still delegated/missing after 120s; trying finalize anyway");
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  try {
    const sig = await (program.methods as any)
      .finalizeAbandoned()
      .accounts({ house, vault: vaultPk })
      .rpc();
    console.log("finalize_abandoned", sig);
  } catch (e: any) {
    console.log("finalize_abandoned ERR", e?.message ?? e);
    if (e?.getLogs) console.log(await e.getLogs());
    process.exit(1);
  }

  const houseAcct = await (program.account as any).house.fetch(house);
  const finalVault = await (program.account as any).vault.fetch(vaultPk);
  console.log({
    houseActive: (houseAcct.activeVault as PublicKey).toBase58(),
    vaultStatus: Object.keys(finalVault.status)[0],
    abandoned: finalVault.abandoned,
    revealedValue: finalVault.revealedValue,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
