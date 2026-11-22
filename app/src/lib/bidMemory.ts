/** Remember which lots this browser/wallet sealed-bid on (Claim UX). */

const KEY = "bv_my_bids";

type BidMemory = Record<string, number[]>; // owner -> vaultIds

function read(): BidMemory {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as BidMemory;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function write(data: BidMemory) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

export function rememberMyBid(owner: string, vaultId: number) {
  const data = read();
  const list = data[owner] ?? [];
  if (!list.includes(vaultId)) {
    data[owner] = [vaultId, ...list].slice(0, 40);
    write(data);
  }
}

export function rememberedBidOnLot(
  owner: string | null | undefined,
  vaultId: number,
): boolean {
  if (!owner) return false;
  return (read()[owner] ?? []).includes(vaultId);
}
