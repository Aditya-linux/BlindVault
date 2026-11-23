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
  if (!wallet.publicKey) {
    throw new Error("Wallet not connected — connect Phantom/Solflare on Devnet.");
  }
  if (!wallet.signTransaction) {
    throw new Error(
      "This wallet can’t sign transactions. Try Phantom or Solflare.",
    );
  }
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: wallet.publicKey,
    blockhash,
    lastValidBlockHeight,
  }).add(...ixs);
  let signed: Transaction;
  try {
    signed = await wallet.signTransaction(tx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const lower = msg.toLowerCase();
    if (
      lower.includes("user rejected") ||
      lower.includes("rejected") ||
      lower.includes("cancelled") ||
      lower.includes("canceled")
    ) {
      throw new Error("You rejected the wallet popup — try again and approve.");
    }
    if (lower.includes("unexpected") || lower.includes("network")) {
      throw new Error(
        `${msg} — Confirm the wallet is on Devnet, then disconnect and reconnect.`,
      );
    }
    throw e instanceof Error ? e : new Error(msg);
  }
  let sig: string;
  try {
    sig = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const lower = msg.toLowerCase();
    if (
      lower.includes("attempt to debit") ||
      lower.includes("insufficient") ||
      lower.includes("no record of a prior credit")
    ) {
      throw new Error(
        `${msg} — Need Devnet SOL for fees. Switch wallet to Devnet, use faucet.solana.com, reconnect.`,
      );
    }
    throw e instanceof Error ? e : new Error(msg);
  }
  if (layer === "solana") {
    // The same-origin RPC is HTTP only. Poll rather than subscribing to a
    // websocket path that a Next route cannot serve.
    const deadline = Date.now() + 90_000;
    let confirmed = false;
    while (Date.now() < deadline) {
      const status = (await connection.getSignatureStatuses([sig])).value[0];
      if (status?.err) {
        throw new Error(`Solana transaction failed: ${JSON.stringify(status.err)}`);
      }
      if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
        confirmed = true;
        break;
      }
      if ((await connection.getBlockHeight("confirmed")) > lastValidBlockHeight) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
    if (!confirmed) {
      throw new Error("Payment confirmation is still unclear. Tap Claim again; it checks the on-chain receipt before another payment.");
    }
  } else {
    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed",
    );
  }
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
