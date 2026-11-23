/** Devnet-only recovery for an E2E vault whose generated bidder key was lost. */
import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import { getAuthToken } from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../target/idl/blind_vault.json";
import { housePda, poolPda, solanaProvider, TEE_RPC } from "./lib/env";

async function main() {
  const expectedId = Number(process.argv[2]);
  const expectedWinner = new PublicKey(process.argv[3]);
  if (!Number.isSafeInteger(expectedId) || expectedId < 1) {
    throw new Error("Usage: tsx scripts/cleanup-failed-e2e.ts <vault-id> <test-winner-pubkey>");
  }
  const { program, wallet } = solanaProvider();
  const house = housePda();
  const active = (await (program.account as any).house.fetch(house)).activeVault as PublicKey;
  if (active.equals(PublicKey.default)) throw new Error("No active vault to clean");
  const { token } = await getAuthToken(
    TEE_RPC,
    wallet.publicKey,
    async (message) => nacl.sign.detached(message, wallet.secretKey),
  );
  const tee = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");
  const teeProgram = new Program(
    idl as Idl,
    new AnchorProvider(tee, new Wallet(wallet), { commitment: "confirmed" }),
  );
  const vault = await (teeProgram.account as any).vault.fetch(active);
  if (Number(vault.id) !== expectedId || !(vault.winner as PublicKey).equals(expectedWinner)) {
    throw new Error("Active vault does not match the failed test; refusing cleanup");
  }
  if (Object.keys(vault.status)[0] !== "revealed" || Number(vault.bidCount) !== 1) {
    throw new Error("Vault is not the expected single-bid Revealed test");
  }
  const indices = (vault.revealedItems as number[]).slice(0, Number(vault.itemCount));
  const poolLedger = poolPda(house);
  const release = await (teeProgram.methods as any)
    .clearReservedItems(indices)
    .accounts({ authority: wallet.publicKey, house, poolLedger })
    .rpc();
  console.log("clear_reserved_items", indices, release);
  const clear = await (program.methods as any)
    .forceClearActive()
    .accounts({ authority: wallet.publicKey, house, vault: active })
    .rpc();
  console.log("force_clear_active", clear);
  process.exit(0); // TEE websocket otherwise keeps the one-shot cleanup alive.
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
