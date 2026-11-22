"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { creatureDisplayName } from "@/lib/creatureCatalog";
import {
  hasSeenPackPopup,
  markPackPopupSeen,
  upsertPack,
} from "@/lib/packHistory";
import type { StackedItem } from "@/lib/stackInventory";

/**
 * When the connected wallet is the winner and cards are revealed, show the
 * pack popup once per lot (session) and persist the pack to local history.
 */
export function usePackPopup(opts: {
  vaultId: number;
  winner: string | null | undefined;
  cards: StackedItem[];
  ready: boolean;
  highestBid?: number;
}) {
  const { publicKey } = useWallet();
  const owner = publicKey?.toBase58() ?? null;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!opts.ready || !owner || opts.cards.length === 0) return;
    if (!opts.winner || opts.winner !== owner) return;
    if (hasSeenPackPopup(owner, opts.vaultId)) return;

    const names = opts.cards.map((c) => {
      const label = creatureDisplayName(c.index, c.name);
      return c.count > 1 ? `${label} ×${c.count}` : label;
    });

    upsertPack({
      vaultId: opts.vaultId,
      owner,
      names,
      indices: opts.cards.flatMap((c) => c.indices),
      highestBid: opts.highestBid ?? 0,
      at: Date.now(),
    });
    markPackPopupSeen(owner, opts.vaultId);
    setOpen(true);
  }, [
    opts.ready,
    opts.winner,
    opts.vaultId,
    opts.cards,
    opts.highestBid,
    owner,
  ]);

  const dismiss = useCallback(() => setOpen(false), []);

  return { open, dismiss, owner };
}
