"use client";

import { useEffect, useRef } from "react";
import {
  estimateNextLotEta,
  SOFT_REOPEN_SECS,
  type NextLotEta,
} from "@/lib/nextLotEta";
import type { VaultStatusName } from "@/lib/types";

/** Cap soft rolls — after this, stop the fake clock and show waiting copy. */
const MAX_SOFT_ROLLS = 2;

type Pin = {
  vaultKey: string;
  primaryTs: number;
  softTs: number | null;
  softRolls: number;
};

/**
 * Next-auction clock after the lot deadline.
 * Counts settlement pad once, then at most MAX_SOFT_ROLLS soft windows.
 * Does **not** loop forever at 00:00 — that hid stuck keeper/auto-round.
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
        softTs: null,
        softRolls: 0,
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

  let softTs =
    pinRef.current && pinRef.current.vaultKey === vaultKey
      ? pinRef.current.softTs
      : null;
  let softRolls =
    pinRef.current && pinRef.current.vaultKey === vaultKey
      ? pinRef.current.softRolls
      : 0;

  const overdue = opts.nowTs >= primaryTs;

  if (overdue && softRolls < MAX_SOFT_ROLLS) {
    if (softTs == null) {
      softTs = Math.max(primaryTs, opts.nowTs) + SOFT_REOPEN_SECS;
      softRolls = 1;
    } else if (opts.nowTs >= softTs && softRolls < MAX_SOFT_ROLLS) {
      softTs = opts.nowTs + SOFT_REOPEN_SECS;
      softRolls += 1;
    }
    if (pinRef.current && pinRef.current.vaultKey === vaultKey) {
      pinRef.current.softTs = softTs;
      pinRef.current.softRolls = softRolls;
      pinRef.current.primaryTs = primaryTs;
    } else {
      pinRef.current = { vaultKey, primaryTs, softTs, softRolls };
    }
  }

  const softExhausted = overdue && softRolls >= MAX_SOFT_ROLLS && softTs != null
    ? opts.nowTs >= softTs
    : overdue && softRolls >= MAX_SOFT_ROLLS;

  const displayReadyTs =
    softExhausted
      ? opts.nowTs // clock shows 00:00 but getReady + phase says waiting honestly
      : overdue && softTs != null
        ? softTs
        : primaryTs;

  const secsLeft = Math.max(0, displayReadyTs - opts.nowTs);
  const getReady = softExhausted || (overdue && secsLeft > 0 && secsLeft <= 8);

  let phaseLabel = raw.phaseLabel;
  if (softExhausted) {
    phaseLabel =
      "Waiting for the next lot to open on-chain — refresh Home when Join appears";
  } else if (getReady) {
    phaseLabel = "Stay ready — join as soon as the next lot opens";
  } else if (overdue) {
    phaseLabel = `${raw.phaseLabel} · next window`;
  }

  return {
    readyTs: primaryTs,
    displayReadyTs,
    phaseLabel,
    overdue,
    getReady,
  };
}
