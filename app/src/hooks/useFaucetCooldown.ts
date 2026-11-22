"use client";

import { useQuery } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { getProgram } from "@/lib/program";
import { faucetTicketPda } from "@/lib/pdas";

/** 12h — mirrors programs/blind_vault FAUCET_COOLDOWN */
export const FAUCET_COOLDOWN_SECS = 12 * 3600;

export function useFaucetCooldown() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  return useQuery({
    queryKey: ["faucet-cooldown", publicKey?.toBase58() ?? null],
    enabled: Boolean(publicKey),
    refetchInterval: 15_000,
    queryFn: async () => {
      if (!publicKey) return null;
      const program = getProgram(connection, {
        publicKey,
        signTransaction: async (tx) => {
          if (!signTransaction) throw new Error("Wallet cannot sign");
          return signTransaction(tx);
        },
        signAllTransactions: async (txs) => {
          if (!signTransaction) throw new Error("Wallet cannot sign");
          return Promise.all(txs.map((tx) => signTransaction(tx)));
        },
      });
      const ticket = faucetTicketPda(publicKey);
      const acct = await (program.account as any).faucetTicket.fetchNullable(
        ticket,
      );
      if (!acct) {
        return { lastClaimTs: 0, nextClaimTs: 0, onCooldown: false };
      }
      const lastClaimTs = Number(acct.lastClaimTs);
      const nextClaimTs =
        lastClaimTs > 0 ? lastClaimTs + FAUCET_COOLDOWN_SECS : 0;
      const now = Math.floor(Date.now() / 1000);
      return {
        lastClaimTs,
        nextClaimTs,
        onCooldown: nextClaimTs > now,
      };
    },
  });
}
