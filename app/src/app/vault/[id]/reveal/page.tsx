"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { CollectibleCard } from "@/components/CollectibleCard";
import { PackPopup } from "@/components/PackPopup";
import { shortAddr } from "@/lib/format";
import { housePda, vaultPda } from "@/lib/pdas";
import { stackInventory } from "@/lib/stackInventory";
import { useVaultLive } from "@/hooks/useVaultLive";
import {
  resolveRevealedCards,
  useItemsOnChain,
} from "@/hooks/useItemsOnChain";
import { useMyPeek } from "@/hooks/useBuyPeek";
import { useClosePeek } from "@/hooks/useClosePeek";
import { usePackPopup } from "@/hooks/usePackPopup";
import { useRefundBid } from "@/hooks/useRefundBid";
import { MotionNavLink, PageEnter, soft, motion } from "@/components/motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function RevealPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const reduceMotion = useReducedMotion();
  const vaultPk = useMemo(
    () =>
      Number.isFinite(id) && id > 0 ? vaultPda(housePda(), id).toBase58() : null,
    [id],
  );
  const vaultQ = useVaultLive(vaultPk, id);
  const itemsQ = useItemsOnChain();
  const myPeek = useMyPeek(vaultPk);
  const closePeek = useClosePeek(vaultPk, id);
  const refund = useRefundBid(vaultQ.data);
  const [skipAnim, setSkipAnim] = useState(false);
  const [replayKey, setReplayKey] = useState(0);

  const revealed = vaultQ.data?.revealedItems ?? [];
  const cards = useMemo(
    () => stackInventory(resolveRevealedCards(revealed, itemsQ.data)),
    [revealed, itemsQ.data],
  );
  const status = vaultQ.data?.status;
  const sealed =
    status === "Open" || status === "Ended" || status === "Abandoned";
  const needsPeekClose = status === "Revealed" && Boolean(myPeek.data);
  const settled = status === "Settled" || status === "Closed";
  const revealing = status === "Revealed";
  const instant = Boolean(reduceMotion || skipAnim);
  const sealedSlots = Math.max(0, Number(vaultQ.data?.itemCount ?? 0));
  const packReady =
    !sealed &&
    cards.length > 0 &&
    Boolean(vaultQ.data?.winner) &&
    (revealing || settled);
  const pack = usePackPopup({
    vaultId: id,
    winner: vaultQ.data?.winner,
    cards,
    ready: packReady,
    highestBid: vaultQ.data?.highestBid,
  });

  return (
    <PageEnter className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <p className="text-[13px] font-medium text-steel-deep">Results</p>
        <h1 className="mt-1 font-display text-4xl tracking-[-0.03em]">
          Lot {params.id}
        </h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-steel-deep">
          Cards appear here only after the auction ends. What you see is the
          real on-chain pack — not a preview.
        </p>
        <p className="mt-3 font-mono text-[11px] text-steel">
          Status {status ?? "…"} · top bid{" "}
          {(vaultQ.data?.highestBid ?? 0) / 1_000_000} SCRIP · winner{" "}
          {shortAddr(vaultQ.data?.winner)}
        </p>
      </header>

      {!sealed && (
        <div className="bv-card p-4">
          <p className="text-[14px] font-medium text-ink">
            {settled
              ? "All done"
              : revealing
                ? "Cards are open · finishing settlement"
                : `Status · ${status ?? "…"}`}
          </p>
          <p className="mt-1 text-[13px] text-steel-deep">
            {settled
              ? "The winner’s cards are under My bids."
              : revealing
                ? "Cards are visible. Ownership finishes after settle. If you bought a peek, release it so the next lot can start."
                : "Almost done — one more settlement step."}
          </p>
        </div>
      )}

      {sealed && (
        <div className="bv-card flex flex-col gap-4 p-5">
          <p className="text-[14px] text-steel-deep">
            {status === "Ended"
              ? "Bidding is closed. Cards stay hidden until reveal finishes."
              : status === "Abandoned"
                ? "No winner this round. Cards return to the pool after reveal."
                : "Still sealed. Wait for the timer — nothing private shows early."}
          </p>
          {sealedSlots > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: sealedSlots }, (_, i) => (
                <li
                  key={i}
                  className="flex aspect-[3/4] items-center justify-center rounded-2xl border border-dashed border-line bg-cardboard/70"
                >
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-steel">
                    Sealed
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {refund.canRefund && (
        <div className="bv-card flex flex-col gap-3 p-5">
          <p className="text-[14px] text-steel-deep">
            {refund.isAbandonedBidder
              ? "This lot was abandoned. Reclaim your SCRIP — you must sign; the house can’t unlock a stranger’s sealed bid."
              : "You didn’t win. Reclaim your sealed SCRIP now (while status is Revealed). You must sign — the crank can’t refund you."}
          </p>
          <Button
            variant="paper"
            onClick={() => void refund.refund()}
            disabled={refund.busy}
            className="w-fit"
          >
            {refund.busy ? "Refunding…" : "Reclaim my SCRIP"}
          </Button>
          {refund.error && (
            <p
              role="alert"
              aria-live="polite"
              className="text-[13px] font-medium text-stamp-red-deep"
            >
              {refund.error}
            </p>
          )}
        </div>
      )}

      {needsPeekClose && (
        <div className="bv-card flex flex-col gap-3 p-5">
          <p className="text-[14px] text-steel-deep">
            You bought a peek on this lot. Release it so the next auction can
            open.
          </p>
          <Button
            onClick={() => void closePeek.close()}
            disabled={closePeek.busy}
          >
            {closePeek.busy ? "Releasing…" : "Release my peek"}
          </Button>
          {closePeek.error && (
            <p
              role="alert"
              aria-live="polite"
              className="font-mono text-[11px] text-stamp-red-deep"
            >
              {closePeek.error}
            </p>
          )}
          {closePeek.sig && (
            <p className="font-mono text-[11px] text-accent">Peek released</p>
          )}
        </div>
      )}

      {!sealed && cards.length === 0 && (
        <p className="bv-card p-5 text-[14px] text-steel-deep">
          {itemsQ.isLoading
            ? "Loading cards…"
            : "No cards to show yet (this lot may have returned them to the pool)."}
        </p>
      )}

      {cards.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            {!instant && (
              <Button
                variant="paper"
                size="sm"
                onClick={() => setSkipAnim(true)}
              >
                Skip animation
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSkipAnim(false);
                setReplayKey((k) => k + 1);
              }}
            >
              Replay
            </Button>
          </div>

          <motion.div
            key={replayKey}
            className="relative overflow-hidden rounded-[28px] border border-accent/30 bg-[#071428] px-5 py-8 text-center text-ink sm:px-8"
            initial={instant ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={soft}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-steel">
              Pack opens
            </p>
            <p className="mt-2 font-display text-3xl tracking-[-0.03em] text-ink sm:text-4xl">
              {revealed.length} creature{revealed.length === 1 ? "" : "s"}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-[13px] text-steel-deep">
              {pack.owner && vaultQ.data?.winner === pack.owner
                ? "You won this pack — it’s saved under My bids."
                : "Highest bid gets these cards when settlement finishes."}
            </p>
          </motion.div>

          <motion.div
            key={`grid-${replayKey}`}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          >
            {cards.map((item, i) => (
              <motion.div
                key={`${item.index}-${item.indices.join("-")}`}
                initial={instant ? false : { opacity: 0, y: 16, rotate: -2 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{
                  ...soft,
                  delay: instant ? 0 : 0.18 + i * 0.22,
                }}
              >
                <CollectibleCard
                  index={item.index}
                  name={item.name}
                  rarity={item.rarity}
                  category={item.category}
                  value={item.value}
                  sold={item.sold}
                  count={item.count}
                />
              </motion.div>
            ))}
          </motion.div>
        </>
      )}

      <div className="flex flex-wrap gap-3">
        <MotionNavLink href="/me" className={cn(buttonVariants())}>
          My cards
        </MotionNavLink>
        <MotionNavLink
          href={`/vault/${params.id}/proof`}
          className={cn(buttonVariants({ variant: "paper" }))}
        >
          Proofs
        </MotionNavLink>
        <MotionNavLink
          href="/warehouse"
          className={cn(buttonVariants({ variant: "paper" }))}
        >
          Browse cards
        </MotionNavLink>
      </div>

      {pack.open && cards.length > 0 && (
        <PackPopup
          vaultId={id}
          cards={cards}
          onClose={pack.dismiss}
          onViewHistory={() => {
            pack.dismiss();
            router.push("/me#winnings");
          }}
        />
      )}
    </PageEnter>
  );
}
