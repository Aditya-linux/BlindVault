import { creatureDisplayName } from "@/lib/creatureCatalog";

export type StackableItem = {
  index: number;
  name: string;
  rarity: number;
  category: number;
  value: number;
  sold?: boolean;
};

export type StackedItem<T extends StackableItem = StackableItem> = T & {
  count: number;
  /** Indices folded into this stack (same display name). */
  indices: number[];
};

/** Collapse (A, A) → one row with count 2, keyed by creature display name. */
export function stackInventory<T extends StackableItem>(
  items: T[],
): StackedItem<T>[] {
  const order: string[] = [];
  const map = new Map<string, StackedItem<T>>();

  for (const item of items) {
    const key = creatureDisplayName(item.index, item.name);
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.indices.includes(item.index)) {
        existing.indices.push(item.index);
      }
      if (item.value > existing.value) existing.value = item.value;
      continue;
    }
    order.push(key);
    map.set(key, {
      ...item,
      count: 1,
      indices: [item.index],
    });
  }

  return order.map((key) => map.get(key)!);
}
