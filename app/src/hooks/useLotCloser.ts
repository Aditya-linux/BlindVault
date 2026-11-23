"use client";

import { useCallback, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { useQueryClient } from "@tanstack/react-query";
import { solana, teeConnection } from "@/lib/connections";
import { getProgram } from "@/lib/program";
import {
  associatedTokenPda,
  bidPda,
  contentsPda,
  housePda,
  poolLedgerPda,
  paymentReceiptPda,
} from "@/lib/pdas";
import { sendEr, sendSolana } from "@/lib/tx";
import type { DecodedVault } from "@/lib/types";
import { rememberedBidOnLot } from "@/lib/bidMemory";
import { useTeeAuth } from "./useTeeAuth";
import { useMyBid } from "./useMyBid";
import { useActiveVault } from "./useActiveVault";
import { useNowSecs } from "./useNow";

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new Error(
              `${label} timed out. Check Phantom for a waiting approval (or reject it), then tap Claim again.`,
            ),
          );
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Sealed bidder closes the lot: end → reveal → settle.
 * Manual only (no background auto-run — that left “Closing…” stuck on a Phantom popup).
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
  /** Set when pack is claimed so the page can route to reveal. */
  const [completedVaultId, setCompletedVaultId] = useState<number | null>(null);
  const inflight = useRef(false);

  const pastDeadline =
    Boolean(vault?.deadlineTs) &&
    vault!.deadlineTs > 0 &&
    nowTs >= vault!.deadlineTs;
  const canEnd =
    vault?.status === "Open" &&
    pastDeadline &&
    Boolean(publicKey) &&
    (Boolean(myBid.data) || (vault.bidCount ?? 0) >= 1);
  const canReveal =
    (vault?.status === "Ended" || vault?.status === "Abandoned") &&
    Boolean(publicKey) &&
    // Only the sealed bidder (or sole bidder) needs to drive reveal.
    (Boolean(myBid.data) || (vault.bidCount ?? 0) <= 1);
  // Settle closes the bid PDA — once myBid is gone, Claim must disappear.
  const canSettle =
    vault?.status === "Revealed" &&
    Boolean(publicKey) &&
    !vault.abandoned &&
    vault.winner === publicKey?.toBase58();
  const alreadyDone =
    completedVaultId != null && vault != null && completedVaultId === vault.id;

  const run = useCallback(async () => {
    if (!vault || !publicKey || !signTransaction) return;
    if (inflight.current) return;
    inflight.current = true;
    setBusy(true);
    setError(null);
    setCompletedVaultId(null);
    setPhase("Approve in Phantom…");
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
      const stepMs = 90_000;

      if (status === "Open" && pastDeadline) {
        if (vault.bidCount !== 1) {
          throw new Error(
            `This lot has ${vault.bidCount} bids — every bidder must help close.`,
          );
        }
        const bidInfo = await withTimeout(
          conn.getAccountInfo(bid),
          20_000,
          "Reading your sealed bid",
        );
        if (!bidInfo || bidInfo.data.length < 40) {
          const remembered = rememberedBidOnLot(
            publicKey.toBase58(),
            vault.id,
          );
          throw new Error(
            remembered
              ? "Bid remembered here, but TEE can’t see it for this wallet. Sign in again with the same Phantom account, wait 2s, Claim again."
              : "No sealed bid for this wallet. Switch to the account that bid, Sign in, Claim again.",
          );
        }
        setPhase("Closing the lot — approve in Phantom");
        const ix = await (program.methods as any)
          .endAuction()
          .accounts({ vault: vaultPk })
          .remainingAccounts([
            { pubkey: bid, isWritable: false, isSigner: false },
          ])
          .instruction();
        const s = await withTimeout(
          sendEr(
            conn,
            { publicKey, signTransaction },
            [ix],
            { vaultId: String(vault.id), label: "end_auction" },
          ),
          stepMs,
          "Closing bidding",
        );
        setSig(s.sig);
        status = "Ended";
      }

      if (status === "Ended" || status === "Abandoned") {
        setPhase("Opening the pack — approve in Phantom");
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
        const s = await withTimeout(
          sendEr(
            conn,
            { publicKey, signTransaction },
            [ix],
            { vaultId: String(vault.id), label: "reveal_contents" },
          ),
          stepMs,
          "Revealing pack",
        );
        setSig(s.sig);
        status = "Revealed";
      }

      if (status === "Revealed" && !vault.abandoned) {
        const liveVault = await (program.account as any).vault.fetch(vaultPk);
        const isWinner =
          (liveVault.winner as PublicKey).equals(publicKey) &&
          Object.keys(liveVault.status)[0] === "revealed";
        if (isWinner) {
          if (!house.data?.scripMint || !house.data.treasury) {
            throw new Error("House mint not loaded — refresh and try again");
          }
          const paymentReceipt = paymentReceiptPda(vaultPk, publicKey);
          const baseProgram = getProgram(solana, wallet);
          if (!(await solana.getAccountInfo(paymentReceipt))) {
            setPhase("Pay winning SCRIP on Solana — approve in Phantom");
            const payIx = await (baseProgram.methods as any)
              .payWinningBid(new BN(liveVault.highestBid.toString()))
              .accounts({
                payer: publicKey,
                house: housePda(),
                vault: vaultPk,
                paymentReceipt,
                payerScrip: associatedTokenPda(house.data.scripMint, publicKey),
                treasury: house.data.treasury,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
              })
              .instruction();
            const paid = await withTimeout(
              sendSolana(solana, { publicKey, signTransaction }, [payIx], {
                vaultId: String(vault.id),
                label: "pay_winning_bid",
              }),
              stepMs,
              "Paying winning SCRIP",
            );
            setSig(paid.sig);
          }
          let receiptVisible = false;
          for (let j = 0; j < 15; j++) {
            if (await conn.getAccountInfo(paymentReceipt)) {
              receiptVisible = true;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 2_000));
          }
          if (!receiptVisible) {
            throw new Error("Payment confirmed on Solana. TEE is still syncing; tap Claim again shortly.");
          }
          setPhase("Saving your pack — approve in Phantom");
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
              paymentReceipt,
              escrow: winnerAta,
              treasury: house.data.treasury,
              permissionProgram: PERMISSION_PROGRAM_ID,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .instruction();
          const s = await withTimeout(
            sendEr(
              conn,
              { publicKey, signTransaction },
              [ix],
              { vaultId: String(vault.id), label: "settle_winning_bid" },
            ),
            stepMs,
            "Saving pack",
          );
          setSig(s.sig);
        }
      }

      await qc.invalidateQueries({ queryKey: ["vault"] });
      await qc.invalidateQueries({ queryKey: ["my-bid"] });
      await qc.invalidateQueries({ queryKey: ["house"] });
      await qc.invalidateQueries({ queryKey: ["winnings"] });
      await qc.invalidateQueries({ queryKey: ["vault-history"] });
      await qc.invalidateQueries({ queryKey: ["inventory"] });

      setPhase("Pack ready");
      setCompletedVaultId(vault.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(
        /\b429\b|rate limits exceeded|too many requests/i.test(message)
          ? "Devnet RPC is busy. Tap Claim again shortly. The app checks your payment receipt before asking Phantom to pay again."
          : message,
      );
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

  return {
    canEnd,
    canReveal,
    canSettle,
    busy,
    error,
    sig,
    phase,
    completedVaultId,
    run,
    pastDeadline,
    hasMyBid: Boolean(myBid.data),
    // Hide Claim after a successful run, and after settle (bid PDA closed).
    needsAction: !alreadyDone && (canEnd || canReveal || canSettle),
  };
}
