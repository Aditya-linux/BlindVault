export function shortAddr(addr: string | null | undefined): string {
  if (!addr) return "—";
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function rarityLabel(r: number): string {
  return ["Junk", "Common", "Rare", "Epic", "Legendary"][r] ?? "?";
}

export function categoryLabel(c: number): string {
  return ["Toys", "Tech", "Cards", "Coins", "Oddities"][c] ?? "?";
}

export function sizeLabel(s: number): string {
  return ["Locker", "Garage", "Unit"][s] ?? "?";
}
