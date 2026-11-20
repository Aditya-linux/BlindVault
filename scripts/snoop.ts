/**
 * Proves non-members cannot read private VaultContents / Bid via TEE RPC.
 * Usage: npx tsx scripts/snoop.ts --vault <pubkey> [--bid <pubkey>]
 */
import { getAuthToken } from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { contentsPda, loadKeypair, TEE_RPC } from "./lib/env";

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return null;
}

async function tokenFor(kp: Keypair): Promise<string> {
  const { token } = await getAuthToken(
    TEE_RPC,
    kp.publicKey,
    async (msg) => nacl.sign.detached(msg, kp.secretKey),
  );
  return token;
}

async function main() {
  const vaultArg = arg("vault");
  if (!vaultArg) {
    console.error("Usage: npx tsx scripts/snoop.ts --vault <pubkey>");
    process.exit(1);
  }
  const vault = new PublicKey(vaultArg);
  const contents = contentsPda(vault);
  const stranger = Keypair.generate();
  const house = loadKeypair();

  const strangerTok = await tokenFor(stranger);
  const houseTok = await tokenFor(house);

  const strangerConn = new Connection(
    `${TEE_RPC}?token=${strangerTok}`,
    "confirmed",
  );
  const houseConn = new Connection(`${TEE_RPC}?token=${houseTok}`, "confirmed");

  const snoopContents = await strangerConn.getAccountInfo(contents);
  console.log(
    "stranger → VaultContents:",
    snoopContents ? `DATA len=${snoopContents.data.length}` : "ACCESS DENIED / null",
  );

  // House is not a member of contents either (only vault PDA) — expect deny
  const houseContents = await houseConn.getAccountInfo(contents);
  console.log(
    "house wallet → VaultContents:",
    houseContents ? `DATA len=${houseContents.data.length}` : "ACCESS DENIED / null",
  );

  const bidArg = arg("bid");
  if (bidArg) {
    const bid = new PublicKey(bidArg);
    const snoopBid = await strangerConn.getAccountInfo(bid);
    console.log(
      "stranger → Bid:",
      snoopBid ? `DATA len=${snoopBid.data.length}` : "ACCESS DENIED / null",
    );
  }

  console.log("Snoop complete. Private accounts should return null for non-members.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
