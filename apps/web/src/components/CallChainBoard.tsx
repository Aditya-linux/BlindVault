import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import type { CallDirection } from "@/chain/program";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TradeRecord } from "@/features/pulse/tradeHistory";
import { cn } from "@/lib/utils";

export type ChainDuration = 5 | 8 | 15;

type Props = {
  symbol: string;
  spot: string | null;
  spotChangeAbs: number | null;
  spotChangePct: number | null;
  durations: readonly ChainDuration[];
  selected: ChainDuration;
  onSelectDuration: (secs: ChainDuration) => void;
  onCall: (direction: CallDirection, secs: ChainDuration) => void;
  disabled: boolean;
  trades: TradeRecord[];
  liveDirection: CallDirection | null;
  liveLeftSec: number | null;
  payoutMult: number;
};

function oiForDuration(trades: TradeRecord[], secs: ChainDuration) {
  let up = 0;
  let down = 0;
  for (const trade of trades) {
    const d = trade.durationSecs;
    if (d != null && d !== secs) continue;
    if (d == null) continue;
    if (trade.direction === "up") up += 1;
    else down += 1;
  }
  // Fallback: all trades when no duration tags yet
  if (up + down === 0) {
    for (const trade of trades) {
      if (trade.direction === "up") up += 1;
      else down += 1;
    }
  }
  const total = Math.max(up + down, 1);
  return { up, down, upPct: (up / total) * 100, downPct: (down / total) * 100 };
}

function formatChange(abs: number | null, pct: number | null): string {
  if (abs === null || pct === null) return "—";
  const sign = abs >= 0 ? "+" : "";
  return `${sign}${abs.toFixed(4)} · ${sign}${pct.toFixed(2)}%`;
}

export function CallChainBoard({
  symbol,
  spot,
  spotChangeAbs,
  spotChangePct,
  durations,
  selected,
  onSelectDuration,
  onCall,
  disabled,
  trades,
  liveDirection,
  liveLeftSec,
  payoutMult,
}: Props) {
  const positive = (spotChangeAbs ?? 0) >= 0;
  const midIndex = Math.floor(durations.length / 2);

  return (
    <section className="overflow-hidden rounded-lg border border-border/80 bg-card/80 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="font-display truncate text-lg tracking-tight sm:text-xl">
            {symbol}
          </h2>
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
            Live ER
          </Badge>
        </div>
        <p className="text-muted-foreground hidden font-mono text-[10px] uppercase tracking-wider sm:block">
          UP · strike · DOWN
        </p>
      </div>

      <div className="chain-grid border-b border-border/40 bg-muted/20 px-2 py-1.5 text-[10px] font-medium tracking-wider text-muted-foreground uppercase sm:px-3">
        <span className="text-up pl-1">Call / UP</span>
        <span className="text-center">Window</span>
        <span className="text-down pr-1 text-right">Put / DOWN</span>
      </div>

      <div className="relative">
        {durations.map((secs, index) => {
          const oi = oiForDuration(trades, secs);
          const isSelected = secs === selected;
          const showSpot = index === midIndex;
          const quote = `${payoutMult.toFixed(2)}×`;
          const winBias =
            oi.up + oi.down > 0
              ? ((oi.up - oi.down) / Math.max(oi.up + oi.down, 1)) * 100
              : 0;

          return (
            <div key={secs} className="relative">
              {showSpot ? (
                <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex -translate-y-1/2 items-center px-2 sm:px-3">
                  <div className="h-px flex-1 bg-foreground/70" />
                  <div className="spot-pill mx-2 flex max-w-[min(100%,18rem)] flex-col items-center rounded-full border border-foreground/80 bg-background px-3 py-1 font-mono text-[11px] leading-tight shadow-lg sm:text-xs">
                    <span className="font-semibold tracking-tight">
                      ${spot ?? "—"}
                    </span>
                    <span
                      className={cn(
                        "text-[10px]",
                        positive ? "text-up" : "text-down",
                      )}
                    >
                      {formatChange(spotChangeAbs, spotChangePct)}
                    </span>
                  </div>
                  <div className="h-px flex-1 bg-foreground/70" />
                </div>
              ) : null}

              <div
                className={cn(
                  "chain-grid items-stretch border-b border-border/30 transition-colors",
                  isSelected && "bg-accent/8",
                )}
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onSelectDuration(secs);
                    onCall("up", secs);
                  }}
                  className={cn(
                    "flex flex-col items-start gap-0.5 px-2 py-2.5 text-left transition-colors hover:bg-up/10 disabled:opacity-40 sm:px-3 sm:py-3",
                    liveDirection === "up" && isSelected && "bg-up/15",
                  )}
                >
                  <span className="font-mono text-sm font-semibold tabular-nums sm:text-base">
                    {quote}
                  </span>
                  <span className="text-up font-mono text-[10px] tabular-nums sm:text-xs">
                    {winBias >= 0 ? "+" : ""}
                    {winBias.toFixed(0)}% OI
                  </span>
                </button>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelectDuration(secs)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 border-x border-border/40 px-1 py-2 transition-colors hover:bg-muted/40",
                    isSelected &&
                      "outline outline-1 outline-offset-[-1px] outline-accent",
                  )}
                >
                  <span className="font-mono text-sm font-semibold tabular-nums sm:text-base">
                    {secs}s
                  </span>
                  <div className="oi-bar w-full max-w-[4.5rem]">
                    <span
                      className="bg-down"
                      style={{ width: `${oi.downPct}%` }}
                    />
                    <span
                      className="bg-up"
                      style={{ width: `${oi.upPct}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground text-[9px] font-mono tabular-nums">
                    {oi.down}/{oi.up} fills
                  </span>
                </button>

                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onSelectDuration(secs);
                    onCall("down", secs);
                  }}
                  className={cn(
                    "flex flex-col items-end gap-0.5 px-2 py-2.5 text-right transition-colors hover:bg-down/10 disabled:opacity-40 sm:px-3 sm:py-3",
                    liveDirection === "down" && isSelected && "bg-down/15",
                  )}
                >
                  <span className="font-mono text-sm font-semibold tabular-nums sm:text-base">
                    {quote}
                  </span>
                  <span className="text-down font-mono text-[10px] tabular-nums sm:text-xs">
                    {winBias <= 0 ? "" : "-"}
                    {Math.abs(winBias).toFixed(0)}% OI
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="bg-up text-primary-foreground hover:bg-up/90 h-9 min-w-[5.5rem]"
            disabled={disabled}
            onClick={() => onCall("up", selected)}
          >
            <ArrowUpIcon data-icon="inline-start" />
            UP
          </Button>
          <Button
            size="sm"
            className="bg-down text-primary-foreground hover:bg-down/90 h-9 min-w-[5.5rem]"
            disabled={disabled}
            onClick={() => onCall("down", selected)}
          >
            <ArrowDownIcon data-icon="inline-start" />
            DOWN
          </Button>
        </div>
        <p className="text-muted-foreground font-mono text-[11px] tabular-nums">
          {liveDirection && liveLeftSec != null
            ? `${liveDirection.toUpperCase()} · ${liveLeftSec.toFixed(1)}s left`
            : `${selected}s window · tap row to call`}
        </p>
      </div>
    </section>
  );
}
