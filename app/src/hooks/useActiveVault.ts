"use client";

import { useQuery } from "@tanstack/react-query";
import { PublicKey } from "@solana/web3.js";

export type ActiveHouse = {
  house: PublicKey;
  activeVault: PublicKey | null;
  nextVaultId: number;
  scripMint: PublicKey;
  treasury: PublicKey;
  itemCount: number;
  minBid: number[];
  peekFee: number[];
  durationSecs: number[];
};

export function useActiveVault() {
  return useQuery({
    queryKey: ["active-vault"],
    queryFn: async (): Promise<ActiveHouse | null> => {
      const res = await fetch("/api/house", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`house api ${res.status}`);
      }
      const body = (await res.json()) as {
        house: string | null;
        activeVault: string | null;
        nextVaultId?: number;
        scripMint?: string;
        treasury?: string;
        itemCount?: number;
        minBid?: number[];
        peekFee?: number[];
        durationSecs?: number[];
        error?: string;
      };
      if (!body.house) {
        if (body.error) throw new Error(body.error);
        return null;
      }
      return {
        house: new PublicKey(body.house),
        activeVault: body.activeVault
          ? new PublicKey(body.activeVault)
          : null,
        nextVaultId: Number(body.nextVaultId ?? 0),
        scripMint: new PublicKey(body.scripMint!),
        treasury: new PublicKey(body.treasury!),
        itemCount: Number(body.itemCount ?? 0),
        minBid: body.minBid ?? [],
        peekFee: body.peekFee ?? [],
        durationSecs: body.durationSecs ?? [],
      };
    },
    // Faster poll so “Enter lot” appears quickly after settle → new Open.
    refetchInterval: 2_500,
    retry: 2,
    staleTime: 1_000,
  });
}
