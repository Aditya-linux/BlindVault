"use client";

import { CollectibleCard } from "@/components/CollectibleCard";
import { PageEnter, Stagger, StaggerItem } from "@/components/motion";
import { useItemsOnChain } from "@/hooks/useItemsOnChain";

export default function WarehousePage() {
  const onChain = useItemsOnChain();
  const rows = onChain.data ?? [];
  const soldCount = rows.filter((i) => i.sold).length;
  const legendaries = rows.filter((i) => i.rarity >= 4).length;
  const shinies = rows.filter((i) => i.rarity === 2).length;

  return (
    <PageEnter className="flex flex-col gap-8">
      <header className="max-w-xl">
        <h1 className="font-display text-4xl tracking-[-0.03em] sm:text-5xl">
          Warehouse
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-steel-deep">
          Collectible creature cards pulled from sealed vaults. Simple finds are
          common; Shinies shimmer; Legendaries wear gold.
        </p>
        <p className="mt-4 font-mono text-[11px] text-steel">
          {onChain.isLoading
            ? "Loading Item accounts…"
            : onChain.isError
              ? `Chain read failed · ${onChain.error instanceof Error ? onChain.error.message.slice(0, 80) : "retry"}`
              : `${rows.length} cards · ${shinies} shiny · ${legendaries} legendary · ${soldCount} sold`}
        </p>
      </header>

      {!onChain.isLoading && rows.length === 0 && !onChain.isError && (
        <p className="text-[14px] text-steel-deep">No items seeded on house.</p>
      )}

      <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {rows.map((item) => (
          <StaggerItem key={item.index}>
            <CollectibleCard
              index={item.index}
              name={item.name}
              rarity={item.rarity}
              category={item.category}
              value={item.value}
              sold={item.sold}
            />
          </StaggerItem>
        ))}
      </Stagger>
    </PageEnter>
  );
}
