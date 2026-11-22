"use client";

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
    .filter((l) => l.prizeRevealed)
    .slice(0, 3);

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
      <ul className="mt-4 space-y-4">
        {recent.map((lot) => {
          const cards = stackInventory(
            resolveRevealedCards(lot.revealedItems, items.data),
          );
          const names = cards.map((c) =>
            c.count > 1 ? `${c.name} ×${c.count}` : c.name,
          );
          return (
            <li key={lot.vaultId} className="text-[13px] leading-snug">
              <p className="font-medium text-ink">
                Vault {lot.vaultId}
                <span className="ml-2 font-mono text-[11px] font-normal text-steel">
                  {lot.winner ? shortAddr(lot.winner) : "no winner"}
                </span>
              </p>
              <p className="mt-0.5 text-steel-deep">
                {names.length > 0
                  ? `Packed ${names.join(", ")}`
                  : lot.abandoned
                    ? "No winner — cards returned"
                    : "Prize recorded"}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
