import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import { getAuthToken } from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection } from "@solana/web3.js";
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

  const clientSeed = Math.floor(Math.random() * 256);
  const fillSig = await (teeProgram.methods as any)
    .fillVault(clientSeed)
    .accounts({ vault, hints, contents, poolLedger })
    .rpc();
  console.log("fill_vault", fillSig, "seed", clientSeed);

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
