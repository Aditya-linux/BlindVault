/**
 * Vault 7: revealed + abandoned with open peek → close_peek → close_round → finalize.
 */
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
  hintsPda,
  housePda,
  poolPda,
  solanaProvider,
  TEE_RPC,
} from "../lib/env";

function statusName(status: unknown): string {
  if (status && typeof status === "object") {
    return Object.keys(status as object)[0] ?? "unknown";
  }
  return String(status);
}

async function main() {
  const { program, wallet, connection } = solanaProvider();
  const house = housePda();
  const houseAcct = await (program.account as any).house.fetch(house);
  const vaultPk = houseAcct.activeVault as PublicKey;
  if (vaultPk.equals(PublicKey.default)) throw new Error("no active vault");

  const hints = hintsPda(vaultPk);
  const contents = contentsPda(vaultPk);
  const poolLedger = poolPda(house);
  const peek = PublicKey.findProgramAddressSync(
    [Buffer.from("peek"), vaultPk.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId,
  )[0];

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
  let status = statusName(vault.status);
  console.log("start", {
    status,
    abandoned: vault.abandoned,
    peeksSold: vault.peeksSold,
    closedPeeks: vault.closedPeekCount,
    bids: vault.bidCount,
  });

  if (status === "revealed" && Number(vault.peeksSold) > Number(vault.closedPeekCount)) {
    const peekInfo = await tee.getAccountInfo(peek);
    console.log("peek", peek.toBase58(), peekInfo ? `len=${peekInfo.data.length}` : "MISS");
    if (peekInfo) {
      const sig = await (teeProgram.methods as any)
        .closePeek()
        .accounts({
          buyer: wallet.publicKey,
          lot: vaultPk,
          peek,
          peekPermission: permissionPdaFromAccount(peek),
          ephemeralVault: EPHEMERAL_VAULT_ID,
          magicProgram: MAGIC_PROGRAM_ID,
          permissionProgram: PERMISSION_PROGRAM_ID,
        })
        .rpc();
      console.log("close_peek", sig);
      vault = await (teeProgram.account as any).vault.fetch(vaultPk);
      status = statusName(vault.status);
      console.log("after close_peek", {
        closedPeeks: vault.closedPeekCount,
        peeksSold: vault.peeksSold,
      });
    }
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

  console.log("waiting undelegate…");
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
  console.error("FAIL", e.message?.slice?.(0, 400) ?? e);
  if (e.getLogs) e.getLogs().then((l: string[]) => console.error(l?.slice(-20)));
  process.exit(1);
});
