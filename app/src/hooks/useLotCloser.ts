"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
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
 * After the lot clock hits zero, the winning bidder must help close:
 * private bids are TEE-gated — the house crank cannot read a stranger's bid.
 * This hook ends the auction (and settles if you're the winner) from the
 * connected wallet so the next lot can open.
 */
export function useLotCloser(vault: DecodedVault | null | undefined) {
  const { publicKey, signTransaction } = useWallet();
  const { token, ensureToken } = useTeeAuth();
  const myBid = useMyBid(vault?.publicKey ?? null);
  const house = useActiveVault();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);
  const inflight = useRef(false);
  const autoTried = useRef(false);

  const nowTs = Math.floor(Date.now() / 1000);
  const pastDeadline =
    Boolean(vault?.deadlineTs) &&
    vault!.deadlineTs > 0 &&
    nowTs >= vault!.deadlineTs;
  const canEnd =
    vault?.status === "Open" && pastDeadline && Boolean(myBid.data);
  const canSettle =
    vault?.status === "Revealed" &&
    Boolean(publicKey) &&
    vault.winner === publicKey?.toBase58() &&
    !vault.abandoned;

  const run = useCallback(async () => {
    if (!vault || !publicKey || !signTransaction) return;
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError(null);
    try {
      const t = token ?? (await ensureToken());
      if (!t) throw new Error("Sign the TEE guest book first");
      const conn = teeConnection(t);
      const wallet = {
        publicKey,
        signTransaction: async <T>(tx: T) => signTransaction(tx as never) as T,
        signAllTransactions: async <T>(txs: T[]) =>
          Promise.all(txs.map((tx) => signTransaction(tx as never) as T)),
      };
      const program = getProgram(conn, wallet);
      const vaultPk = new PublicKey(vault.publicKey);
      const bid = bidPda(vaultPk, publicKey);

      if (vault.status === "Open" && pastDeadline) {
        if (!myBid.data) {
          throw new Error(
            "Only a sealed bidder can end this lot (bids stay private).",
          );
        }
        if (vault.bidCount !== 1) {
          throw new Error(
            `This lot has ${vault.bidCount} bids — every bidder must be passed to end. Ask the house to crank with BIDDERS=…`,
          );
        }
        const ix = await (program.methods as any)
          .endAuction()
          .accounts({ vault: vaultPk })
          .remainingAccounts([
            { pubkey: bid, isWritable: false, isSigner: false },
          ])
          .instruction();
        const s = await sendEr(
          conn,
          { publicKey, signTransaction },
          [ix],
          { vaultId: String(vault.id), label: "end_auction" },
        );
        setSig(s.sig);
      } else if (
        vault.status === "Revealed" &&
        vault.winner === publicKey.toBase58() &&
        !vault.abandoned
      ) {
        if (!house.data?.scripMint || !house.data.treasury) {
          throw new Error("House mint not loaded");
        }
        const winnerAta = associatedTokenPda(house.data.scripMint, publicKey);
        const ix = await (program.methods as any)
          .settleWinningBid()
          .accounts({
            closer: publicKey,
            lot: vaultPk,
            bid,
            bidPermission: permissionPdaFromAccount(bid),
            escrow: winnerAta,
            treasury: house.data.treasury,
            permissionProgram: PERMISSION_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction();
        const s = await sendEr(
          conn,
          { publicKey, signTransaction },
          [ix],
          { vaultId: String(vault.id), label: "settle_winning_bid" },
        );
        setSig(s.sig);
      }

      await qc.invalidateQueries({ queryKey: ["vault"] });
      await qc.invalidateQueries({ queryKey: ["my-bid"] });
      await qc.invalidateQueries({ queryKey: ["house"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      inflight.current = false;
    }
  }, [
    vault,
    publicKey,
    signTransaction,
    token,
    ensureToken,
    myBid.data,
    pastDeadline,
    house.data,
    qc,
  ]);

  // Auto-kick once only when guest book is already signed — never spawn
  // surprise Phantom “Sign message” popups from the background.
  useEffect(() => {
    if (!canEnd && !canSettle) return;
    if (!token) return;
    if (busy || error || autoTried.current) return;
    autoTried.current = true;
    const t = setTimeout(() => {
      void run();
    }, 800);
    return () => clearTimeout(t);
  }, [canEnd, canSettle, token, busy, error, run]);

  return {
    canEnd,
    canSettle,
    busy,
    error,
    sig,
    run,
    pastDeadline,
    hasMyBid: Boolean(myBid.data),
  };
}
