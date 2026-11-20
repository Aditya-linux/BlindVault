import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { solanaTxUrl, teeTxUrl } from "./explorer";
import { pushEvidence } from "./evidence";

export type WalletLike = {
  publicKey: PublicKey | null;
  signTransaction: <T extends Transaction>(tx: T) => Promise<T>;
};

export type SendResult = {
  sig: string;
  explorerUrl: string;
};

async function sendOn(
  connection: Connection,
  wallet: WalletLike,
  ixs: TransactionInstruction[],
  layer: "solana" | "tee",
  evidence?: { vaultId: string; label: string },
): Promise<SendResult> {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: wallet.publicKey,
    blockhash,
    lastValidBlockHeight,
  }).add(...ixs);
  const signed = await wallet.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  const explorerUrl = layer === "tee" ? teeTxUrl(sig) : solanaTxUrl(sig);
  if (evidence) {
    pushEvidence({
      vaultId: evidence.vaultId,
      label: evidence.label,
      sig,
      layer,
      at: Date.now(),
    });
  }
  return { sig, explorerUrl };
}

export function sendSolana(
  connection: Connection,
  wallet: WalletLike,
  ixs: TransactionInstruction[],
  evidence?: { vaultId: string; label: string },
): Promise<SendResult> {
  return sendOn(connection, wallet, ixs, "solana", evidence);
}

export function sendEr(
  connection: Connection,
  wallet: WalletLike,
  ixs: TransactionInstruction[],
  evidence?: { vaultId: string; label: string },
): Promise<SendResult> {
  return sendOn(connection, wallet, ixs, "tee", evidence);
}
