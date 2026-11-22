"use client";

import { useQuery } from "@tanstack/react-query";
import type { WinningLot } from "@/lib/types";
import { useActiveVault } from "@/hooks/useActiveVault";

export type { WinningLot };

export function useMyWinnings(owner: string | null | undefined) {
  const active = useActiveVault();
  // Refetch when the live lot / nextVaultId changes so wins appear right after reveal.
  const syncKey = `${active.data?.nextVaultId ?? 0}:${active.data?.activeVault?.toBase58() ?? "none"}`;

  return useQuery({
    queryKey: ["winnings", owner ?? null, syncKey],
    enabled: Boolean(owner),
    queryFn: async (): Promise<WinningLot[]> => {
      if (!owner) return [];
      const res = await fetch(
        `/api/winnings?owner=${encodeURIComponent(owner)}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        throw new Error(`winnings api ${res.status}`);
      }
      const body = (await res.json()) as {
        winnings?: WinningLot[];
        error?: string;
      };
      if (body.error && (!body.winnings || body.winnings.length === 0)) {
        throw new Error(body.error);
      }
      return body.winnings ?? [];
    },
    staleTime: 2_000,
    refetchInterval: 5_000,
    retry: 2,
  });
}
