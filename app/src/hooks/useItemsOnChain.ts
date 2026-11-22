"use client";

import { useQuery } from "@tanstack/react-query";

export type OnChainItem = {
  index: number;
  mint: string;
  rarity: number;
  category: number;
  value: number;
  name: string;
  sold: boolean;
  owner: string;
  ownerShort: string;
};

export function useItemsOnChain() {
  return useQuery({
    queryKey: ["items-onchain"],
    queryFn: async (): Promise<OnChainItem[]> => {
      // Browser → Helius can flake; server route uses the same RPC without CORS.
      const res = await fetch("/api/items", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`items api ${res.status}`);
      }
      const body = (await res.json()) as {
        items?: OnChainItem[];
        error?: string;
      };
      if (body.error && (!body.items || body.items.length === 0)) {
        throw new Error(body.error);
      }
      return body.items ?? [];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: 2,
  });
}

export function useMyInventory(owner: string | null | undefined) {
  const items = useItemsOnChain();
  const mine =
    items.data?.filter((i) => i.sold && owner && i.owner === owner) ?? [];
  return {
    ...items,
    data: mine,
  };
}

/** Resolve warehouse rows for revealed indices (catalog fallback if RPC lag). */
export function resolveRevealedCards(
  indices: number[],
  catalog: OnChainItem[] | undefined,
): OnChainItem[] {
  return indices.map((index) => {
    const hit = catalog?.find((x) => x.index === index);
    if (hit) return hit;
    return {
      index,
      mint: "",
      rarity: 0,
      category: 0,
      value: 0,
      name: `Creature ${index}`,
      sold: false,
      owner: "",
      ownerShort: "",
    };
  });
}
