/** Client-side pack memory for “You packed X, Y, Z” + Me history. */

export type PackRecord = {
  vaultId: number;
  owner: string;
  names: string[];
  indices: number[];
  highestBid: number;
  at: number;
};

const PACKS_KEY = "bv_packs";
const SEEN_KEY = "bv_pack_popup_seen";

function loadPacks(): PackRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PACKS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PackRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePacks(packs: PackRecord[]): void {
  try {
    localStorage.setItem(PACKS_KEY, JSON.stringify(packs.slice(0, 100)));
  } catch {
    /* ignore quota */
  }
}

export function upsertPack(record: PackRecord): void {
  const all = loadPacks().filter(
    (p) => !(p.vaultId === record.vaultId && p.owner === record.owner),
  );
  all.unshift(record);
  savePacks(all);
}

export function loadPacksForOwner(owner: string | null | undefined): PackRecord[] {
  if (!owner) return [];
  return loadPacks().filter((p) => p.owner === owner);
}

export function getPack(
  owner: string | null | undefined,
  vaultId: number,
): PackRecord | null {
  if (!owner) return null;
  return (
    loadPacks().find((p) => p.owner === owner && p.vaultId === vaultId) ?? null
  );
}

export function formatPackLine(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function hasSeenPackPopup(owner: string, vaultId: number): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    if (!raw) return false;
    const seen = JSON.parse(raw) as string[];
    return Array.isArray(seen) && seen.includes(`${owner}:${vaultId}`);
  } catch {
    return false;
  }
}

export function markPackPopupSeen(owner: string, vaultId: number): void {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    const seen: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    const key = `${owner}:${vaultId}`;
    if (!seen.includes(key)) seen.push(key);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(seen.slice(-50)));
  } catch {
    /* ignore */
  }
}
