import type { VaultStatusName } from "@/lib/types";

/** Typical keeper settle → finalize → next open, seconds after deadline. */
export const SETTLEMENT_BUDGET_SECS = 90;

/**
 * @deprecated Soft rolls removed — they restarted the “next bid” clock
 * without unlocking Join. Kept for any residual imports.
 */
export const SOFT_REOPEN_SECS = 0;

/**
 * Seconds remaining in the settlement budget after the lot clock hits zero.
 * Stable for a given status — never keyed off "now".
 */
export function settlementPadSecs(status: VaultStatusName | undefined): number {
  switch (status) {
    case "Open":
      return 90;
    case "Ended":
      return 75;
    case "Revealed":
      return 55;
    case "Closed":
      return 35;
    case "Settled":
    case "Abandoned":
      return 25;
    case "Created":
    case "Delegated":
    case "Filling":
      return 40;
    case undefined:
      return SETTLEMENT_BUDGET_SECS;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export type NextLotEta = {
  /** Primary estimate: deadline + status pad. */
  readyTs: number;
  /** What the UI clock counts down to (primary, or pinned soft extension). */
  displayReadyTs: number;
  /** Short status line under the clock. */
  phaseLabel: string;
  /** Primary estimate has passed. */
  overdue: boolean;
  /** Soft extension also passed — get paddle ready, lot may open any moment. */
  getReady: boolean;
};

/**
 * After bidding ends, countdown toward next Open lot.
 * Target is anchored on deadline + settlement pad only — never `now + N`.
 */
export function estimateNextLotEta(opts: {
  deadlineTs: number | null | undefined;
  status: VaultStatusName | undefined;
  nowTs?: number;
}): NextLotEta | null {
  const deadline = opts.deadlineTs ?? 0;
  if (deadline <= 0) return null;

  const now = opts.nowTs ?? Math.floor(Date.now() / 1000);
  if (now < deadline) return null;

  const pad = settlementPadSecs(opts.status);
  const readyTs = deadline + pad;
  const overdue = now >= readyTs;

  let phaseLabel: string;
  switch (opts.status) {
    case "Open":
    case "Ended":
      phaseLabel = overdue
        ? "Wrapping up this lot so the next can open"
        : "Closing this lot, then opening cards";
      break;
    case "Revealed":
      phaseLabel = overdue
        ? "Winner needs to settle to continue"
        : "Cards are visible · winner settling";
      break;
    case "Closed":
      phaseLabel = overdue
        ? "Finishing the round"
        : "Finishing this round · next lot next";
      break;
    case "Settled":
    case "Abandoned":
      phaseLabel = overdue ? "Opening the next auction" : "Opening next auction";
      break;
    default:
      phaseLabel = overdue
        ? "Almost ready for the next auction"
        : "Wrapping up · next auction soon";
      break;
  }

  return {
    readyTs,
    displayReadyTs: readyTs,
    phaseLabel,
    overdue,
    getReady: false,
  };
}
