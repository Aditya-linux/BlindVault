/** TypeScript mirror of on-chain release_hint (§7.6) for Proof board checks. */

export type ItemMeta = {
  index: number;
  rarity: number;
  category: number;
  value: number;
};

export type HintResult = { kind: number; a: number; b: number };

export function computeHint(
  kind: number,
  items: ItemMeta[],
): HintResult {
  if (items.length === 0) return { kind, a: 0, b: 0 };
  switch (kind) {
    case 0: {
      const cnt = [0, 0, 0, 0, 0];
      for (const it of items) cnt[it.category] += 1;
      let best = 0;
      for (let k = 0; k < 5; k++) {
        if (
          cnt[k] > cnt[best] ||
          (cnt[k] === cnt[best] && k < best)
        ) {
          best = k;
        }
      }
      return { kind, a: best, b: cnt[best] };
    }
    case 1: {
      const min = Math.min(...items.map((i) => i.rarity));
      return { kind, a: min, b: 0 };
    }
    case 2: {
      const total = items.reduce((s, i) => s + i.value, 0);
      const w = items.length <= 3 ? 50 : 100;
      const lo = Math.floor(total / w) * w;
      return { kind, a: lo, b: lo + w };
    }
    case 3: {
      const max = Math.max(...items.map((i) => i.rarity));
      return { kind, a: max >= 3 ? 1 : 0, b: 0 };
    }
    default:
      return { kind, a: 0, b: 0 };
  }
}

export function hintCopy(h: HintResult): string {
  const cats = ["TOYS", "TECH", "CARDS", "COINS", "ODDITIES"];
  const floors = ["JUNK", "COMMON", "RARE", "EPIC", "LEGENDARY"];
  switch (h.kind) {
    case 0:
      return `SMELLS LIKE… ${cats[h.a] ?? "?"} (${h.b} of slots)`;
    case 1:
      return h.a === 0
        ? "SOME JUNK IN THERE"
        : `NOTHING BELOW ${floors[h.a]}`;
    case 2:
      return `APPRAISED ${h.a}–${h.b} SCRIP`;
    case 3:
      return `SOMETHING SHINY: ${h.a ? "YES" : "NO"}`;
    default:
      return "—";
  }
}
