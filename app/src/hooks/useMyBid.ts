"use client";

import { useQuery } from "@tanstack/react-query";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { teeConnection } from "@/lib/connections";
import { getReadonlyProgram } from "@/lib/program";
import { bidPda } from "@/lib/pdas";
import type { DecodedBid } from "@/lib/types";
import { useTeeAuth } from "./useTeeAuth";

export function useMyBid(vaultPk: string | null) {
  const { publicKey } = useWallet();
  const { token } = useTeeAuth();

  return useQuery({
    queryKey: ["my-bid", vaultPk, publicKey?.toBase58(), Boolean(token)],
    enabled: Boolean(vaultPk && publicKey && token),
    queryFn: async (): Promise<DecodedBid | null> => {
      if (!vaultPk || !publicKey || !token) return null;
      const vault = new PublicKey(vaultPk);
      const bid = bidPda(vault, publicKey);
      const conn = teeConnection(token);
      const program = getReadonlyProgram(conn);
      try {
        const raw = await (program.account as any).bid.fetch(bid);
        return {
          publicKey: bid.toBase58(),
          vault: (raw.vault as PublicKey).toBase58(),
          bidder: (raw.bidder as PublicKey).toBase58(),
          amount: Number(raw.amount),
          bidderIndex: Number(raw.bidderIndex),
          placedTs: Number(raw.placedTs),
        };
      } catch {
        return null;
      }
    },
    refetchInterval: 2_000,
  });
}
