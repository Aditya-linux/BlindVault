"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { BN } from "@coral-xyz/anchor";
import { teeConnection } from "@/lib/connections";
import { getProgram } from "@/lib/program";
import { bidPda, permissionPda, associatedTokenPda } from "@/lib/pdas";
import { sendEr } from "@/lib/tx";
import type { DecodedVault } from "@/lib/types";
import { useTeeAuth } from "./useTeeAuth";
import { useQueryClient } from "@tanstack/react-query";

export function usePlaceBid(vault: DecodedVault | null | undefined) {
  const { publicKey, signTransaction } = useWallet();
  const { ensureToken } = useTeeAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSig, setLastSig] = useState<string | null>(null);

  const placeBid = useCallback(
    async (amountScrip: number) => {
      if (!vault) {
        setError("No active vault");
        return null;
      }
      if (!publicKey || !signTransaction) {
        setError("Connect a wallet first");
        return null;
      }
      if (vault.status !== "Open") {
        setError(`Vault is ${vault.status}, not Open`);
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
        const vaultPk = new PublicKey(vault.publicKey);
        const bid = bidPda(vaultPk, publicKey);
        // Model A: TEE balances are canonical ATAs after delegateSpl.
        const houseAcct = await (program.account as any).house.fetch(
          new PublicKey(vault.house),
        );
        const scripMint = houseAcct.scripMint as PublicKey;
        const bidderScrip = associatedTokenPda(scripMint, publicKey);
        const amount = new BN(Math.round(amountScrip * 1_000_000));

        const placeIx = await (program.methods as any)
          .placeBid(amount)
          .accounts({
            bidder: publicKey,
            lot: vaultPk,
            bid,
            bidderScrip,
            tokenProgram: TOKEN_PROGRAM_ID,
            magicProgram: MAGIC_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();

        const permIx = await (program.methods as any)
          .initBidPermission()
          .accounts({
            bidder: publicKey,
            vault: vaultPk,
            bid,
            bidPermission: permissionPda(bid),
            ephemeralVault: EPHEMERAL_VAULT_ID,
            magicProgram: MAGIC_PROGRAM_ID,
            permissionProgram: PERMISSION_PROGRAM_ID,
          })
          .instruction();

        const result = await sendEr(
          conn,
          { publicKey, signTransaction },
          [placeIx, permIx],
          { vaultId: String(vault.id), label: "place_bid + init_bid_permission" },
        );
        setLastSig(result.sig);
        void qc.invalidateQueries({ queryKey: ["vault", vault.publicKey] });
        void qc.invalidateQueries({ queryKey: ["my-bid", vault.publicKey] });
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [vault, publicKey, signTransaction, ensureToken, qc],
  );

  return { placeBid, busy, error, lastSig };
}
