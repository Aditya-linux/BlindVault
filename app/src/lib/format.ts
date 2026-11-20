export function shortAddr(addr: string | null | undefined): string {
  if (!addr) return "—";
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function rarityLabel(r: number): string {
  // TCG-style tiers shown in the warehouse (maps 1:1 to on-chain rarity u8)
  return ["Simple", "Common", "Shiny", "Epic", "Legendary"][r] ?? "?";
}

export function categoryLabel(c: number): string {
  return ["Toys", "Tech", "Cards", "Coins", "Oddities"][c] ?? "?";
}

export function sizeLabel(s: number): string {
  return ["Locker", "Garage", "Unit"][s] ?? "?";
}
