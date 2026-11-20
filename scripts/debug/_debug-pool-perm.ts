import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  getAuthToken,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, SystemProgram, Transaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../../target/idl/blind_vault.json";
import { housePda, poolPda, solanaProvider, TEE_RPC } from "../lib/env";

async function main() {
  const { program, wallet, connection } = solanaProvider();
  const house = housePda();
  const houseAcct = await (program.account as any).house.fetch(house);
  const vault = houseAcct.activeVault;
  const poolLedger = poolPda(house);
  const poolPermission = permissionPdaFromAccount(poolLedger);

  console.log({
    vault: vault.toBase58(),
    pool: poolLedger.toBase58(),
    perm: poolPermission.toBase58(),
  });

  for (const [label, conn] of [
    ["base", connection],
    ["tee", null as any],
  ] as const) {
    let c = conn;
    if (label === "tee") {
      const { token } = await getAuthToken(
        TEE_RPC,
        wallet.publicKey,
        async (msg) => nacl.sign.detached(msg, wallet.secretKey),
      );
      c = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");
    }
    for (const [n, p] of [
      ["pool", poolLedger],
      ["perm", poolPermission],
      ["vault", vault],
    ] as const) {
      const i = await c.getAccountInfo(p);
      console.log(
        label,
        n,
        i
          ? { owner: i.owner.toBase58().slice(0, 12), len: i.data.length, lamports: i.lamports }
          : null,
      );
    }
  }

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
    .initPoolPermission()
    .accounts({
      vault,
      poolLedger,
      poolPermission,
      ephemeralVault: EPHEMERAL_VAULT_ID,
      magicProgram: MAGIC_PROGRAM_ID,
      permissionProgram: PERMISSION_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();

  console.log(
    "keys",
    ix.keys.map((k: any) => ({
      pk: k.pubkey.toBase58().slice(0, 10),
      w: k.isWritable,
      s: k.isSigner,
    })),
  );

  const tx = new Transaction().add(ix);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await tee.getLatestBlockhash()).blockhash;
  tx.sign(wallet);
  const sim = await tee.simulateTransaction(tx);
  console.log("err", sim.value.err);
  console.log("logs\n", (sim.value.logs || []).join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
