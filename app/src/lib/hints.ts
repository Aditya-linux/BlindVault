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
          cnt[k]! > cnt[best]! ||
          (cnt[k] === cnt[best] && k < best)
        ) {
          best = k;
        }
      }
      return { kind, a: best, b: cnt[best]! };
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

/** Short label for locked slots / proof board. */
const CAT_NAMES = ["toys", "tech gadgets", "cards", "coins", "odd finds"];
const FLOOR_NAMES = ["junk", "common", "rare", "epic", "legendary"];

export type HintPresentation = {
  kind: number;
  /** Small eyebrow — what kind of clue */
  label: string;
  /** Plain sentence users can understand */
  headline: string;
  /** One-line vibe / why it matters */
  whisper: string;
};

/** Friendly suspense copy for Live Vault (and Proof checks). */
export function presentHint(h: HintResult): HintPresentation {
  switch (h.kind) {
    case 0: {
      const cat = CAT_NAMES[h.a] ?? "mystery stuff";
      const n = h.b;
      return {
        kind: 0,
        label: "Category clue",
        headline:
          n <= 1
            ? `Mostly smells like ${cat}`
            : `${n} of the slots lean toward ${cat}`,
        whisper: "Rocco peeked at the shelf labels — not the boxes.",
      };
    }
    case 1: {
      if (h.a === 0) {
        return {
          kind: 1,
          label: "Quality floor",
          headline: "There’s at least one junk piece in there",
          whisper: "Not every box is a trophy — some are filler.",
        };
      }
      const floor = FLOOR_NAMES[h.a] ?? "decent";
      return {
        kind: 1,
        label: "Quality floor",
        headline: `Nothing weaker than ${floor}`,
        whisper: "The worst card in this pack still clears that bar.",
      };
    }
    case 2:
      return {
        kind: 2,
        label: "Value band",
        headline: `Appraised around ${h.a}–${h.b} SCRIP`,
        whisper: "Rough warehouse estimate — not a guarantee you’ll profit.",
      };
    case 3:
      return {
        kind: 3,
        label: "Shiny check",
        headline: h.a
          ? "Something shiny is in the pack"
          : "No shiny or better spotted",
        whisper: h.a
          ? "Gold or legendary energy — worth leaning in."
          : "A quieter lot — still playable, less fireworks.",
      };
    default:
      return {
        kind: h.kind,
        label: "Clue",
        headline: "—",
        whisper: "",
      };
  }
}

/** Compact one-liner (proof board, status chips). */
export function hintCopy(h: HintResult): string {
  return presentHint(h).headline;
}

export const HINT_SLOT_META: {
  kind: number;
  label: string;
  lockedWhisper: string;
}[] = [
  {
    kind: 0,
    label: "Category clue",
    lockedWhisper: "What kind of loot dominates the box?",
  },
  {
    kind: 1,
    label: "Quality floor",
    lockedWhisper: "How bad can the weakest card be?",
  },
  {
    kind: 2,
    label: "Value band",
    lockedWhisper: "Ballpark SCRIP value of everything inside",
  },
  {
    kind: 3,
    label: "Shiny check",
    lockedWhisper: "Is there gold or legendary heat?",
  },
];
