"use client";

import { CollectibleCard } from "@/components/CollectibleCard";
import { MotionNavLink } from "@/components/motion";
import { useItemsOnChain, resolveRevealedCards } from "@/hooks/useItemsOnChain";
import { useVaultHistory } from "@/hooks/useVaultHistory";
import { shortAddr } from "@/lib/format";
import { stackInventory } from "@/lib/stackInventory";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/** Compact synced prize chain for Home — same source as /history. */
export function RecentPrizes({ className }: { className?: string }) {
  const history = useVaultHistory();
  const items = useItemsOnChain();
  const recent = (history.data?.lots ?? [])
    .filter((l) => l.prizeRevealed && l.revealedItems.length > 0)
    .slice(0, 4);

  if (history.isLoading && recent.length === 0) {
    return (
      <div className={cn("bv-card text-left", className)}>
        <p className="text-[13px] text-steel-deep">Loading prize history…</p>
      </div>
    );
  }

  if (recent.length === 0) {
    return (
      <div className={cn("bv-card text-left", className)}>
        <p className="text-[14px] font-medium text-ink">Prize history</p>
        <p className="mt-2 text-[13px] leading-relaxed text-steel-deep">
          Finished vaults will list winners and packed cards here.
        </p>
        <MotionNavLink
          href="/history"
          className={cn(buttonVariants({ variant: "paper", size: "sm" }), "mt-4")}
        >
          Open history
        </MotionNavLink>
      </div>
    );
  }

  return (
    <div className={cn("bv-card text-left", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[14px] font-medium text-ink">Recent prizes</p>
        <MotionNavLink
          href="/history"
          className="shrink-0 text-[12px] font-medium text-accent"
        >
          Full history
        </MotionNavLink>
      </div>
      <div className="mt-4 max-h-80 space-y-4 overflow-y-auto overscroll-contain pr-1">
        {recent.map((lot) => {
          const cards = stackInventory(
            resolveRevealedCards(lot.revealedItems, items.data),
          );
          return (
            <div key={lot.vaultId}>
              <p className="text-[13px] font-medium text-ink">
                Vault {lot.vaultId}
                <span className="ml-2 font-mono text-[11px] font-normal text-steel">
                  {lot.winner ? shortAddr(lot.winner) : "no winner"}
                </span>
              </p>
              {cards.length > 0 ? (
                <ul className="mt-2 grid grid-cols-3 gap-1.5">
                  {cards.slice(0, 3).map((item) => (
                    <li key={`${lot.vaultId}-${item.index}`}>
                      <CollectibleCard
                        index={item.index}
                        name={item.name}
                        rarity={item.rarity}
                        category={item.category}
                        value={item.value}
                        count={item.count}
                        compact
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-0.5 text-[13px] text-steel-deep">
                  {lot.abandoned
                    ? "No winner — cards returned"
                    : "Prize recorded"}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
