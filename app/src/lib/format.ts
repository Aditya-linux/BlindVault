export function shortAddr(addr: string | null | undefined): string {
  if (!addr) return "—";
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function rarityLabel(r: number): string {
  // Maps 1:1 to on-chain rarity u8
  return ["Common", "Silver", "Shiny", "Gold", "Legendary"][r] ?? "?";
}

export function categoryLabel(c: number): string {
  return ["Spirit", "Drake", "Beast", "Aviary", "Mythic"][c] ?? "?";
}

export function sizeLabel(s: number): string {
  return ["Locker", "Garage", "Unit"][s] ?? "?";
}
