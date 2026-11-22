"use client";

import { useMemo } from "react";
import { CollectibleCard } from "@/components/CollectibleCard";
import { MotionNavLink, PageEnter } from "@/components/motion";
import { buttonVariants } from "@/components/ui/button";
import { useItemsOnChain, resolveRevealedCards } from "@/hooks/useItemsOnChain";
import { useVaultHistory } from "@/hooks/useVaultHistory";
import { useNowSecs } from "@/hooks/useNow";
import { shortAddr } from "@/lib/format";
import { formatClock, formatMinutesLabel } from "@/lib/formatTime";
import { stackInventory } from "@/lib/stackInventory";
import { cn } from "@/lib/cn";

export default function HistoryPage() {
  const history = useVaultHistory();
  const items = useItemsOnChain();
  const nowTs = useNowSecs();
  const lots = history.data?.lots ?? [];

  const revealedCount = useMemo(
    () => lots.filter((l) => l.prizeRevealed).length,
    [lots],
  );

  return (
    <PageEnter className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl tracking-[-0.03em]">
          Prize history
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-steel-deep">
          Every vault in order — who won, what cards were packed, and what’s
          live right now. Updates with the auction clock.
        </p>
        <p className="mt-3 font-mono text-[11px] text-steel">
          {history.isLoading
            ? "Loading vaults…"
            : history.isError
              ? "Couldn’t load history — refresh to retry"
              : `${lots.length} vaults · ${revealedCount} prizes revealed`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <MotionNavLink
            href="/"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Live auction
          </MotionNavLink>
          <MotionNavLink
            href="/me#winnings"
            className={cn(buttonVariants({ variant: "paper", size: "sm" }))}
          >
            My packs
          </MotionNavLink>
        </div>
      </header>

      {lots.length === 0 && !history.isLoading && (
        <p className="bv-card p-5 text-[14px] text-steel-deep">
          No vaults yet. When lots open and finish, prizes show up here.
        </p>
      )}

      <ol className="flex flex-col gap-3">
        {lots.map((lot) => {
          const cards = lot.prizeRevealed
            ? stackInventory(
                resolveRevealedCards(lot.revealedItems, items.data),
              )
            : [];
          const left =
            lot.live && lot.deadlineTs > nowTs
              ? lot.deadlineTs - nowTs
              : 0;
          const statusLine = lot.live
            ? lot.status === "Open" && left > 0
              ? `Live · ends in ${formatClock(left)}`
              : `Live · ${lot.status}`
            : lot.prizeRevealed
              ? lot.winner
                ? "Prize revealed"
                : "Revealed · no winner"
              : lot.status;

          return (
            <li
              key={lot.vaultId}
              className="bv-card rounded-[22px] border border-line p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[16px] font-medium text-ink">
                  Vault {lot.vaultId}
                  <span className="ml-2 font-mono text-[11px] font-normal text-steel">
                    {statusLine}
                    {lot.abandoned ? " · abandoned" : ""}
                  </span>
                </p>
                <p className="font-mono text-[12px] text-steel-deep">
                  {lot.bidCount} bid{lot.bidCount === 1 ? "" : "s"}
                  {lot.highestBid > 0
                    ? ` · ${lot.highestBid / 1_000_000} SCRIP`
                    : ""}
                </p>
              </div>

              {lot.prizeRevealed ? (
                <>
                  <p className="mt-2 text-[14px] text-steel-deep">
                    {lot.winner ? (
                      <>
                        Winner{" "}
                        <span className="font-medium text-ink">
                          {shortAddr(lot.winner)}
                        </span>
                        {cards.length > 0 ? (
                          <>
                            {" "}
                            packed{" "}
                            <span className="font-medium text-ink">
                              {cards
                                .map((c) =>
                                  c.count > 1
                                    ? `${c.name} ×${c.count}`
                                    : c.name,
                                )
                                .join(", ")}
                            </span>
                          </>
                        ) : null}
                      </>
                    ) : (
                      "No winner — cards returned to the pool"
                    )}
                  </p>
                  {cards.length > 0 && (
                    <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {cards.map((item) => (
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
                  )}
                </>
              ) : lot.live ? (
                <p className="mt-2 text-[14px] text-steel-deep">
                  {lot.itemCount} sealed card
                  {lot.itemCount === 1 ? "" : "s"} · prize hidden until the
                  timer ends
                  {lot.deadlineTs > 0
                    ? ` · ~${formatMinutesLabel(
                        Math.max(60, lot.deadlineTs - (lot.openTs || nowTs)),
                      )} window`
                    : ""}
                </p>
              ) : (
                <p className="mt-2 text-[14px] text-steel-deep">
                  Waiting for reveal…
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-3">
                {lot.prizeRevealed || !lot.live ? (
                  <MotionNavLink
                    href={`/vault/${lot.vaultId}/reveal`}
                    className="text-[13px] font-medium text-accent"
                  >
                    See results
                  </MotionNavLink>
                ) : (
                  <MotionNavLink
                    href={`/vault/${lot.vaultId}`}
                    className="text-[13px] font-medium text-accent"
                  >
                    Open live lot
                  </MotionNavLink>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </PageEnter>
  );
}
