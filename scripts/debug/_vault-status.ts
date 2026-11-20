import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import { getAuthToken } from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../../target/idl/blind_vault.json";
import { housePda, solanaProvider, TEE_RPC } from "../lib/env";

async function main() {
  const { program, wallet } = solanaProvider();
  const h = await (program.account as any).house.fetch(housePda());
  const vaultPk = h.activeVault as PublicKey;
  console.log("active", vaultPk.toBase58());
  if (vaultPk.equals(PublicKey.default)) {
    console.log("no active vault");
    return;
  }
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
  const v = await (teeProgram.account as any).vault.fetch(vaultPk);
  const now = Math.floor(Date.now() / 1000);
  console.log({
    id: Number(v.id),
    status: Object.keys(v.status)[0],
    bidCount: v.bidCount,
    closedBidCount: v.closedBidCount,
    deadline: Number(v.deadlineTs),
    left: Number(v.deadlineTs) - now,
    minBid: Number(v.minBid) / 1e6,
    highestBid: Number(v.highestBid) / 1e6,
    winner: (v.winner as PublicKey).toBase58(),
    escrow: (v.escrow as PublicKey).toBase58(),
  });
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
