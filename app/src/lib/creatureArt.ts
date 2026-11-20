/** Deterministic “creature card” art — original silhouettes, not third-party IP. */

export type CreaturePalette = {
  bg: string;
  mid: string;
  accent: string;
  ink: string;
  foil: string;
};

const PALETTES: CreaturePalette[] = [
  { bg: "#dfe8e2", mid: "#8aa896", accent: "#3d5a4c", ink: "#1d1d1f", foil: "#c9c2b4" },
  { bg: "#e8e4f2", mid: "#9b8fc2", accent: "#5b4a8a", ink: "#1d1d1f", foil: "#d4c8f0" },
  { bg: "#f2e6d8", mid: "#d4a574", accent: "#a65d2f", ink: "#1d1d1f", foil: "#f0d9a8" },
  { bg: "#dceaf2", mid: "#6fa0c4", accent: "#2f5f8a", ink: "#1d1d1f", foil: "#a8d4f0" },
  { bg: "#f2dce4", mid: "#c47a96", accent: "#8a2f4a", ink: "#1d1d1f", foil: "#f0a8c4" },
  { bg: "#e8f0d8", mid: "#9ab86a", accent: "#4a6a2f", ink: "#1d1d1f", foil: "#c8e0a0" },
  { bg: "#f0ebe0", mid: "#c4b08a", accent: "#7a6540", ink: "#1d1d1f", foil: "#e8d8b0" },
  { bg: "#e0e8f0", mid: "#7a90b0", accent: "#3a4a6a", ink: "#1d1d1f", foil: "#b0c8e8" },
];

export function creaturePalette(index: number, rarity: number): CreaturePalette {
  const base = PALETTES[index % PALETTES.length]!;
  if (rarity >= 4) {
    return { ...base, mid: "#e8c76a", accent: "#8a6a18", foil: "#ffe9a0" };
  }
  if (rarity >= 3) {
    return { ...base, foil: "#d8b8ff", accent: mixHex(base.accent, "#5a2f8a", 0.35) };
  }
  if (rarity >= 2) {
    return { ...base, foil: "#a8e8ff" };
  }
  return base;
}

function mixHex(a: string, b: string, t: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ] as const;
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${[r, g, bl].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/** Body shape family — keeps cards feeling like a creature set. */
export function creatureShape(index: number): "blob" | "tall" | "wide" | "spiky" | "round" {
  const shapes = ["blob", "tall", "wide", "spiky", "round"] as const;
  return shapes[index % shapes.length]!;
}
