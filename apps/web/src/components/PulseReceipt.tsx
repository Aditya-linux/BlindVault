import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  openPrice: string | null;
  settlePrice: string | null;
  won: boolean | null;
  tie?: boolean;
  payoutBps: number | null;
  pulseSeed: number | null;
  signature: string | null;
  mode: "guest" | "onchain";
  ghostCommit?: string | null;
};

export function PulseReceipt({
  openPrice,
  settlePrice,
  won,
  tie = false,
  payoutBps,
  pulseSeed,
  signature,
  mode,
  ghostCommit = null,
}: Props) {
  if (openPrice === null && settlePrice === null && !ghostCommit) return null;

  const outcome = tie ? "Tie" : won === null ? "—" : won ? "Win" : "Loss";
  const payout =
    payoutBps === null ? null : `${(payoutBps / 10_000).toFixed(2)}x`;

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">
          {mode === "guest" ? "Practice receipt" : "Onchain receipt"}
        </CardTitle>
        <Badge variant={won ? "default" : "secondary"}>{outcome}</Badge>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            Open
          </p>
          <p className="font-mono">{openPrice ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            Settle
          </p>
          <p className="font-mono">{settlePrice ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            VRF pulse
          </p>
          <p className="font-mono">
            {pulseSeed === null
              ? mode === "guest"
                ? "n/a"
                : "pending"
              : `#${pulseSeed}`}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-wide">
            Payout trim
          </p>
          <p className="font-mono">
            {payout ?? (mode === "guest" ? "practice pts" : "—")}
          </p>
        </div>
        {ghostCommit ? (
          <div className="col-span-2">
            <p className="text-muted-foreground text-xs uppercase tracking-wide">
              Ghost commit
            </p>
            <p className="font-mono text-xs">{ghostCommit}</p>
          </div>
        ) : null}
        {signature ? (
          <p className="text-muted-foreground col-span-2 font-mono text-xs">
            tx {signature.slice(0, 24)}…
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
