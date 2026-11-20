import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAuthToken,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../../target/idl/blind_vault.json";
import { associatedTokenAddress } from "../lib/ata";
import { housePda, solanaProvider, TEE_RPC } from "../lib/env";

async function main() {
  const { program, wallet } = solanaProvider();
  const house = housePda();
  const h = await (program.account as any).house.fetch(house);
  const vaultPk = h.activeVault as PublicKey;
  const mint = h.scripMint as PublicKey;
  const treasury = h.treasury as PublicKey;

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

  const vault = await (teeProgram.account as any).vault.fetch(vaultPk);
  console.log({
    status: Object.keys(vault.status)[0],
    winner: vault.winner.toBase58(),
    high: Number(vault.highestBid) / 1e6,
    closed: vault.closedBidCount,
    bids: vault.bidCount,
  });

  const bid = PublicKey.findProgramAddressSync(
    [Buffer.from("bid"), vaultPk.toBuffer(), vault.winner.toBuffer()],
    program.programId,
  )[0];
  const winnerAta = associatedTokenAddress(mint, vault.winner);

  for (const [n, p] of [
    ["bid", bid],
    ["winnerAta", winnerAta],
    ["treasury", treasury],
    ["perm", permissionPdaFromAccount(bid)],
  ] as const) {
    const i = await tee.getAccountInfo(p);
    console.log(
      "tee",
      n,
      i
        ? { owner: i.owner.toBase58().slice(0, 12), len: i.data.length }
        : null,
    );
  }

  // Use on-curve operator ATA as treasury sink (house PDA ATA is PER-private).
  const operatorTreasury = associatedTokenAddress(mint, wallet.publicKey);

  const ix = await (teeProgram.methods as any)
    .settleWinningBid()
    .accounts({
      lot: vaultPk,
      bid,
      bidPermission: permissionPdaFromAccount(bid),
      escrow: winnerAta,
      treasury: operatorTreasury,
      permissionProgram: PERMISSION_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
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
