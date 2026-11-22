"use client";

import { useQuery } from "@tanstack/react-query";
import type { HistoryLot } from "@/lib/types";

export type { HistoryLot };

export function useVaultHistory() {
  return useQuery({
    queryKey: ["vault-history"],
    queryFn: async (): Promise<{
      nextVaultId: number;
      activeVault: string | null;
      lots: HistoryLot[];
    }> => {
      const res = await fetch("/api/history", { cache: "no-store" });
      if (!res.ok) throw new Error(`history api ${res.status}`);
      const body = (await res.json()) as {
        nextVaultId?: number;
        activeVault?: string | null;
        lots?: HistoryLot[];
        error?: string;
      };
      if (body.error && (!body.lots || body.lots.length === 0)) {
        throw new Error(body.error);
      }
      return {
        nextVaultId: Number(body.nextVaultId ?? 0),
        activeVault: body.activeVault ?? null,
        lots: body.lots ?? [],
      };
    },
    // Keep history in step with house/lot polls so timers + prizes stay synced.
    refetchInterval: 5_000,
    staleTime: 2_000,
    retry: 2,
  });
}
