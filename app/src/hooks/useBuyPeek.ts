"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  EPHEMERAL_VAULT_ID,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { teeConnection, solana } from "@/lib/connections";
import { getProgram, getReadonlyProgram } from "@/lib/program";
import {
  associatedTokenPda,
  contentsPda,
  peekPda,
  permissionPda,
  poolLedgerPda,
  housePda,
} from "@/lib/pdas";
import { sendEr, sendSolana } from "@/lib/tx";
import { rarityLabel, categoryLabel } from "@/lib/format";
import type { DecodedVault } from "@/lib/types";
import { useTeeAuth } from "./useTeeAuth";

export type DecodedPeek = {
  publicKey: string;
  vault: string;
  buyer: string;
  slot: number;
  rarity: number;
  category: number;
  rarityLabel: string;
  categoryLabel: string;
};

async function readWithTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out. Check Phantom, then retry.`)), 30_000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function splTransferIx(
  source: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const data = Buffer.alloc(9);
  data[0] = 3; // Transfer
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

function decodePeek(
  raw: {
    vault: PublicKey;
    buyer: PublicKey;
    slot: number;
    rarity: number;
    category: number;
  },
  pk: PublicKey,
): DecodedPeek {
  return {
    publicKey: pk.toBase58(),
    vault: raw.vault.toBase58(),
    buyer: raw.buyer.toBase58(),
    slot: Number(raw.slot),
    rarity: Number(raw.rarity),
    category: Number(raw.category),
    rarityLabel: rarityLabel(Number(raw.rarity)),
    categoryLabel: categoryLabel(Number(raw.category)),
  };
}

/** Private peek for the connected wallet (TEE token required). */
export function useMyPeek(vaultPk: string | null) {
  const { publicKey } = useWallet();
  const tee = useTeeAuth();
  return useQuery({
    queryKey: ["my-peek", vaultPk, publicKey?.toBase58(), Boolean(tee.token)],
    enabled: Boolean(vaultPk && publicKey && tee.token),
    queryFn: async (): Promise<DecodedPeek | null> => {
      if (!vaultPk || !publicKey || !tee.token) return null;
      const conn = teeConnection(tee.token);
      const program = getReadonlyProgram(conn);
      const peek = peekPda(new PublicKey(vaultPk), publicKey);
      const acct = await (program.account as any).peek.fetchNullable(peek);
      if (!acct) return null;
      return decodePeek(acct, peek);
    },
    refetchInterval: 4_000,
  });
}

/**
 * WOW: paid private keyhole peek.
 * 1) Solana: transfer peek_fee SCRIP → house treasury
 * 2) TEE: create Peek PDA + buyer-only ACL
 */
export function useBuyPeek(vault: DecodedVault | null | undefined) {
  const { publicKey, signTransaction, connected } = useWallet();
  const { ensureToken } = useTeeAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSig, setLastSig] = useState<string | null>(null);
  const [feeSig, setFeeSig] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);

  const buyPeek = useCallback(async () => {
    if (!vault) {
      setError("No active vault");
      return null;
    }
    if (!connected || !publicKey || !signTransaction) {
      setError("Connect Phantom or Solflare on Devnet first, then try again.");
      return null;
    }
    if (vault.status !== "Open") {
      setError(`Vault is ${vault.status}, not Open`);
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      setPhase("Checking your private peek");
      const token = await readWithTimeout(ensureToken(), "TEE sign-in");
      if (!token) throw new Error("TEE guest book signature required");
      const conn = teeConnection(token);
      const vaultPk = new PublicKey(vault.publicKey);
      const peek = peekPda(vaultPk, publicKey);
      const priorPeek = await readWithTimeout(
        (getReadonlyProgram(conn).account as any).peek.fetchNullable(peek),
        "Checking previous peek",
      );
      if (priorPeek) {
        await qc.invalidateQueries({ queryKey: ["my-peek"] });
        throw new Error("Your peek is already available. No new fee was charged.");
      }
      const house = housePda();
      const houseAcct = await readWithTimeout<any>((
        getReadonlyProgram(solana).account as any
      ).house.fetch(house), "Reading SCRIP fee");
      const scripMint = houseAcct.scripMint as PublicKey;
      const treasury = houseAcct.treasury as PublicKey;
      const buyerScrip = associatedTokenPda(scripMint, publicKey);
      const peekFee = BigInt(vault.peekFee);

      const wallet = {
        publicKey,
        signTransaction: async (tx: Parameters<typeof signTransaction>[0]) =>
          signTransaction(tx as never) as never,
      };

      const feeKey = `bv_peek_fee_v1:${publicKey.toBase58()}:${vault.id}`;
      let paidSig = localStorage.getItem(feeKey);
      if (paidSig) {
        const status = (await solana.getSignatureStatuses([paidSig])).value[0];
        if (status?.err) {
          localStorage.removeItem(feeKey);
          throw new Error("Previous peek fee failed on Solana. Try Buy peek again.");
        }
        if (!status || !["confirmed", "finalized"].includes(status.confirmationStatus || "")) {
          throw new Error("Peek fee is still processing. Wait and retry; do not pay again.");
        }
      } else {
        setPhase(`Approve the ${Number(peekFee) / 1_000_000} SCRIP fee in Phantom`);
        const fee = await sendSolana(
          solana,
          wallet as never,
          [splTransferIx(buyerScrip, treasury, publicKey, peekFee)],
          {
            vaultId: String(vault.id),
            label: "PEEK FEE · SCRIP → treasury (Solana)",
            onSubmitted: (sig) => localStorage.setItem(feeKey, sig),
          },
        );
        paidSig = fee.sig;
      }
      setFeeSig(paidSig);
      setPhase("Saving your private peek on TEE");
      const program = getProgram(conn, {
        publicKey,
        signTransaction: wallet.signTransaction as never,
        signAllTransactions: async (txs: unknown[]) =>
          Promise.all(
            txs.map((tx) => signTransaction(tx as never)),
          ) as never,
      });
      const contents = contentsPda(vaultPk);
      const poolLedger = poolLedgerPda(house);

      const ix = await (program.methods as any)
        .buyPeek()
        .accounts({
          buyer: publicKey,
          lot: vaultPk,
          contents,
          poolLedger,
          peek,
          peekPermission: permissionPda(peek),
          ephemeralVault: EPHEMERAL_VAULT_ID,
          magicProgram: MAGIC_PROGRAM_ID,
          permissionProgram: PERMISSION_PROGRAM_ID,
        })
        .instruction();

      const result = await Promise.race([
        sendEr(conn, wallet as never, [ix], {
          vaultId: String(vault.id),
          label: "PEEK · private keyhole (buyer-only ACL)",
        }),
        new Promise<never>((_, reject) => setTimeout(
          () => reject(new Error("TEE peek is taking too long. Refresh and retry; your confirmed fee will not be charged again on this device.")),
          90_000,
        )),
      ]);
      setLastSig(result.sig);
      await qc.invalidateQueries({ queryKey: ["my-peek"] });
      await qc.invalidateQueries({ queryKey: ["vault"] });
      return { ...result, feeSig: paidSig };
    } catch (e) {
      setError(friendlyPeekError(e));
      return null;
    } finally {
      setBusy(false);
      setPhase(null);
    }
  }, [vault, connected, publicKey, signTransaction, ensureToken, qc]);

  return { buyPeek, busy, error, lastSig, feeSig, phase };
}

function friendlyPeekError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  if (lower.includes("user rejected") || lower.includes("rejected")) {
    return "You cancelled the wallet popup — try Buy peek again.";
  }
  if (
    lower.includes("insufficient") ||
    lower.includes("need") ||
    lower.includes("balance")
  ) {
    return "Not enough SCRIP for a peek — claim free play money on Paddle.";
  }
  if (
    lower.includes("invalid account data") ||
    lower.includes("simulation failed") ||
    lower.includes("custom program error")
  ) {
    return "Peek couldn’t complete (lot may have closed, or you already peeked). Refresh and try again while the lot is Open.";
  }
  if (lower.includes("not open") || lower.includes("status")) {
    return "Peeks only work while the lot is Open and the clock still has time.";
  }
  return msg.length > 140 ? `${msg.slice(0, 140)}…` : msg;
}
