"use client";

import { useMemo, useState } from "react";
import { CollectibleCard } from "@/components/CollectibleCard";
import { MotionNavLink, PageEnter, motion, soft } from "@/components/motion";
import { buttonVariants } from "@/components/ui/button";
import { useItemsOnChain, resolveRevealedCards } from "@/hooks/useItemsOnChain";
import { useVaultHistory } from "@/hooks/useVaultHistory";
import { useNowSecs } from "@/hooks/useNow";
import { shortAddr } from "@/lib/format";
import { formatClock } from "@/lib/formatTime";
import { stackInventory } from "@/lib/stackInventory";
import { cn } from "@/lib/cn";
import type { HistoryLot } from "@/lib/types";

type StackedCard = ReturnType<typeof stackInventory>[number];

function lotCards(
  lot: HistoryLot,
  catalog: Parameters<typeof resolveRevealedCards>[1],
): StackedCard[] {
  if (!lot.prizeRevealed || lot.revealedItems.length === 0) return [];
  return stackInventory(resolveRevealedCards(lot.revealedItems, catalog));
}

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-steel transition-transform duration-200 ease-out",
        open && "rotate-180 border-accent/40 text-accent",
      )}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M2.5 4.5L6 8l3.5-3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function FinishedLotRow({
  lot,
  cards,
  defaultOpen,
}: {
  lot: HistoryLot;
  cards: StackedCard[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const title = lot.winner
    ? lot.status === "Settled"
      ? `Winner ${shortAddr(lot.winner)}`
      : `Selected winner ${shortAddr(lot.winner)} · settlement pending`
    : lot.abandoned
      ? "Abandoned · no winner"
      : "Prize revealed";

  return (
    <li className="overflow-hidden rounded-[20px] border border-line bg-[color-mix(in_oklab,var(--color-mist)_55%,transparent)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[color-mix(in_oklab,var(--color-accent)_6%,transparent)] sm:px-5 sm:py-4"
      >
        <Chevron open={open} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[15px] font-medium text-ink">
              Vault {lot.vaultId}
              <span className="ml-2 font-mono text-[11px] font-normal text-steel">
                {lot.status}
                {lot.abandoned ? " · abandoned" : ""}
              </span>
            </p>
            <p className="font-mono text-[11px] text-steel-deep">
              {lot.bidCount} bid{lot.bidCount === 1 ? "" : "s"}
              {lot.highestBid > 0
                ? ` · ${lot.highestBid / 1_000_000} SCRIP`
                : ""}
            </p>
          </div>
          <p className="mt-1 text-[13px] text-steel-deep">
            {title}
            {cards.length > 0 ? (
              <>
                {" "}
                · {lot.status === "Settled" ? "packed" : "revealed"}{" "}
                <span className="font-medium text-ink">
                  {cards
                    .map((c) =>
                      c.count > 1 ? `${c.name} ×${c.count}` : c.name,
                    )
                    .join(", ")}
                </span>
              </>
            ) : lot.prizeRevealed ? (
              " · cards returned to pool"
            ) : null}
          </p>
        </div>
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={soft}
          className="border-t border-line/80 px-4 pb-4 pt-3 sm:px-5"
        >
          {cards.length > 0 ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
          ) : (
            <p className="text-[13px] text-steel-deep">
              No packed cards on this lot
              {lot.abandoned ? " (abandoned / returned to pool)." : "."}
            </p>
          )}
          <MotionNavLink
            href={`/vault/${lot.vaultId}/reveal`}
            className="mt-3 inline-block text-[13px] font-medium text-accent"
          >
            See full results
          </MotionNavLink>
        </motion.div>
      )}
    </li>
  );
}

export default function HistoryPage() {
  const history = useVaultHistory();
  const items = useItemsOnChain();
  const nowTs = useNowSecs();
  const lots = history.data?.lots ?? [];
  const activeVault = history.data?.activeVault ?? null;

  const { liveLots, finishedLots, stuckLots } = useMemo(() => {
    const live: HistoryLot[] = [];
    const finished: HistoryLot[] = [];
    const stuck: HistoryLot[] = [];
    for (const lot of lots) {
      const isActivePk = activeVault != null && lot.vault === activeVault;
      const biddingNow =
        lot.status === "Open" &&
        lot.deadlineTs > nowTs &&
        (isActivePk || lot.live);
      if (lot.prizeRevealed) {
        finished.push(lot);
      } else if (biddingNow || (isActivePk && lot.live)) {
        live.push(lot);
      } else {
        stuck.push(lot);
      }
    }
    return { liveLots: live, finishedLots: finished, stuckLots: stuck };
  }, [lots, activeVault, nowTs]);

  const [stuckOpen, setStuckOpen] = useState(false);

  return (
    <PageEnter className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl tracking-[-0.03em]">
          Prize history
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-steel-deep">
          Finished packs with the cards inside. Expand a vault to see the
          collectibles; scroll the list when it grows.
        </p>
        <p className="mt-3 font-mono text-[11px] text-steel">
          {history.isLoading
            ? "Loading vaults…"
            : history.isError
              ? "Couldn’t load history — refresh to retry"
              : `${finishedLots.length} finished · ${liveLots.length} live${
                  stuckLots.length ? ` · ${stuckLots.length} incomplete` : ""
                }`}
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

      {liveLots.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl tracking-[-0.02em] text-ink">
            Live now
          </h2>
          <ul className="flex flex-col gap-2">
            {liveLots.map((lot) => {
              const left = Math.max(0, lot.deadlineTs - nowTs);
              return (
                <li
                  key={lot.vaultId}
                  className="rounded-[20px] border border-accent/30 bg-[color-mix(in_oklab,var(--color-accent)_8%,transparent)] px-4 py-3.5 sm:px-5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[15px] font-medium text-ink">
                      Vault {lot.vaultId}
                      <span className="ml-2 font-mono text-[11px] font-normal text-accent">
                        Live · {lot.status}
                      </span>
                    </p>
                    <p className="font-mono text-[11px] text-steel-deep">
                      {lot.bidCount} bid{lot.bidCount === 1 ? "" : "s"}
                      {left > 0 ? ` · ends ${formatClock(left)}` : ""}
                    </p>
                  </div>
                  <p className="mt-1 text-[13px] text-steel-deep">
                    {lot.itemCount} sealed card
                    {lot.itemCount === 1 ? "" : "s"} · prize opens after the
                    timer
                  </p>
                  <MotionNavLink
                    href={`/vault/${lot.vaultId}`}
                    className="mt-2 inline-block text-[13px] font-medium text-accent"
                  >
                    Open live lot
                  </MotionNavLink>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-xl tracking-[-0.02em] text-ink">
            Finished packs
          </h2>
          <p className="font-mono text-[11px] text-steel">
            Tap a row to show cards
          </p>
        </div>

        {finishedLots.length === 0 && !history.isLoading && (
          <p className="rounded-[20px] border border-line px-4 py-5 text-[14px] text-steel-deep">
            No finished prizes yet. When a lot reveals, the packed cards show
            up here.
          </p>
        )}

        {finishedLots.length > 0 && (
          <div
            className="max-h-[min(70vh,640px)] overflow-y-auto overscroll-contain rounded-[22px] border border-line bg-cardboard/40 p-2 pr-1 sm:p-3"
            style={{ scrollbarGutter: "stable" }}
          >
            <ol className="flex flex-col gap-2">
              {finishedLots.map((lot, i) => {
                const cards = lotCards(lot, items.data);
                // Newest with cards start open so you actually see collectibles.
                const defaultOpen = i < 3 && cards.length > 0;
                return (
                  <FinishedLotRow
                    key={lot.vaultId}
                    lot={lot}
                    cards={cards}
                    defaultOpen={defaultOpen}
                  />
                );
              })}
            </ol>
          </div>
        )}
      </section>

      {stuckLots.length > 0 && (
        <section className="overflow-hidden rounded-[20px] border border-line">
          <button
            type="button"
            aria-expanded={stuckOpen}
            onClick={() => setStuckOpen((v) => !v)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
          >
            <Chevron open={stuckOpen} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-ink">
                Incomplete lots
              </p>
              <p className="mt-0.5 text-[12px] text-steel-deep">
                {stuckLots.length} older Open/stuck vault
                {stuckLots.length === 1 ? "" : "s"} with no prize cards yet
              </p>
            </div>
          </button>
          {stuckOpen && (
            <ul className="max-h-56 space-y-2 overflow-y-auto border-t border-line px-4 py-3 sm:px-5">
              {stuckLots.map((lot) => (
                <li
                  key={lot.vaultId}
                  className="flex flex-wrap items-center justify-between gap-2 text-[13px]"
                >
                  <span className="text-steel-deep">
                    Vault {lot.vaultId}
                    <span className="ml-2 font-mono text-[11px] text-steel">
                      {lot.status} · {lot.bidCount} bids
                    </span>
                  </span>
                  <MotionNavLink
                    href={`/vault/${lot.vaultId}/reveal`}
                    className="font-medium text-accent"
                  >
                    Check status
                  </MotionNavLink>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </PageEnter>
  );
}
