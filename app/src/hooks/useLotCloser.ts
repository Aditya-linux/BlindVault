"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  associatedTokenPda,
  bidPda,
  contentsPda,
  housePda,
  poolLedgerPda,
} from "@/lib/pdas";
import { sendEr } from "@/lib/tx";
import type { DecodedVault } from "@/lib/types";
import { useTeeAuth } from "./useTeeAuth";
import { useMyBid } from "./useMyBid";
import { useActiveVault } from "./useActiveVault";
import { useNowSecs } from "./useNow";

/**
 * After the lot clock hits zero, the sealed bidder must help close:
 * private bids are TEE-gated — the house crank cannot read a stranger's bid.
 * Flow: end_auction → reveal_contents → settle_winning_bid (sole bidder).
 * That unlocks pack popup + Me “Packs you won”.
 */
export function useLotCloser(vault: DecodedVault | null | undefined) {
  const { publicKey, signTransaction } = useWallet();
  const { token, ensureToken } = useTeeAuth();
  const myBid = useMyBid(vault?.publicKey ?? null);
  const house = useActiveVault();
  const qc = useQueryClient();
  const nowTs = useNowSecs();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);
  const [phase, setPhase] = useState<string | null>(null);
  const inflight = useRef(false);
  const autoEndTried = useRef(false);
  const autoSettleTried = useRef(false);

  const pastDeadline =
    Boolean(vault?.deadlineTs) &&
    vault!.deadlineTs > 0 &&
    nowTs >= vault!.deadlineTs;
  // Allow Claim when wallet is connected past deadline — don't wait on myBid
  // fetch (TEE ACL can lag). Sole-bidder lots use this wallet's bid PDA.
  const canEnd =
    vault?.status === "Open" &&
    pastDeadline &&
    Boolean(publicKey) &&
    (Boolean(myBid.data) || (vault.bidCount ?? 0) >= 1);
  const canReveal =
    (vault?.status === "Ended" || vault?.status === "Abandoned") &&
    Boolean(publicKey);
  const canSettle =
    vault?.status === "Revealed" &&
    Boolean(publicKey) &&
    (vault.winner === publicKey?.toBase58() ||
      (vault.bidCount === 1 && Boolean(myBid.data))) &&
    !vault.abandoned;

  const run = useCallback(async () => {
    if (!vault || !publicKey || !signTransaction) return;
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError(null);
    setPhase(null);
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
      const contents = contentsPda(vaultPk);
      const poolLedger = poolLedgerPda(housePda());

      let status = vault.status;

      if (status === "Open" && pastDeadline) {
        if (vault.bidCount !== 1) {
          throw new Error(
            `This lot has ${vault.bidCount} bids — every bidder must help close, or set BIDDERS for the house crank.`,
          );
        }
        // Confirm this wallet actually has the sealed bid before ending.
        try {
          await (program.account as any).bid.fetch(bid);
        } catch {
          throw new Error(
            "No sealed bid found for this wallet on this lot. Connect the wallet that bid, Sign in, then Claim again.",
          );
        }
        setPhase("Closing bidding…");
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
        status = "Ended";
      }

      if (status === "Ended" || status === "Abandoned") {
        setPhase("Revealing pack…");
        const ix = await (program.methods as any)
          .revealContents()
          .accounts({
            vault: vaultPk,
            contents,
            poolLedger,
            contentsPermission: permissionPdaFromAccount(contents),
            ephemeralVault: EPHEMERAL_VAULT_ID,
            magicProgram: MAGIC_PROGRAM_ID,
            permissionProgram: PERMISSION_PROGRAM_ID,
          })
          .instruction();
        const s = await sendEr(
          conn,
          { publicKey, signTransaction },
          [ix],
          { vaultId: String(vault.id), label: "reveal_contents" },
        );
        setSig(s.sig);
        status = "Revealed";
      }

      if (status === "Revealed" && !vault.abandoned) {
        // After end+reveal in one run, winner is this wallet (sole bidder).
        const isWinner =
          vault.winner === publicKey.toBase58() ||
          (vault.status === "Open" && vault.bidCount === 1);
        if (isWinner) {
          if (!house.data?.scripMint || !house.data.treasury) {
            throw new Error("House mint not loaded");
          }
          setPhase("Claiming your pack…");
          const winnerAta = associatedTokenPda(
            house.data.scripMint,
            publicKey,
          );
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
          setPhase("Pack claimed — check Me / Packs you won");
        }
      }

      await qc.invalidateQueries({ queryKey: ["vault"] });
      await qc.invalidateQueries({ queryKey: ["my-bid"] });
      await qc.invalidateQueries({ queryKey: ["house"] });
      await qc.invalidateQueries({ queryKey: ["winnings"] });
      await qc.invalidateQueries({ queryKey: ["vault-history"] });
      await qc.invalidateQueries({ queryKey: ["inventory"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase(null);
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

  // Auto-kick once per phase when guest book is already signed.
  useEffect(() => {
    if (!token || busy || error) return;
    if (canEnd && !autoEndTried.current) {
      autoEndTried.current = true;
      const t = setTimeout(() => void run(), 600);
      return () => clearTimeout(t);
    }
    if ((canSettle || canReveal) && !autoSettleTried.current) {
      autoSettleTried.current = true;
      const t = setTimeout(() => void run(), 600);
      return () => clearTimeout(t);
    }
  }, [canEnd, canSettle, canReveal, token, busy, error, run]);

  return {
    canEnd,
    canReveal,
    canSettle,
    busy,
    error,
    sig,
    phase,
    run,
    pastDeadline,
    hasMyBid: Boolean(myBid.data),
    needsAction: canEnd || canReveal || canSettle,
  };
}
