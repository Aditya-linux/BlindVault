import { Badge } from "@/components/ui/badge";
import {
  formatLatency,
  type LatencySample,
} from "@/features/pulse/latency";

type Props = {
  sample: LatencySample | null;
};

export function LatencyHud({ sample }: Props) {
  return (
    <div className="bg-card/80 flex flex-wrap items-baseline gap-3 rounded-lg border border-dashed px-3 py-2 font-mono text-sm">
      <Badge variant="outline">Latency</Badge>
      {!sample ? (
        <span className="text-muted-foreground">place a call to measure</span>
      ) : (
        <>
          <span className="font-semibold">
            place→settle {formatLatency(sample.roundTripMs)}
          </span>
          <span className="text-muted-foreground">
            {sample.route.toUpperCase()} · {sample.label}
          </span>
        </>
      )}
    </div>
  );
}
