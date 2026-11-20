"use client";

import Image from "next/image";
import { categoryLabel, rarityLabel } from "@/lib/format";
import { itemImageSrc } from "@/lib/itemArt";
import { PageEnter, Stagger, StaggerItem } from "@/components/motion";
import { useItemsOnChain } from "@/hooks/useItemsOnChain";

export default function WarehousePage() {
  const onChain = useItemsOnChain();
  const rows = onChain.data ?? [];
  const soldCount = rows.filter((i) => i.sold).length;

  return (
    <PageEnter className="flex flex-col gap-8">
      <header className="max-w-xl">
        <h1 className="font-display text-4xl tracking-[-0.03em] sm:text-5xl">
          Warehouse
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-steel-deep">
          On-chain Item PDAs only. Sold flags update after finalize.
        </p>
        <p className="mt-4 font-mono text-[11px] text-steel">
          {onChain.isLoading
            ? "Loading Item accounts…"
            : onChain.isError
              ? `Chain read failed · ${onChain.error instanceof Error ? onChain.error.message.slice(0, 80) : "retry"}`
              : `${rows.length} items · ${soldCount} sold · live`}
        </p>
      </header>

      {!onChain.isLoading && rows.length === 0 && !onChain.isError && (
        <p className="text-[14px] text-steel-deep">No items seeded on house.</p>
      )}

      <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {rows.map((item) => {
          const src = itemImageSrc(item.index);
          return (
            <StaggerItem key={item.index}>
              <article className="bv-card pressable overflow-hidden p-2.5">
                <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-mist">
                  {src ? (
                    <Image
                      src={src}
                      alt={item.name}
                      fill
                      sizes="(max-width:640px) 50vw, (max-width:1024px) 25vw, 20vw"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-end p-3">
                      <span className="font-display text-2xl text-steel">
                        {item.index}
                      </span>
                    </div>
                  )}
                  {item.sold && (
                    <span className="absolute right-2 top-2 rounded-md bg-paper/90 px-1.5 py-0.5 text-[10px] font-medium text-ink">
                      Sold
                    </span>
                  )}
                </div>
                <div className="px-1.5 pb-1.5 pt-2.5">
                  <h2 className="text-[13px] font-medium leading-snug tracking-[-0.01em]">
                    {item.name}
                  </h2>
                  <p className="mt-1 font-mono text-[10px] text-steel">
                    {rarityLabel(item.rarity)} · {categoryLabel(item.category)} ·{" "}
                    {item.value}
                  </p>
                  {item.sold && (
                    <p className="mt-1 font-mono text-[10px] text-steel-deep">
                      {item.ownerShort}
                    </p>
                  )}
                </div>
              </article>
            </StaggerItem>
          );
        })}
      </Stagger>
    </PageEnter>
  );
}
