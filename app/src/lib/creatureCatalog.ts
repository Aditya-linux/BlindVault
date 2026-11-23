/** UI catalog — display names + art. On-chain Item PDAs keep seed names. */

/** Display tiers only — pack odds stay unpublished (weighted on-chain fill). */
export const RARITY_TIERS = [
  { id: 0, label: "Common", color: "#5c5954" },
  { id: 1, label: "Silver", color: "#6a7a8a" },
  { id: 2, label: "Shiny", color: "#1f6f9a" },
  { id: 3, label: "Gold", color: "#8a6a18" },
  { id: 4, label: "Legendary", color: "#6a5210" },
] as const;

const DISPLAY_NAMES: string[] = [
  "Pebble Pup",
  "Tin Sprout",
  "Dust Mite",
  "Cinder Cub",
  "Tide Sprite",
  "Ember Drake",
  "Glow Moth",
  "Manta Pup",
  "Flamewing",
  "Moon Moth",
  "Ruin Phoenix",
  "Owlflare",
  "Nettle Fox",
  "Cobalt Finch",
  "Moss Hopper",
  "Spark Kit",
  "Frost Beetle",
  "Amber Hare",
  "Volt Wisp",
  "Coral Skink",
  "Ash Pup",
  "Prism Toad",
  "Gale Finch",
  "Iron Beetle",
  "Sun Skipper",
  "Echo Bat",
  "Crystal Newt",
  "Storm Quill",
  "Bloom Drake",
  "Night Lantern",
  "River Coil",
  "Solar Cub",
  "Mist Serpent",
  "Thorn Sprite",
  "Gilded Fang",
  "Aurora Lynx",
  "Crown Roc",
  "Obsidian Wyrm",
  "Star Sovereign",
  "Vault Spirit",
];

export function creatureDisplayName(index: number, fallback: string): string {
  return DISPLAY_NAMES[index] ?? fallback;
}

export function creatureImageSrc(index: number): string | null {
  if (index < 0 || index > 39) return null;
  return `/creatures/${String(index).padStart(2, "0")}.webp`;
}
