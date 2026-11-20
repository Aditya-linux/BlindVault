import catalog from "../../../data/items.json";

/** Static art keyed by on-chain item index (spec: name/image from JSON). */
const byIndex = new Map(
  catalog.map((row) => [
    row.index,
    {
      image: row.image.replace(/\.webp$/i, ".jpg"),
      name: row.name,
    },
  ]),
);

export function itemImageSrc(index: number): string | null {
  const row = byIndex.get(index);
  if (!row) return null;
  return `/items/${row.image}`;
}
