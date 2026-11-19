import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  tradeStats,
  type TradeRecord,
} from "@/features/pulse/tradeHistory";
import { formatLatency } from "@/features/pulse/latency";

type Props = {
  trades: TradeRecord[];
  onClear: () => void;
};

function outcomeBadge(trade: TradeRecord) {
  if (trade.tie) return <Badge variant="secondary">Tie</Badge>;
  if (trade.won) return <Badge className="bg-up/20 text-up border-up/30">Win</Badge>;
  if (trade.won === false)
    return <Badge variant="destructive">Loss</Badge>;
  return <Badge variant="outline">—</Badge>;
}

export function TradeBlotter({ trades, onClear }: Props) {
  const stats = tradeStats(trades);

  return (
    <section className="overflow-hidden rounded-lg border border-border/80 bg-card/80 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3 border-b border-border/50 px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg tracking-tight sm:text-xl">
            Trade blotter
          </h2>
          <p className="text-muted-foreground text-[11px] sm:text-xs">
            Your fills only — guest practice + confirmed onchain settles.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={trades.length === 0}
        >
          Clear
        </Button>
      </div>

      <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 border-b border-border/40 px-3 py-2 font-mono text-[11px] sm:px-4 sm:text-xs">
        <span>{stats.total} fills</span>
        <span>
          W{stats.wins} / L{stats.losses} / T{stats.ties}
        </span>
        <span>
          {stats.guest} guest · {stats.onchain} onchain
        </span>
      </div>

      {trades.length === 0 ? (
        <p className="text-muted-foreground px-3 py-8 text-center text-sm sm:px-4">
          No fills yet. Tap UP/DOWN on the chain — settled rounds land here.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-muted/30 text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Feed</th>
                <th className="px-3 py-2 font-medium">Side</th>
                <th className="px-3 py-2 font-medium">Open→Settle</th>
                <th className="px-3 py-2 font-medium">Result</th>
                <th className="px-3 py-2 font-medium">Lat</th>
                <th className="px-3 py-2 font-medium">Src</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr
                  key={trade.id}
                  className="border-t border-border/30 hover:bg-muted/20"
                >
                  <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                    {new Date(trade.settledAtMs).toLocaleTimeString()}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {trade.feedSymbol}
                    {trade.durationSecs != null
                      ? ` · ${trade.durationSecs}s`
                      : ""}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs uppercase">
                    <span
                      className={
                        trade.direction === "up" ? "text-up" : "text-down"
                      }
                    >
                      {trade.direction}
                    </span>
                    {trade.ghost ? " · ghost" : ""}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs tabular-nums">
                    {trade.openPrice} → {trade.settlePrice}
                  </td>
                  <td className="px-3 py-2">{outcomeBadge(trade)}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {formatLatency(trade.latencyMs)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {trade.source}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
