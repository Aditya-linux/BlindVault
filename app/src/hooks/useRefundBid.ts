"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { useQueryClient } from "@tanstack/react-query";
import { teeConnection } from "@/lib/connections";
import { getProgram } from "@/lib/program";
import { associatedTokenPda, bidPda } from "@/lib/pdas";
import { sendEr } from "@/lib/tx";
import type { DecodedVault } from "@/lib/types";
import { useTeeAuth } from "./useTeeAuth";
import { useMyBid } from "./useMyBid";
import { useActiveVault } from "./useActiveVault";

/**
 * Loser (or any bidder on an abandoned lot) must sign refund_bid —
 * the keeper cannot close a stranger's private bid ACL.
 */
export function useRefundBid(vault: DecodedVault | null | undefined) {
  const { publicKey, signTransaction } = useWallet();
  const { token, ensureToken } = useTeeAuth();
  const myBid = useMyBid(vault?.publicKey ?? null);
  const house = useActiveVault();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);

  const isLoser =
    Boolean(myBid.data) &&
    vault?.status === "Revealed" &&
    !vault.abandoned &&
    Boolean(vault.winner) &&
    vault.winner !== publicKey?.toBase58();

  const isAbandonedBidder =
    Boolean(myBid.data) &&
    vault?.status === "Revealed" &&
    Boolean(vault.abandoned);

  const canRefund = Boolean(isLoser || isAbandonedBidder);

  const refund = useCallback(async () => {
    if (!vault || !publicKey || !signTransaction || !myBid.data) return;
    if (!house.data?.scripMint) {
      setError("House mint not loaded");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const t = token ?? (await ensureToken());
      if (!t) throw new Error("Sign the TEE guest book first");
      const conn = teeConnection(t);
      const program = getProgram(conn, {
        publicKey,
        signTransaction: async (tx) => signTransaction(tx as never) as never,
        signAllTransactions: async (txs) =>
          Promise.all(txs.map((tx) => signTransaction(tx as never))) as never,
      });
      const vaultPk = new PublicKey(vault.publicKey);
      const bid = bidPda(vaultPk, publicKey);
      const bidderScrip = associatedTokenPda(house.data.scripMint, publicKey);
      // Model A: escrow is the bidder SCRIP ATA (vault was SPL delegate).
      const ix = await (program.methods as any)
        .refundBid()
        .accounts({
          bidder: publicKey,
          vault: vaultPk,
          bid,
          bidPermission: permissionPdaFromAccount(bid),
          escrow: bidderScrip,
          bidderScrip,
          ephemeralVault: EPHEMERAL_VAULT_ID,
          magicProgram: MAGIC_PROGRAM_ID,
          permissionProgram: PERMISSION_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();
      const s = await sendEr(
        conn,
        { publicKey, signTransaction },
        [ix],
        { vaultId: String(vault.id), label: "refund_bid" },
      );
      setSig(s.sig);
      await qc.invalidateQueries({ queryKey: ["vault"] });
      await qc.invalidateQueries({ queryKey: ["my-bid"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [
    vault,
    publicKey,
    signTransaction,
    myBid.data,
    house.data,
    token,
    ensureToken,
    qc,
  ]);

  return { canRefund, isLoser, isAbandonedBidder, busy, error, sig, refund };
}
