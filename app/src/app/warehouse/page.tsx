"use client";

import { CollectibleCard } from "@/components/CollectibleCard";
import { MotionNavLink, PageEnter, Stagger, StaggerItem } from "@/components/motion";
import { useItemsOnChain } from "@/hooks/useItemsOnChain";
import { useActiveVault } from "@/hooks/useActiveVault";
import { RARITY_TIERS } from "@/lib/creatureCatalog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function WarehousePage() {
  const onChain = useItemsOnChain();
  const active = useActiveVault();
  const rows = onChain.data ?? [];
  const soldCount = rows.filter((i) => i.sold).length;
  const vaultId =
    active.data && active.data.nextVaultId > 1
      ? active.data.nextVaultId - 1
      : null;

  return (
    <PageEnter className="bv-stack">
      <header className="max-w-2xl">
        <h1 className="font-display text-[clamp(2.25rem,6vw,3.25rem)] tracking-[-0.03em]">
          Warehouse
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-steel-deep sm:text-[16px]">
          All creature cards that can go into sealed auctions. Rarer tiers glow
          more. No wallet needed to look around.
        </p>
        <p className="mt-4 font-mono text-[11px] text-steel">
          {onChain.isLoading
            ? "Loading cards…"
            : onChain.isError
              ? `Couldn’t load cards · ${onChain.error instanceof Error ? onChain.error.message.slice(0, 80) : "retry"}`
              : `${rows.length} cards · ${soldCount} already won`}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <MotionNavLink
            href="/paddle"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Set up to bid
          </MotionNavLink>
          {vaultId && vaultId > 0 && (
            <MotionNavLink
              href={`/vault/${vaultId}`}
              className={cn(buttonVariants({ variant: "paper", size: "sm" }))}
            >
              Live lot {vaultId}
            </MotionNavLink>
          )}
        </div>
      </header>

      <section aria-label="Rarity tiers" className="odds-board">
        <p className="odds-board__title">Rarity tiers</p>
        <ul className="odds-board__list">
          {RARITY_TIERS.map((tier) => (
            <li key={tier.id} className={`odds-board__item rarity-${tier.id}`}>
              <span className="odds-board__label">{tier.label}</span>
            </li>
          ))}
        </ul>
      </section>

      {!onChain.isLoading && rows.length === 0 && !onChain.isError && (
        <p className="text-[14px] text-steel-deep">No cards listed yet.</p>
      )}

      <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 lg:gap-5">
        {rows.map((item) => (
          <StaggerItem key={item.index} className="overflow-visible">
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
