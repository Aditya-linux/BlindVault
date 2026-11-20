"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PublicKey } from "@solana/web3.js";
import { teeConnection } from "@/lib/connections";
import { getReadonlyProgram } from "@/lib/program";
import { hintsPda } from "@/lib/pdas";
import type { DecodedHint, DecodedHints } from "@/lib/types";
import { useTeeAuth } from "./useTeeAuth";

function decodeHints(publicKey: PublicKey, raw: any): DecodedHints {
  const hints = (raw.hints as any[]).map(
    (h): DecodedHint => ({
      kind: Number(h.kind),
      released: Boolean(h.released),
      a: Number(h.a),
      b: Number(h.b),
      releasedTs: Number(h.releasedTs),
    }),
  );
  return {
    publicKey: publicKey.toBase58(),
    vault: (raw.vault as PublicKey).toBase58(),
    hints,
  };
}

export function useHintsLive(
  vaultPk: string | null,
  vaultId?: number | null,
) {
  const { token } = useTeeAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["hints", vaultPk, vaultId ?? null, Boolean(token)],
    enabled: Boolean(vaultPk),
    queryFn: async (): Promise<DecodedHints | null> => {
      if (!vaultPk) return null;
      const vault = new PublicKey(vaultPk);
      const hints = hintsPda(vault);

      if (token) {
        try {
          const program = getReadonlyProgram(teeConnection(token));
          const raw = await (program.account as any).vaultHints.fetch(hints);
          return decodeHints(hints, raw);
        } catch {
          /* fall through */
        }
      }

      if (vaultId && vaultId > 0) {
        const res = await fetch(`/api/vault/${vaultId}`, {
          cache: "no-store",
        });
        if (!res.ok) return null;
        const body = (await res.json()) as { hints?: DecodedHints | null };
        return body.hints ?? null;
      }

      return null;
    },
    refetchInterval: 2_000,
    retry: 2,
  });

  useEffect(() => {
    if (!vaultPk || !token) return;
    const conn = teeConnection(token);
    const hints = hintsPda(new PublicKey(vaultPk));
    const sub = conn.onAccountChange(
      hints,
      () => {
        void qc.invalidateQueries({ queryKey: ["hints", vaultPk] });
      },
      "confirmed",
    );
    return () => {
      void conn.removeAccountChangeListener(sub);
    };
  }, [vaultPk, token, qc]);

  return query;
}
