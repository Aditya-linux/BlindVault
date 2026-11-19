export type LatencySample = {
  label: string;
  placeMs: number | null;
  settleMs: number | null;
  /** place → settle wall time when both exist */
  roundTripMs: number | null;
  route: "guest" | "er" | "base";
};

export function createLatencySample(
  label: string,
  route: LatencySample["route"] = "guest",
): LatencySample {
  return {
    label,
    placeMs: null,
    settleMs: null,
    roundTripMs: null,
    route,
  };
}

export function markPlace(sample: LatencySample, placeMs: number): LatencySample {
  return { ...sample, placeMs, settleMs: null, roundTripMs: null };
}

export function markSettle(sample: LatencySample, settleMs: number): LatencySample {
  if (sample.placeMs === null) {
    return { ...sample, settleMs, roundTripMs: null };
  }
  return {
    ...sample,
    settleMs,
    roundTripMs: Math.max(0, settleMs - sample.placeMs),
  };
}

export function formatLatency(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
