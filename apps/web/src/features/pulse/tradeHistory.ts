import type { CallDirection } from "../../chain/program";

export type TradeSource = "guest" | "onchain";

export type TradeRecord = {
  id: string;
  source: TradeSource;
  feedSymbol: string;
  direction: CallDirection;
  openPrice: string;
  settlePrice: string;
  won: boolean | null;
  tie: boolean;
  placedAtMs: number;
  settledAtMs: number;
  latencyMs: number | null;
  signature: string | null;
  ghost: boolean;
  pointsDelta: number | null;
  /** Round window in seconds when known (chain OI detailing). */
  durationSecs?: number | null;
};

const STORAGE_KEY = "pulse.call.trade.history.v1";
const MAX_TRADES = 80;

export function loadTradeHistory(): TradeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TradeRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row) =>
        typeof row?.id === "string" &&
        (row.source === "guest" || row.source === "onchain"),
    );
  } catch {
    return [];
  }
}

export function saveTradeHistory(rows: TradeRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, MAX_TRADES)));
}

export function appendTrade(
  history: TradeRecord[],
  trade: Omit<TradeRecord, "id">,
): TradeRecord[] {
  const next: TradeRecord[] = [
    {
      ...trade,
      id: `${trade.settledAtMs}-${trade.source}-${Math.random().toString(36).slice(2, 8)}`,
    },
    ...history,
  ].slice(0, MAX_TRADES);
  saveTradeHistory(next);
  return next;
}

export function clearTradeHistory(): TradeRecord[] {
  localStorage.removeItem(STORAGE_KEY);
  return [];
}

export function tradeStats(history: TradeRecord[]) {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let guest = 0;
  let onchain = 0;
  for (const row of history) {
    if (row.source === "guest") guest += 1;
    else onchain += 1;
    if (row.tie) ties += 1;
    else if (row.won) wins += 1;
    else if (row.won === false) losses += 1;
  }
  return { wins, losses, ties, guest, onchain, total: history.length };
}
