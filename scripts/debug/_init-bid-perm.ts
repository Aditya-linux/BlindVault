import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  getAuthToken,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../../target/idl/blind_vault.json";
import { housePda, solanaProvider, TEE_RPC } from "../lib/env";

async function main() {
  const { program, wallet } = solanaProvider();
  const house = housePda();
  const h = await (program.account as any).house.fetch(house);
  const vaultPk = h.activeVault;

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

  const vault = await (teeProgram.account as any).vault.fetch(vaultPk);
  console.log("bid_count", vault.bidCount, "status", Object.keys(vault.status)[0]);

  const bid = PublicKey.findProgramAddressSync(
    [Buffer.from("bid"), vaultPk.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId,
  )[0];
  const bidPermission = permissionPdaFromAccount(bid);
  console.log("bid", bid.toBase58(), "perm", bidPermission.toBase58());

  const bidInfo = await tee.getAccountInfo(bid);
  console.log(
    "tee bid",
    bidInfo
      ? { owner: bidInfo.owner.toBase58().slice(0, 12), len: bidInfo.data.length }
      : null,
  );

  const ix = await (teeProgram.methods as any)
    .initBidPermission()
    .accounts({
      bidder: wallet.publicKey,
      vault: vaultPk,
      bid,
      bidPermission,
      ephemeralVault: EPHEMERAL_VAULT_ID,
      magicProgram: MAGIC_PROGRAM_ID,
      permissionProgram: PERMISSION_PROGRAM_ID,
    })
    .instruction();

  console.log(
    "keys",
    ix.keys.map((k: any) => ({
      pk: k.pubkey.toBase58().slice(0, 12),
      w: k.isWritable,
      s: k.isSigner,
    })),
  );

  const tx = new Transaction().add(ix);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await tee.getLatestBlockhash()).blockhash;
  tx.sign(wallet);
  const sim = await tee.simulateTransaction(tx);
  console.log("err", JSON.stringify(sim.value.err));
  console.log((sim.value.logs || []).join("\n"));
}

main().catch(console.error);
