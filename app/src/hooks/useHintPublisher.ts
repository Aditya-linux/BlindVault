"use client";

import { useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { teeConnection } from "@/lib/connections";
import { getProgram } from "@/lib/program";
import { contentsPda, hintsPda, poolLedgerPda } from "@/lib/pdas";
import { sendEr } from "@/lib/tx";
import type { DecodedVault } from "@/lib/types";
import { useTeeAuth } from "./useTeeAuth";
import { useHintsLive } from "./useHintsLive";

/** Auto-publish due hints from any connected client (keeper is backup). */
export function useHintPublisher(vault: DecodedVault | null | undefined) {
  const { publicKey, signTransaction } = useWallet();
  const { token, ensureToken } = useTeeAuth();
  const hintsQ = useHintsLive(vault?.publicKey ?? null, vault?.id ?? null);
  const inflight = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!vault || vault.status !== "Open") return;
    if (!publicKey || !signTransaction) return;

    const tick = async () => {
      const hints = hintsQ.data?.hints;
      if (!hints) return;
      const now = Math.floor(Date.now() / 1000);
      for (let i = 0; i < hints.length; i++) {
        if (hints[i].released) continue;
        if (now < vault.hintTimes[i]) continue;
        if (inflight.current.has(i)) continue;
        inflight.current.add(i);
        try {
          const t = token ?? (await ensureToken());
          if (!t) continue;
          const conn = teeConnection(t);
          const program = getProgram(conn, {
            publicKey,
            signTransaction: async (tx) => signTransaction(tx),
            signAllTransactions: async (txs) =>
              Promise.all(txs.map((tx) => signTransaction(tx))),
          });
          const vaultPk = new PublicKey(vault.publicKey);
          const house = new PublicKey(vault.house);
          const ix = await (program.methods as any)
            .publishHint(i)
            .accounts({
              vault: vaultPk,
              hints: hintsPda(vaultPk),
              contents: contentsPda(vaultPk),
              poolLedger: poolLedgerPda(house),
            })
            .instruction();
          await sendEr(
            conn,
            { publicKey, signTransaction },
            [ix],
            { vaultId: String(vault.id), label: `publish_hint(${i})` },
          );
        } catch {
          /* HintAlreadyReleased or race — swallow */
        } finally {
          inflight.current.delete(i);
        }
      }
    };

    const id = setInterval(() => {
      void tick();
    }, 1_000);
    return () => clearInterval(id);
  }, [
    vault,
    publicKey,
    signTransaction,
    token,
    ensureToken,
    hintsQ.data,
  ]);

}
