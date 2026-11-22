export const VaultStatus = {
  Created: 0,
  Delegated: 1,
  Filling: 2,
  Open: 3,
  Ended: 4,
  Revealed: 5,
  Abandoned: 6,
  Closed: 7,
  Settled: 8,
} as const;

export type VaultStatusName = keyof typeof VaultStatus;

export function vaultStatusName(
  v: number | { [k: string]: unknown } | null | undefined,
): VaultStatusName {
  if (v == null) return "Created";
  if (typeof v === "number") {
    const entry = Object.entries(VaultStatus).find(([, n]) => n === v);
    return (entry?.[0] as VaultStatusName) ?? "Created";
  }
  // Anchor IDL enums decode as camelCase unit variants: { open: {} }
  const key = Object.keys(v)[0];
  if (!key) return "Created";
  const match = (Object.keys(VaultStatus) as VaultStatusName[]).find(
    (name) => name.toLowerCase() === key.toLowerCase(),
  );
  return match ?? "Created";
}

/**
 * Contents are public after reveal.
 * Note: `Abandoned` is the zero-bid end state *before* reveal — do not treat as public.
 * Abandoned lots that open still go Revealed → Closed → Settled (abandoned flag stays).
 */
export function revealedItemsVisible(status: VaultStatusName): boolean {
  switch (status) {
    case "Revealed":
    case "Closed":
    case "Settled":
      return true;
    case "Created":
    case "Delegated":
    case "Filling":
    case "Open":
    case "Ended":
    case "Abandoned":
      return false;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export type DecodedHint = {
  kind: number;
  released: boolean;
  a: number;
  b: number;
  releasedTs: number;
};

export type DecodedVault = {
  publicKey: string;
  house: string;
  id: number;
  size: number;
  itemCount: number;
  minBid: number;
  peekFee: number;
  durationSecs: number;
  openTs: number;
  deadlineTs: number;
  hintTimes: number[];
  status: VaultStatusName;
  bidCount: number;
  peeksSold: number;
  highestBid: number;
  winner: string;
  revealedItems: number[];
  revealedValue: number;
  escrow: string;
  abandoned: boolean;
};

export type DecodedHints = {
  publicKey: string;
  vault: string;
  hints: DecodedHint[];
};

export type DecodedBid = {
  publicKey: string;
  vault: string;
  bidder: string;
  amount: number;
  bidderIndex: number;
  placedTs: number;
};

export type WinningLot = {
  vaultId: number;
  vault: string;
  status: string;
  highestBid: number;
  itemCount: number;
  revealedItems: number[];
  revealedValue: number;
  abandoned: boolean;
  settled: boolean;
};

/** Public prize-chain row (safe to share with the browser). */
export type HistoryLot = {
  vaultId: number;
  vault: string;
  status: VaultStatusName;
  size: number;
  itemCount: number;
  bidCount: number;
  highestBid: number;
  winner: string | null;
  revealedItems: number[];
  revealedValue: number;
  abandoned: boolean;
  openTs: number;
  deadlineTs: number;
  prizeRevealed: boolean;
  live: boolean;
};
