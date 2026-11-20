import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  EPHEMERAL_VAULT_ID,
  PERMISSION_PROGRAM_ID,
  getAuthToken,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
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
  const vaultPk = new PublicKey("8pDt6MpKZYgHtCBFq3ubSHiMPuF13tdD1avwVCp2VQQK");
  const { wallet } = solanaProvider();
  const house = housePda();
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

  const ix = await (teeProgram.methods as any)
    .closeRound()
    .accounts({
      payer: wallet.publicKey,
      vault: vaultPk,
      hints: hintsPda(vaultPk),
      contents,
      poolLedger,
      contentsPermission: permissionPdaFromAccount(contents),
      poolPermission: permissionPdaFromAccount(poolLedger),
      ephemeralVault: EPHEMERAL_VAULT_ID,
      permissionProgram: PERMISSION_PROGRAM_ID,
    })
    .instruction();

  console.log(
    "accounts",
    ix.keys.map((k: any) => ({
      pk: k.pubkey.toBase58().slice(0, 12),
      w: k.isWritable,
      s: k.isSigner,
    })),
  );

  const tx = new Transaction().add(ix);
  tx.feePayer = wallet.publicKey;
  const { blockhash } = await tee.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.sign(wallet);

  const sim = await tee.simulateTransaction(tx);
  console.log("err", sim.value.err);
  console.log("logs:\n", (sim.value.logs || []).join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
