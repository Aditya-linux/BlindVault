"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { useQueryClient } from "@tanstack/react-query";
import { teeConnection } from "@/lib/connections";
import { getProgram } from "@/lib/program";
import { peekPda, permissionPda } from "@/lib/pdas";
import { sendEr } from "@/lib/tx";
import { useTeeAuth } from "./useTeeAuth";

/** After reveal, buyer must close their peek before the lot can finalize. */
export function useClosePeek(vaultPk: string | null, vaultId?: number) {
  const { publicKey, signTransaction } = useWallet();
  const { ensureToken } = useTeeAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);

  const close = useCallback(async () => {
    if (!vaultPk || !publicKey || !signTransaction) {
      setError("Connect wallet first");
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      const token = await ensureToken();
      if (!token) throw new Error("TEE guest book signature required");
      const conn = teeConnection(token);
      const program = getProgram(conn, {
        publicKey,
        signTransaction: async (tx) => signTransaction(tx as never) as never,
        signAllTransactions: async (txs) =>
          Promise.all(txs.map((tx) => signTransaction(tx as never))) as never,
      });
      const lot = new PublicKey(vaultPk);
      const peek = peekPda(lot, publicKey);
      const ix = await (program.methods as any)
        .closePeek()
        .accounts({
          buyer: publicKey,
          lot,
          peek,
          peekPermission: permissionPda(peek),
          ephemeralVault: EPHEMERAL_VAULT_ID,
          magicProgram: MAGIC_PROGRAM_ID,
          permissionProgram: PERMISSION_PROGRAM_ID,
        })
        .instruction();
      const result = await sendEr(
        conn,
        { publicKey, signTransaction },
        [ix],
        {
          vaultId: String(vaultId ?? "?"),
          label: "close_peek",
        },
      );
      setSig(result.sig);
      void qc.invalidateQueries({ queryKey: ["vault", vaultPk] });
      void qc.invalidateQueries({ queryKey: ["my-peek", vaultPk] });
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, [vaultPk, vaultId, publicKey, signTransaction, ensureToken, qc]);

  return { close, busy, error, sig };
}
