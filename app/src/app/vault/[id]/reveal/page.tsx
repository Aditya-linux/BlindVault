"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { CollectibleCard } from "@/components/CollectibleCard";
import { shortAddr } from "@/lib/format";
import { housePda, vaultPda } from "@/lib/pdas";
import { useVaultLive } from "@/hooks/useVaultLive";
import { useItemsOnChain } from "@/hooks/useItemsOnChain";
import { useMyPeek } from "@/hooks/useBuyPeek";
import { useClosePeek } from "@/hooks/useClosePeek";
import { MotionNavLink, PageEnter, soft, motion } from "@/components/motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function RevealPage() {
  const params = useParams<{ id: string }>();
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
  const [skipAnim, setSkipAnim] = useState(false);
  const [replayKey, setReplayKey] = useState(0);

  const revealed = vaultQ.data?.revealedItems ?? [];
  const cards = revealed
    .map((idx) => itemsQ.data?.find((x) => x.index === idx))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const sealed =
    vaultQ.data?.status === "Open" || vaultQ.data?.status === "Ended";
  const needsPeekClose =
    vaultQ.data?.status === "Revealed" && Boolean(myPeek.data);

  const status = vaultQ.data?.status;
  const settled =
    status === "Settled" || status === "Closed" || status === "Abandoned";
  const revealing = status === "Revealed";
  const instant = Boolean(reduceMotion || skipAnim);

  return (
    <PageEnter className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <p className="text-[13px] font-medium text-steel-deep">Reveal</p>
        <h1 className="mt-1 font-display text-4xl tracking-[-0.03em]">
          Lot {params.id}
        </h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-steel-deep">
          The vault opens only after on-chain reveal. Cards below are the real
          indices from VaultContents — not a preview mock.
        </p>
        <p className="mt-3 font-mono text-[11px] text-steel">
          Status {status ?? "…"} · high bid{" "}
          {(vaultQ.data?.highestBid ?? 0) / 1_000_000} SCRIP · winner{" "}
          {shortAddr(vaultQ.data?.winner)}
        </p>
      </header>

      {/* Settlement vs ownership */}
      {!sealed && (
        <div className="bv-card p-4">
          <p className="text-[14px] font-medium text-ink">
            {settled
              ? "Settlement complete"
              : revealing
                ? "Revealed — settlement pending"
                : `Status · ${status ?? "…"}`}
          </p>
          <p className="mt-1 text-[13px] text-steel-deep">
            {settled
              ? "Winner should hold the SPL cards in wallet (check My bids). Losers refund via their own refund path when required."
              : revealing
                ? "Cards are visible, but ownership transfer finishes after settle → close → finalize. Release your peek if you bought one."
                : "Waiting for the next settlement step."}
          </p>
        </div>
      )}

      {sealed && (
        <p className="bv-card p-5 text-[14px] text-steel-deep">
          Still sealed — wait for the keeper to run reveal after the deadline.
          Nothing private is shown here early.
        </p>
      )}

      {needsPeekClose && (
        <div className="bv-card flex flex-col gap-3 p-5">
          <p className="text-[14px] text-steel-deep">
            You bought a private peek on this lot. Release it so the round can
            finalize and a new vault can open.
          </p>
          <Button
            onClick={() => void closePeek.close()}
            disabled={closePeek.busy}
          >
            {closePeek.busy ? "Releasing…" : "Release my peek"}
          </Button>
          {closePeek.error && (
            <p className="font-mono text-[11px] text-stamp-red-deep">
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
          No revealed items yet (abandoned lots may have returned cards to the
          pool).
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
            className="relative overflow-hidden rounded-[28px] border border-line bg-ink px-5 py-8 text-center text-paper sm:px-8"
            initial={instant ? false : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={soft}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-paper/55">
              Vault opens
            </p>
            <p className="mt-2 font-display text-3xl tracking-[-0.03em] sm:text-4xl">
              {cards.length} creature{cards.length === 1 ? "" : "s"}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-[13px] text-paper/70">
              Highest sealed bid claims these cards after finalize.
            </p>
          </motion.div>

          <motion.div
            key={`grid-${replayKey}`}
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          >
            {cards.map((item, i) => (
              <motion.div
                key={item.index}
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
          Evidence
        </MotionNavLink>
        <MotionNavLink
          href="/warehouse"
          className={cn(buttonVariants({ variant: "paper" }))}
        >
          Warehouse
        </MotionNavLink>
      </div>
    </PageEnter>
  );
}
