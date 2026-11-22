"use client";

import { useEffect, useRef } from "react";
import {
  estimateNextLotEta,
  type NextLotEta,
} from "@/lib/nextLotEta";
import type { VaultStatusName } from "@/lib/types";

type Pin = {
  vaultKey: string;
  primaryTs: number;
};

/**
 * Next-auction clock after the lot deadline.
 * One settlement pad only — never soft-rolls a second countdown
 * (that looked like “bidding opens” then restarted without Join).
 */
export function useStableNextLotEta(opts: {
  enabled: boolean;
  deadlineTs: number | null | undefined;
  status: VaultStatusName | undefined;
  nowTs: number;
  vaultId?: number | null;
}): NextLotEta | null {
  const pinRef = useRef<Pin | null>(null);
  const vaultKey = `${opts.vaultId ?? "x"}:${opts.deadlineTs ?? 0}`;

  const raw =
    opts.enabled && opts.deadlineTs
      ? estimateNextLotEta({
          deadlineTs: opts.deadlineTs,
          status: opts.status,
          nowTs: opts.nowTs,
        })
      : null;

  useEffect(() => {
    if (!raw) {
      pinRef.current = null;
      return;
    }
    if (!pinRef.current || pinRef.current.vaultKey !== vaultKey) {
      pinRef.current = {
        vaultKey,
        primaryTs: raw.readyTs,
      };
    } else if (raw.readyTs < pinRef.current.primaryTs) {
      pinRef.current.primaryTs = raw.readyTs;
    }
  }, [raw, vaultKey]);

  if (!raw) return null;

  let primaryTs =
    pinRef.current && pinRef.current.vaultKey === vaultKey
      ? pinRef.current.primaryTs
      : raw.readyTs;
  if (raw.readyTs < primaryTs) primaryTs = raw.readyTs;

  const overdue = opts.nowTs >= primaryTs;
  // Freeze clock at 00:00 once the pad is exhausted — no second countdown.
  const displayReadyTs = overdue ? opts.nowTs : primaryTs;
  const getReady = overdue;

  let phaseLabel = raw.phaseLabel;
  if (overdue) {
    phaseLabel =
      "House is opening the next lot — watch Home for “Join · bid now” (this page won’t unlock bidding)";
  }

  return {
    readyTs: primaryTs,
    displayReadyTs,
    phaseLabel,
    overdue,
    getReady,
  };
}
