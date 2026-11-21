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
    <PageEnter className="flex flex-col gap-8">
      <header className="max-w-2xl">
        <h1 className="font-display text-4xl tracking-[-0.03em] sm:text-5xl">
          Warehouse
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-steel-deep">
          Creature cards that can be sealed into private vaults. Pull odds below
          — rarer tiers shimmer harder. No wallet needed to browse.
        </p>
        <p className="mt-4 font-mono text-[11px] text-steel">
          {onChain.isLoading
            ? "Loading Item accounts…"
            : onChain.isError
              ? `Chain read failed · ${onChain.error instanceof Error ? onChain.error.message.slice(0, 80) : "retry"}`
              : `${rows.length} cards · ${soldCount} sold · live`}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <MotionNavLink
            href="/paddle"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Get paddle
          </MotionNavLink>
          {vaultId && vaultId > 0 && (
            <MotionNavLink
              href={`/vault/${vaultId}`}
              className={cn(buttonVariants({ variant: "paper", size: "sm" }))}
            >
              Active lot {vaultId}
            </MotionNavLink>
          )}
        </div>
      </header>

      <section
        aria-label="Pull odds"
        className="odds-board"
      >
        <p className="odds-board__title">Pull odds</p>
        <ul className="odds-board__list">
          {RARITY_TIERS.map((tier) => (
            <li key={tier.id} className={`odds-board__item rarity-${tier.id}`}>
              <span className="odds-board__label">{tier.label}</span>
              <span className="odds-board__chance">{tier.chance}</span>
            </li>
          ))}
        </ul>
      </section>

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
