"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PublicKey } from "@solana/web3.js";
import { teeConnection } from "@/lib/connections";
import { getReadonlyProgram } from "@/lib/program";
import {
  revealedItemsVisible,
  vaultStatusName,
  type DecodedVault,
} from "@/lib/types";
import { useTeeAuth } from "./useTeeAuth";

function decodeVault(publicKey: PublicKey, raw: any): DecodedVault {
  const status = vaultStatusName(raw.status);
  return {
    publicKey: publicKey.toBase58(),
    house: (raw.house as PublicKey).toBase58(),
    id: Number(raw.id),
    size: Number(raw.size),
    itemCount: Number(raw.itemCount),
    minBid: Number(raw.minBid),
    peekFee: Number(raw.peekFee),
    durationSecs: Number(raw.durationSecs),
    openTs: Number(raw.openTs),
    deadlineTs: Number(raw.deadlineTs),
    hintTimes: (raw.hintTimes as (bigint | number)[]).map(Number),
    status,
    bidCount: Number(raw.bidCount),
    peeksSold: Number(raw.peeksSold),
    highestBid: Number(raw.highestBid),
    winner: (raw.winner as PublicKey).toBase58(),
    revealedItems: revealedItemsVisible(status)
      ? (raw.revealedItems as (number | bigint)[])
          .map(Number)
          .slice(0, Number(raw.itemCount))
      : [],
    revealedValue: Number(raw.revealedValue),
    escrow: (raw.escrow as PublicKey).toBase58(),
    abandoned: Boolean(raw.abandoned),
  };
}

async function fetchViaApi(vaultPk: string): Promise<DecodedVault | null> {
  // Derive id from chain is hard client-side; API accepts numeric id in path.
  // Callers always use vaultPda(house, id) so the page knows id from the route.
  return null;
}

export function useVaultLive(vaultPk: string | null, vaultId?: number | null) {
  const { token } = useTeeAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["vault", vaultPk, vaultId ?? null, Boolean(token)],
    enabled: Boolean(vaultPk),
    queryFn: async (): Promise<DecodedVault | null> => {
      if (!vaultPk) return null;
      const pk = new PublicKey(vaultPk);

      // Prefer authenticated TEE when guest book is signed (also enables WS).
      if (token) {
        try {
          const program = getReadonlyProgram(teeConnection(token));
          const raw = await (program.account as any).vault.fetch(pk);
          return decodeVault(pk, raw);
        } catch {
          /* fall through to API */
        }
      }

      // Browser → MagicBlock TEE is CORS-blocked; use server proxy.
      if (vaultId && vaultId > 0) {
        const res = await fetch(`/api/vault/${vaultId}`, {
          cache: "no-store",
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { vault?: DecodedVault };
        return body.vault ?? null;
      }

      // Last resort: try matching by scanning is not available — null.
      return fetchViaApi(vaultPk);
    },
    refetchInterval: 2_000,
    retry: 2,
  });

  useEffect(() => {
    if (!vaultPk || !token) return;
    const conn = teeConnection(token);
    const pk = new PublicKey(vaultPk);
    const sub = conn.onAccountChange(
      pk,
      () => {
        void qc.invalidateQueries({ queryKey: ["vault", vaultPk] });
      },
      "confirmed",
    );
    return () => {
      void conn.removeAccountChangeListener(sub);
    };
  }, [vaultPk, token, qc]);

  return query;
}
