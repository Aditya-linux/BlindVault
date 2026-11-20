"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
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
  const vaultPk = useMemo(
    () =>
      Number.isFinite(id) && id > 0 ? vaultPda(housePda(), id).toBase58() : null,
    [id],
  );
  const vaultQ = useVaultLive(vaultPk, id);
  const itemsQ = useItemsOnChain();
  const myPeek = useMyPeek(vaultPk);
  const closePeek = useClosePeek(vaultPk, id);
  const revealed = vaultQ.data?.revealedItems ?? [];
  const cards = revealed
    .map((idx) => itemsQ.data?.find((x) => x.index === idx))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const sealed =
    vaultQ.data?.status === "Open" || vaultQ.data?.status === "Ended";
  const needsPeekClose =
    vaultQ.data?.status === "Revealed" && Boolean(myPeek.data);

  return (
    <PageEnter className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <p className="text-[13px] font-medium text-steel-deep">Reveal</p>
        <h1 className="mt-1 font-display text-4xl tracking-[-0.03em]">
          Lot {params.id}
        </h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-steel-deep">
          After the clock, the sealed cards open. The highest sealed bid wins
          these creature cards into their wallet (see <strong>My bids</strong>).
        </p>
        <p className="mt-3 font-mono text-[11px] text-steel">
          Status {vaultQ.data?.status ?? "…"} · high bid{" "}
          {(vaultQ.data?.highestBid ?? 0) / 1_000_000} SCRIP · winner{" "}
          {shortAddr(vaultQ.data?.winner)}
        </p>
      </header>

      {sealed && (
        <p className="bv-card p-5 text-[14px] text-steel-deep">
          Still sealed — wait for the operator/keeper to run reveal after the
          deadline.
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
        <motion.div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={soft}
        >
          {cards.map((item) => (
            <CollectibleCard
              key={item.index}
              index={item.index}
              name={item.name}
              rarity={item.rarity}
              category={item.category}
              value={item.value}
              sold={item.sold}
            />
          ))}
        </motion.div>
      )}

      <div className="flex flex-wrap gap-3">
        <MotionNavLink
          href="/me"
          className={cn(buttonVariants())}
        >
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
