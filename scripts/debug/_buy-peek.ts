/**
 * Live WOW: pay peek fee on Solana → buy_peek on TEE (private Peek ACL).
 */
import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAuthToken,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../../target/idl/blind_vault.json";
import { associatedTokenAddress } from "../lib/ata";
import {
  contentsPda,
  housePda,
  poolPda,
  solanaProvider,
  TEE_RPC,
} from "../lib/env";

function splTransferIx(
  source: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const data = Buffer.alloc(9);
  data[0] = 3;
  data.writeBigUInt64LE(amount, 1);
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data,
  });
}

async function main() {
  const { program, wallet, connection } = solanaProvider();
  const house = housePda();
  const houseAcct = await (program.account as any).house.fetch(house);
  const vaultPk = houseAcct.activeVault as PublicKey;
  if (vaultPk.equals(PublicKey.default)) throw new Error("no active vault");
  const scripMint = houseAcct.scripMint as PublicKey;
  const treasury = houseAcct.treasury as PublicKey;
  const contents = contentsPda(vaultPk);
  const poolLedger = poolPda(house);
  const buyerScrip = associatedTokenAddress(scripMint, wallet.publicKey);
  const peek = PublicKey.findProgramAddressSync(
    [Buffer.from("peek"), vaultPk.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId,
  )[0];

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
  const status = Object.keys(vault.status)[0];
  const left = Number(vault.deadlineTs) - Math.floor(Date.now() / 1000);
  const peekFee = BigInt(Number(vault.peekFee));
  console.log("pre", {
    vault: vaultPk.toBase58(),
    status,
    left,
    peekFee: Number(peekFee) / 1e6,
    peeksSold: vault.peeksSold,
    peek: peek.toBase58(),
  });
  if (status !== "open") throw new Error(`vault not open: ${status}`);
  if (left < 30) throw new Error(`deadline too close: ${left}s`);

  const feeTx = new Transaction().add(
    splTransferIx(buyerScrip, treasury, wallet.publicKey, peekFee),
  );
  const feeSig = await sendAndConfirmTransaction(connection, feeTx, [wallet], {
    commitment: "confirmed",
  });
  console.log("peek_fee Solana PASS", feeSig);

  if (await tee.getAccountInfo(peek)) {
    console.log("peek already exists");
    return;
  }

  const sig = await (teeProgram.methods as any)
    .buyPeek()
    .accounts({
      buyer: wallet.publicKey,
      lot: vaultPk,
      contents,
      poolLedger,
      peek,
      peekPermission: permissionPdaFromAccount(peek),
      ephemeralVault: EPHEMERAL_VAULT_ID,
      magicProgram: MAGIC_PROGRAM_ID,
      permissionProgram: PERMISSION_PROGRAM_ID,
    })
    .rpc();
  console.log("buy_peek PASS", sig);

  const peekAcct = await (teeProgram.account as any).peek.fetch(peek);
  console.log("peek private", {
    slot: peekAcct.slot,
    rarity: peekAcct.rarity,
    category: peekAcct.category,
    buyer: peekAcct.buyer.toBase58(),
  });

  const bare = new Connection(TEE_RPC, "confirmed");
  const denied = await bare.getAccountInfo(peek);
  console.log(
    "snoop without TEE token",
    denied ? `LEAK len=${denied.data.length}` : "ACCESS DENIED (expected)",
  );
}

main().catch((e) => {
  console.error("FAIL", e.message?.slice?.(0, 500) ?? e);
  if (e.getLogs) e.getLogs().then((l: string[]) => console.error(l?.slice(-25)));
  process.exit(1);
});
