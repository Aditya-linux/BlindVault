import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  getAuthToken,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
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

  console.log("touch pool…");
  try {
    const sig = await (teeProgram.methods as any)
      .touchAccount()
      .accounts({ account: poolLedger })
      .rpc();
    console.log("touch_account", sig);
  } catch (e: any) {
    console.log("touch fail", e.message);
    if (e.getLogs) console.log(await e.getLogs(tee));
  }

  const poolInfo = await tee.getAccountInfo(poolLedger);
  console.log(
    "tee pool after touch",
    poolInfo && { owner: poolInfo.owner.toBase58(), len: poolInfo.data.length },
  );

  const permSig = await (teeProgram.methods as any)
    .initPermissions()
    .accounts({
      vault,
      contents,
      poolLedger,
      contentsPermission: permissionPdaFromAccount(contents),
      poolPermission: permissionPdaFromAccount(poolLedger),
      ephemeralVault: EPHEMERAL_VAULT_ID,
      magicProgram: MAGIC_PROGRAM_ID,
      permissionProgram: PERMISSION_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("init_permissions", permSig);

  const clientSeed = Math.floor(Math.random() * 256);
  const fillSig = await (teeProgram.methods as any)
    .fillVault(clientSeed)
    .accounts({ vault, hints, contents, poolLedger })
    .rpc();
  console.log("fill_vault", fillSig);

  const opened = await (teeProgram.account as any).vault.fetch(vault);
  console.log("OPEN", {
    vault: vault.toBase58(),
    status: Object.keys(opened.status)[0],
    deadline: Number(opened.deadlineTs),
    minBid: Number(opened.minBid) / 1e6,
    escrow: opened.escrow.toBase58(),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
