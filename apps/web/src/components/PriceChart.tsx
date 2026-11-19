import type { OraclePrice } from "@/chain/oracle";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  seriesBounds,
  seriesChange,
  type ChartMarker,
  type PriceTick,
} from "@/features/pulse/priceSeries";
import { cn } from "@/lib/utils";

type Props = {
  symbol: string;
  price: OraclePrice | null;
  error: string | null;
  series: PriceTick[];
  markers: ChartMarker[];
};

const W = 640;
const H = 220;
const PAD_L = 12;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 22;

function yAt(
  price: number,
  min: number,
  span: number,
): number {
  return PAD_T + (1 - (price - min) / span) * (H - PAD_T - PAD_B);
}

export function PriceChart({ symbol, price, error, series, markers }: Props) {
  const { min, max, span } = seriesBounds(series);
  const change = seriesChange(series);
  const t0 = series[0]?.t ?? Date.now();
  const t1 = series[series.length - 1]?.t ?? t0 + 1;
  const tSpan = Math.max(t1 - t0, 1);
  const rising = (change?.abs ?? 0) >= 0;

  const coords = series.map((tick) => {
    const x = PAD_L + ((tick.t - t0) / tSpan) * (W - PAD_L - PAD_R);
    const y = yAt(tick.price, min, span);
    return { x, y, tick };
  });

  const linePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const area =
    coords.length > 1
      ? `${PAD_L},${H - PAD_B} ${linePoints} ${W - PAD_R},${H - PAD_B}`
      : "";

  const gridYs = [0.2, 0.4, 0.6, 0.8].map((f) => PAD_T + f * (H - PAD_T - PAD_B));
  const last = coords[coords.length - 1];
  const stroke = rising ? "var(--up)" : "var(--down)";
  const fillId = rising ? "tapeFillUp" : "tapeFillDown";

  return (
    <section className="overflow-hidden rounded-lg border border-border/80 bg-card/80 backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 px-3 py-3 sm:px-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-xs font-semibold tracking-[0.14em] uppercase">
              {symbol}
            </h2>
            <Badge
              variant="secondary"
              className="font-mono text-[10px] uppercase"
            >
              Oracle tape
            </Badge>
          </div>
          <p className="text-muted-foreground text-[11px] sm:text-xs">
            Live MagicBlock ER feed · open/settle marks from your calls
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5 font-mono">
          {error ? (
            <span className="text-destructive text-sm">{error}</span>
          ) : price ? (
            <>
              <strong className="text-2xl tracking-tight tabular-nums sm:text-3xl">
                ${price.display}
              </strong>
              <span
                className={cn(
                  "text-[11px] tabular-nums sm:text-xs",
                  rising ? "text-up" : "text-down",
                )}
              >
                {change
                  ? `${change.abs >= 0 ? "+" : ""}${change.abs.toFixed(4)} (${change.abs >= 0 ? "+" : ""}${change.pct.toFixed(2)}%)`
                  : "warming…"}
                <span className="text-muted-foreground">
                  {" "}
                  · slot {price.slot} · {series.length} ticks
                </span>
              </span>
            </>
          ) : (
            <Skeleton className="h-8 w-36" />
          )}
        </div>
      </div>

      <div className="relative px-1 pt-2 pb-1 sm:px-2">
        <div className="text-muted-foreground absolute top-3 right-3 z-[1] flex flex-col items-end gap-0.5 font-mono text-[10px] tabular-nums">
          <span>H {max.toFixed(4)}</span>
          <span>L {min.toFixed(4)}</span>
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-44 w-full sm:h-52 md:h-56"
          role="img"
          aria-label={`${symbol} price chart`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="tapeFillUp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.72 0.17 150)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="oklch(0.72 0.17 150)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="tapeFillDown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.68 0.19 25)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="oklch(0.68 0.19 25)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridYs.map((y) => (
            <line
              key={y}
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y}
              y2={y}
              stroke="oklch(1 0 0 / 0.06)"
              strokeWidth="1"
            />
          ))}

          {area ? <polygon points={area} fill={`url(#${fillId})`} /> : null}

          {linePoints ? (
            <polyline
              fill="none"
              stroke={stroke}
              strokeWidth="2.25"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={linePoints}
            />
          ) : null}

          {last ? (
            <>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={last.y}
                y2={last.y}
                stroke="oklch(1 0 0 / 0.35)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <circle cx={last.x} cy={last.y} r="4" fill={stroke} />
              <circle
                cx={last.x}
                cy={last.y}
                r="8"
                fill={stroke}
                opacity="0.2"
              />
            </>
          ) : null}

          {markers.map((mark) => {
            const x = PAD_L + ((mark.t - t0) / tSpan) * (W - PAD_L - PAD_R);
            const y = yAt(mark.price, min, span);
            const fill =
              mark.kind === "open"
                ? "oklch(0.78 0.14 75)"
                : mark.won
                  ? "var(--up)"
                  : mark.won === false
                    ? "var(--down)"
                    : "oklch(0.7 0.02 260)";
            return (
              <g key={`${mark.kind}-${mark.t}-${mark.price}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={PAD_T}
                  y2={H - PAD_B}
                  stroke={fill}
                  strokeOpacity="0.4"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={x}
                  cy={y}
                  r={mark.kind === "open" ? 4.5 : 5.5}
                  fill={fill}
                  stroke="var(--background)"
                  strokeWidth={mark.kind === "settle" ? 2 : 0}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 border-t border-border/40 px-3 py-2 text-[10px] sm:px-4 sm:text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-1.5 rounded-full bg-accent" /> open
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-up inline-block size-1.5 rounded-full" /> settle win
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-down inline-block size-1.5 rounded-full" /> settle loss
        </span>
        <span className="ml-auto font-mono tabular-nums">
          {series.length > 1
            ? `${((t1 - t0) / 1000).toFixed(0)}s window`
            : "awaiting ticks"}
        </span>
      </div>
    </section>
  );
}
