export type PriceTick = {
  t: number;
  price: number;
};

export type ChartMarker = {
  t: number;
  kind: "open" | "settle";
  price: number;
  direction?: "up" | "down";
  won?: boolean | null;
};

const MAX_TICKS = 180;

export function appendTick(
  series: PriceTick[],
  priceDisplay: string,
  nowMs = Date.now(),
): PriceTick[] {
  const price = Number(priceDisplay);
  if (!Number.isFinite(price)) return series;
  const last = series[series.length - 1];
  if (last && Math.abs(last.price - price) < 1e-12 && nowMs - last.t < 200) {
    return series;
  }
  return [...series, { t: nowMs, price }].slice(-MAX_TICKS);
}

export function seriesBounds(series: PriceTick[]): {
  min: number;
  max: number;
  span: number;
} {
  if (series.length === 0) return { min: 0, max: 1, span: 1 };
  let min = series[0].price;
  let max = series[0].price;
  for (const tick of series) {
    min = Math.min(min, tick.price);
    max = Math.max(max, tick.price);
  }
  const span = Math.max(max - min, max * 0.0005, 0.0001);
  return { min, max, span };
}

/** Change from first visible tick → last (session window, not calendar day). */
export function seriesChange(
  series: PriceTick[],
): { abs: number; pct: number } | null {
  if (series.length < 2) return null;
  const first = series[0].price;
  const last = series[series.length - 1].price;
  if (!Number.isFinite(first) || first === 0) return null;
  const abs = last - first;
  return { abs, pct: (abs / first) * 100 };
}
