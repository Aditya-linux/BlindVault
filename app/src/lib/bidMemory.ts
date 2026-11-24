/** Remember sealed bids in this browser (Me / Claim UX). Devnet only. */

const KEY = "bv_my_bids_v2";
const LEGACY_KEY = "bv_my_bids";

export type RememberedBid = {
  vaultId: number;
  amountScrip?: number;
  at: number;
};

type Store = Record<string, RememberedBid[]>; // owner -> bids

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Store;
      return parsed && typeof parsed === "object" ? parsed : {};
    }
    // Migrate v1 (owner -> number[])
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return {};
    const old = JSON.parse(legacy) as Record<string, number[]>;
    const next: Store = {};
    for (const [owner, ids] of Object.entries(old)) {
      next[owner] = (ids ?? []).map((vaultId) => ({
        vaultId,
        at: Date.now(),
      }));
    }
    write(next);
    return next;
  } catch {
    return {};
  }
}

function write(data: Store) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function rememberMyBid(
  owner: string,
  vaultId: number,
  amountScrip?: number,
) {
  const data = read();
  const list = data[owner] ?? [];
  const rest = list.filter((b) => b.vaultId !== vaultId);
  data[owner] = [
    { vaultId, amountScrip, at: Date.now() },
    ...rest,
  ].slice(0, 500);
  write(data);
}

export function rememberedBidOnLot(
  owner: string | null | undefined,
  vaultId: number,
): boolean {
  if (!owner) return false;
  return (read()[owner] ?? []).some((b) => b.vaultId === vaultId);
}

export function listRememberedBids(
  owner: string | null | undefined,
): RememberedBid[] {
  if (!owner) return [];
  return read()[owner] ?? [];
}
