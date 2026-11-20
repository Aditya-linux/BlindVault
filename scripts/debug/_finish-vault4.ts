/**
 * Finish Vault4: pool/contents perms → fill → report Open state.
 */
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
  const vault = houseAcct.activeVault;
  const hints = hintsPda(vault);
  const contents = contentsPda(vault);
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

  const vaultAcct = await (teeProgram.account as any).vault.fetch(vault);
  console.log("status", Object.keys(vaultAcct.status)[0], "escrow", vaultAcct.escrow.toBase58());

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
  } catch (e: any) {
    console.log("init_pool_permission:", e.message?.slice(0, 160));
  }

  try {
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
  } catch (e: any) {
    console.log("init_contents_permission:", e.message?.slice(0, 160));
  }

  const seed = Math.floor(Math.random() * 256);
  const fillSig = await (teeProgram.methods as any)
    .fillVault(seed)
    .accounts({ vault, hints, contents, poolLedger })
    .rpc();
  console.log("fill_vault", fillSig, "seed", seed);

  const opened = await (teeProgram.account as any).vault.fetch(vault);
  console.log("OPEN", {
    vault: vault.toBase58(),
    status: Object.keys(opened.status)[0],
    deadline: Number(opened.deadlineTs),
    left: Number(opened.deadlineTs) - Math.floor(Date.now() / 1000),
    minBid: Number(opened.minBid) / 1e6,
    escrow: opened.escrow.toBase58(),
    itemCount: opened.itemCount,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
