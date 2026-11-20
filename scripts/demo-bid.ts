/**
 * Faucet → deposit SCRIP to user eATA → place_bid on the active Open vault.
 * Usage: npx tsx scripts/demo-bid.ts [--amount 25]
 */
import { BN, AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  delegateSpl,
  getAuthToken,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../target/idl/blind_vault.json";
import { associatedTokenAddress } from "./lib/ata";
import { housePda, solanaProvider, TEE_RPC } from "./lib/env";

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback ?? "";
}

async function main() {
  const amountScrip = Number(arg("amount", "25"));
  const amount = BigInt(Math.round(amountScrip * 1_000_000));
  const { program, wallet, connection } = solanaProvider();
  const house = housePda();
  const houseAcct = await (program.account as any).house.fetch(house);
  const scripMint = houseAcct.scripMint as PublicKey;
  const vaultPk = houseAcct.activeVault as PublicKey;
  if (vaultPk.equals(PublicKey.default)) {
    throw new Error("No active vault — run open-vault first");
  }

  const userAta = associatedTokenAddress(scripMint, wallet.publicKey);
  const faucetTicket = PublicKey.findProgramAddressSync(
    [Buffer.from("faucet"), wallet.publicKey.toBuffer()],
    program.programId,
  )[0];

  // Faucet if ATA empty / missing
  const ataInfo = await connection.getTokenAccountBalance(userAta).catch(() => null);
  const bal = ataInfo ? BigInt(ataInfo.value.amount) : 0n;
  console.log("SCRIP ATA bal", bal.toString(), "need", amount.toString());
  if (bal < amount) {
    const sig = await (program.methods as any)
      .faucet()
      .accounts({
        user: wallet.publicKey,
        house,
        scripMint,
        userScripAta: userAta,
        faucetTicket,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("faucet", sig);
  }

  // Init + deposit + delegate user eATA (base-layer ixs)
  const teeValidator = new PublicKey(
    "MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo",
  );
  const depositIxs = await delegateSpl(wallet.publicKey, scripMint, amount, {
    payer: wallet.publicKey,
    validator: teeValidator,
    tokenProgram: TOKEN_PROGRAM_ID,
    initIfMissing: true,
    initVaultIfMissing: true,
    initAtasIfMissing: true,
  });
  const depTx = new Transaction().add(...depositIxs);
  const depSig = await sendAndConfirmTransaction(connection, depTx, [wallet], {
    commitment: "confirmed",
  });
  console.log("delegateSpl deposit", depSig);

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
  console.log(
    "vault status",
    Object.keys(vault.status)[0],
    "escrow",
    vault.escrow.toBase58(),
  );
  // Funds stay in bidder ATA; place_bid SPL-approves the vault PDA as delegate.
  const bidderScrip = userAta;

  const bid = PublicKey.findProgramAddressSync(
    [Buffer.from("bid"), vaultPk.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId,
  )[0];

  const placeSig = await (teeProgram.methods as any)
    .placeBid(new BN(amount.toString()))
    .accounts({
      bidder: wallet.publicKey,
      lot: vaultPk,
      bid,
      bidderScrip,
      tokenProgram: TOKEN_PROGRAM_ID,
      magicProgram: MAGIC_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("place_bid", placeSig);

  const permSig = await (teeProgram.methods as any)
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
  console.log("init_bid_permission", permSig);

  const after = await (teeProgram.account as any).vault.fetch(vaultPk);
  console.log("bid_count", after.bidCount);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
