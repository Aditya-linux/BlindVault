/**
 * End → reveal → close_round → finalize_abandoned for the active Open vault (0 bids).
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
  const { program, wallet, connection } = solanaProvider();
  const house = housePda();
  const houseAcct = await (program.account as any).house.fetch(house);
  const vaultPk = houseAcct.activeVault as PublicKey;
  if (vaultPk.equals(PublicKey.default)) throw new Error("no active vault");

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
  console.log("vault", vaultPk.toBase58(), "status", Object.keys(vault.status)[0], {
    bidCount: vault.bidCount,
    deadline: Number(vault.deadlineTs),
    now: Math.floor(Date.now() / 1000),
  });

  let status = Object.keys(vault.status)[0];

  if (status === "open") {
    const sig = await (teeProgram.methods as any)
      .endAuction()
      .accounts({ vault: vaultPk })
      .remainingAccounts([])
      .rpc();
    console.log("end_auction", sig);
    vault = await (teeProgram.account as any).vault.fetch(vaultPk);
    status = Object.keys(vault.status)[0];
    console.log("after end", status, "abandoned", vault.abandoned);
  }

  if (status === "abandoned" || status === "ended") {
    const sig = await (teeProgram.methods as any)
      .revealContents()
      .accounts({
        vault: vaultPk,
        contents,
        poolLedger,
        contentsPermission: permissionPdaFromAccount(contents),
        ephemeralVault: EPHEMERAL_VAULT_ID,
        permissionProgram: PERMISSION_PROGRAM_ID,
      })
      .rpc();
    console.log("reveal_contents", sig);
    vault = await (teeProgram.account as any).vault.fetch(vaultPk);
    status = Object.keys(vault.status)[0];
  }

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
  }

  console.log("waiting for undelegation…");
  for (let i = 0; i < 60; i++) {
    const info = await connection.getAccountInfo(vaultPk);
    if (info && info.owner.equals(program.programId)) {
      console.log("undelegated after", i * 2, "s");
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  const fin = await (program.methods as any)
    .finalizeAbandoned()
    .accounts({ house, vault: vaultPk })
    .rpc();
  console.log("finalize_abandoned", fin);

  const after = await (program.account as any).house.fetch(house);
  console.log("houseActive", (after.activeVault as PublicKey).toBase58());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
