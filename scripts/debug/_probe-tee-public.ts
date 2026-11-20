import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import idl from "../../target/idl/blind_vault.json";
import { housePda, solanaProvider, TEE_RPC, vaultPda } from "../lib/env";

async function main() {
  const { program, connection } = solanaProvider();
  const house = housePda();
  const h = await (program.account as any).house.fetch(house);
  const active = h.activeVault as PublicKey;
  console.log("active", active.toBase58());
  console.log("nextVaultId", Number(h.nextVaultId));

  const solInfo = await connection.getAccountInfo(active);
  console.log(
    "solana vault",
    solInfo
      ? `owner=${solInfo.owner.toBase58()} len=${solInfo.data.length}`
      : "MISS",
  );
  try {
    const v = await (program.account as any).vault.fetch(active);
    console.log("solana decode", Object.keys(v.status)[0], {
      itemCount: v.itemCount,
      deadline: Number(v.deadlineTs),
    });
  } catch (e: any) {
    console.log("solana decode FAIL", e.message?.slice?.(0, 120));
  }

  const bare = new Connection(TEE_RPC, "confirmed");
  const bareInfo = await bare.getAccountInfo(active);
  console.log(
    "tee bare",
    bareInfo
      ? `owner=${bareInfo.owner.toBase58()} len=${bareInfo.data.length}`
      : "MISS",
  );

  const dummy = Keypair.generate();
  const teeProgram = new Program(
    idl as Idl,
    new AnchorProvider(bare, new Wallet(dummy), { commitment: "confirmed" }),
  );
  try {
    const v = await (teeProgram.account as any).vault.fetch(active);
    console.log("tee bare decode", Object.keys(v.status)[0], {
      itemCount: v.itemCount,
      deadline: Number(v.deadlineTs),
      left: Number(v.deadlineTs) - Math.floor(Date.now() / 1000),
      peeksSold: v.peeksSold,
    });
  } catch (e: any) {
    console.log("tee bare decode FAIL", e.message?.slice?.(0, 200));
  }

  // also try vault 7 by id
  const v7 = vaultPda(house, 7);
  const v7tee = await bare.getAccountInfo(v7);
  console.log("v7 tee", v7.toBase58(), v7tee ? `len=${v7tee.data.length}` : "MISS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
