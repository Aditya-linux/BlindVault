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
import { housePda, solanaProvider, TEE_RPC } from "../lib/env";

async function main() {
  const { program, wallet } = solanaProvider();
  const h = await (program.account as any).house.fetch(housePda());
  const vaultPk = h.activeVault as PublicKey;
  const { token } = await getAuthToken(
    TEE_RPC,
    wallet.publicKey,
    async (m) => nacl.sign.detached(m, wallet.secretKey),
  );
  const tee = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");
  const teeProgram = new Program(
    idl as Idl,
    new AnchorProvider(tee, new Wallet(wallet), { commitment: "confirmed" }),
  );
  const bid = PublicKey.findProgramAddressSync(
    [Buffer.from("bid"), vaultPk.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId,
  )[0];
  const sig = await (teeProgram.methods as any)
    .initBidPermission()
    .accounts({
      bidder: wallet.publicKey,
      vault: vaultPk,
      bid,
      bidPermission: permissionPdaFromAccount(bid),
      ephemeralVault: EPHEMERAL_VAULT_ID,
      magicProgram: MAGIC_PROGRAM_ID,
      permissionProgram: PERMISSION_PROGRAM_ID,
    })
    .rpc();
  console.log("init_bid_permission", sig);
  const v = await (teeProgram.account as any).vault.fetch(vaultPk);
  console.log({
    bidCount: v.bidCount,
    left: Number(v.deadlineTs) - Math.floor(Date.now() / 1000),
    status: Object.keys(v.status)[0],
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
