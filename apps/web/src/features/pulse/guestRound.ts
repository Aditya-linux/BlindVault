import type { CallDirection } from "../../chain/program";

export type GuestRoundPhase =
  | "idle"
  | "armed"
  | "live"
  | "settled";

export type GuestRound = {
  phase: GuestRoundPhase;
  direction: CallDirection | null;
  durationSecs: number;
  openPrice: number | null;
  settlePrice: number | null;
  openedAtMs: number | null;
  expiresAtMs: number | null;
  won: boolean | null;
  tie: boolean;
  /** Practice points only — never claimed as onchain value. */
  pointsDelta: number;
  message: string;
};

export type GuestLedger = {
  points: number;
  wins: number;
  losses: number;
  ties: number;
  streak: number;
};

const LEDGER_KEY = "pulse.call.guest.ledger";
const DEFAULT_DURATION = 8;
const WIN_POINTS = 18;
const LOSS_POINTS = -10;

export function createGuestRound(durationSecs = DEFAULT_DURATION): GuestRound {
  return {
    phase: "idle",
    direction: null,
    durationSecs,
    openPrice: null,
    settlePrice: null,
    openedAtMs: null,
    expiresAtMs: null,
    won: null,
    tie: false,
    pointsDelta: 0,
    message: "Pick UP or DOWN for a guest practice call (not onchain).",
  };
}

export function loadGuestLedger(): GuestLedger {
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    if (!raw) {
      return { points: 100, wins: 0, losses: 0, ties: 0, streak: 0 };
    }
    const parsed = JSON.parse(raw) as GuestLedger;
    if (typeof parsed.points !== "number") {
      return { points: 100, wins: 0, losses: 0, ties: 0, streak: 0 };
    }
    return parsed;
  } catch {
    return { points: 100, wins: 0, losses: 0, ties: 0, streak: 0 };
  }
}

export function saveGuestLedger(ledger: GuestLedger): void {
  localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
}

export function armGuestRound(
  direction: CallDirection,
  durationSecs: number,
): GuestRound {
  return {
    ...createGuestRound(durationSecs),
    phase: "armed",
    direction,
    message: `Armed ${direction.toUpperCase()} for ${durationSecs}s. Confirm with live oracle open price.`,
  };
}

export function openGuestRound(
  round: GuestRound,
  openPriceDisplay: string,
  nowMs = Date.now(),
): GuestRound {
  if (round.phase !== "armed" || !round.direction) {
    return {
      ...round,
      message: "Arm a direction before opening a guest round.",
    };
  }
  const openPrice = Number(openPriceDisplay);
  if (!Number.isFinite(openPrice)) {
    return {
      ...round,
      message: "Need a live oracle price to open (guest practice still requires ER feed).",
    };
  }
  return {
    ...round,
    phase: "live",
    openPrice,
    openedAtMs: nowMs,
    expiresAtMs: nowMs + round.durationSecs * 1000,
    message: `Guest LIVE ${round.direction.toUpperCase()} @ ${openPriceDisplay}. Practice only.`,
  };
}

export function settleGuestRound(
  round: GuestRound,
  settlePriceDisplay: string,
  ledger: GuestLedger,
): { round: GuestRound; ledger: GuestLedger } {
  if (round.phase !== "live" || round.openPrice === null || !round.direction) {
    return {
      round: { ...round, message: "No live guest round to settle." },
      ledger,
    };
  }
  const settlePrice = Number(settlePriceDisplay);
  if (!Number.isFinite(settlePrice)) {
    return {
      round: {
        ...round,
        message: "Settle needs a live oracle price — not inventing an outcome.",
      },
      ledger,
    };
  }

  if (settlePrice === round.openPrice) {
    const nextLedger: GuestLedger = {
      ...ledger,
      ties: ledger.ties + 1,
      streak: 0,
    };
    saveGuestLedger(nextLedger);
    return {
      round: {
        ...round,
        phase: "settled",
        settlePrice,
        won: null,
        tie: true,
        pointsDelta: 0,
        message: `Tie @ ${settlePriceDisplay}. Practice points unchanged.`,
      },
      ledger: nextLedger,
    };
  }

  const wentUp = settlePrice > round.openPrice;
  const won =
    (wentUp && round.direction === "up") ||
    (!wentUp && round.direction === "down");
  const pointsDelta = won ? WIN_POINTS : LOSS_POINTS;
  const nextLedger: GuestLedger = {
    points: ledger.points + pointsDelta,
    wins: ledger.wins + (won ? 1 : 0),
    losses: ledger.losses + (won ? 0 : 1),
    ties: ledger.ties,
    streak: won ? ledger.streak + 1 : 0,
  };
  saveGuestLedger(nextLedger);

  return {
    round: {
      ...round,
      phase: "settled",
      settlePrice,
      won,
      tie: false,
      pointsDelta,
      message: won
        ? `Guest WIN ${round.direction.toUpperCase()} (${round.openPrice} → ${settlePrice}). +${pointsDelta} practice pts.`
        : `Guest LOSS ${round.direction.toUpperCase()} (${round.openPrice} → ${settlePrice}). ${pointsDelta} practice pts.`,
    },
    ledger: nextLedger,
  };
}

export function remainingMs(round: GuestRound, nowMs = Date.now()): number {
  if (round.phase !== "live" || round.expiresAtMs === null) return 0;
  return Math.max(0, round.expiresAtMs - nowMs);
}
