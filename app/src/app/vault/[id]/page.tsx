"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { sizeLabel, shortAddr } from "@/lib/format";
import { housePda, vaultPda } from "@/lib/pdas";
import { Countdown } from "@/components/Countdown";
import { VaultHints } from "@/components/VaultHints";
import { useVaultLive } from "@/hooks/useVaultLive";
import { useHintsLive } from "@/hooks/useHintsLive";
import { useMyBid } from "@/hooks/useMyBid";
import { usePlaceBid } from "@/hooks/usePlaceBid";
import { useBuyPeek, useMyPeek } from "@/hooks/useBuyPeek";
import { useHintPublisher } from "@/hooks/useHintPublisher";
import { useLotCloser } from "@/hooks/useLotCloser";
import { useRefundBid } from "@/hooks/useRefundBid";
import { useTeeAuth } from "@/hooks/useTeeAuth";
import { useActiveVault } from "@/hooks/useActiveVault";
import { teeTxUrl } from "@/lib/explorer";
import {
  MotionNavLink,
  PageEnter,
  soft,
  spring,
  motion,
} from "@/components/motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatMinutesLabel } from "@/lib/formatTime";
import { useNowSecs } from "@/hooks/useNow";
import { useStableNextLotEta } from "@/hooks/useStableNextLotEta";
import { listRememberedBids } from "@/lib/bidMemory";

export default function LiveVaultPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const house = useMemo(() => housePda(), []);
  const vaultPk = useMemo(
    () =>
      Number.isFinite(id) && id > 0 ? vaultPda(house, id).toBase58() : null,
    [house, id],
  );
  const vaultQ = useVaultLive(vaultPk, id);
  const hintsQ = useHintsLive(vaultPk, id);
  const myBid = useMyBid(vaultPk);
  const place = usePlaceBid(vaultQ.data);
  const peek = useBuyPeek(vaultQ.data);
  const myPeek = useMyPeek(vaultPk);
  const tee = useTeeAuth();
  const active = useActiveVault();
  const { connected, publicKey } = useWallet();
  useHintPublisher(vaultQ.data);
  const closer = useLotCloser(vaultQ.data);
  const refund = useRefundBid(vaultQ.data);

  // After claim succeeds, open the reveal / pack screen.
  useEffect(() => {
    if (closer.completedVaultId != null && closer.completedVaultId === id) {
      router.push(`/vault/${id}/reveal`);
    }
  }, [closer.completedVaultId, id, router]);

  const houseActivePk = active.data?.activeVault?.toBase58() ?? null;
  const liveLotId =
    active.data && houseActivePk && active.data.nextVaultId > 1
      ? active.data.nextVaultId - 1
      : null;
  const otherLiveLot =
    liveLotId != null &&
    liveLotId !== id &&
    Boolean(houseActivePk) &&
    houseActivePk !== vaultPk;
  const otherVaultPk = useMemo(
    () =>
      otherLiveLot && liveLotId
        ? vaultPda(house, liveLotId).toBase58()
        : null,
    [otherLiveLot, liveLotId, house],
  );
  const otherLive = useVaultLive(otherVaultPk, otherLiveLot ? liveLotId : null);

  const minBid = vaultQ.data
    ? vaultQ.data.minBid / 1_000_000
    : (active.data?.minBid[0] ?? 10_000_000) / 1_000_000;
  const peekFeeScr = vaultQ.data ? vaultQ.data.peekFee / 1_000_000 : 0;
  const [amount, setAmount] = useState(10);
  const [showTeeNote, setShowTeeNote] = useState(false);
  const owner = publicKey?.toBase58() ?? null;
  const rememberedBid = useMemo(
    () =>
      owner && vaultPk
        ? listRememberedBids(owner).find((bid) => bid.vaultId === id)
        : undefined,
    [owner, vaultPk, id, place.lastSig, myBid.dataUpdatedAt],
  );
  const hasPlacedBid = Boolean(myBid.data || rememberedBid);
  const placedAmount = myBid.data
    ? myBid.data.amount / 1_000_000
    : rememberedBid?.amountScrip;

  useEffect(() => {
    setAmount((prev) => (prev < minBid ? minBid : prev));
  }, [minBid]);

  const lotFinished =
    vaultQ.data?.status === "Revealed" ||
    vaultQ.data?.status === "Closed" ||
    vaultQ.data?.status === "Settled" ||
    vaultQ.data?.status === "Abandoned";

  const hints = hintsQ.data?.hints ?? [];
  const nowTs = useNowSecs();
  const pastDeadline =
    Boolean(vaultQ.data?.deadlineTs) &&
    vaultQ.data!.deadlineTs > 0 &&
    nowTs >= vaultQ.data!.deadlineTs;
  const openForBid =
    vaultQ.data?.status === "Open" && !pastDeadline;
  const typicalSecs =
    active.data?.durationSecs?.[vaultQ.data?.size ?? 0] ||
    active.data?.durationSecs?.[0] ||
    vaultQ.data?.durationSecs ||
    180;
  const nextOpenForBid =
    Boolean(otherLiveLot) &&
    otherLive.data?.status === "Open" &&
    Boolean(otherLive.data.deadlineTs) &&
    otherLive.data.deadlineTs > nowTs;
  const nextEta = useStableNextLotEta({
    enabled: (pastDeadline || lotFinished) && !nextOpenForBid,
    deadlineTs: vaultQ.data?.deadlineTs,
    status: vaultQ.data?.status,
    nowTs,
    vaultId: id,
  });

  const statusLabel = vaultQ.isLoading
    ? "Loading…"
    : vaultQ.isError
      ? "Error"
      : !vaultQ.data
        ? "Unavailable"
        : pastDeadline && vaultQ.data.status === "Open"
          ? "Bidding closed"
          : vaultQ.data.status;

  const metaLine = [
    vaultQ.data ? sizeLabel(vaultQ.data.size) : null,
    vaultQ.data
      ? `${vaultQ.data.itemCount} sealed card${vaultQ.data.itemCount === 1 ? "" : "s"}`
      : null,
    `${vaultQ.data?.bidCount ?? 0} bid${(vaultQ.data?.bidCount ?? 0) === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  // One priority strip — never stack Join + Results + NextBid + Claim.
  const priority: "join" | "claim" | "refund" | "wait" | "results" | null =
    nextOpenForBid && liveLotId != null
      ? "join"
      : closer.needsAction
        ? "claim"
        : refund.canRefund
          ? "refund"
          : pastDeadline &&
              vaultQ.data?.status === "Open" &&
              (vaultQ.data?.bidCount ?? 0) > 0 &&
              !closer.needsAction
            ? "wait"
            : lotFinished
              ? "results"
              : null;

  return (
    <PageEnter className="mx-auto flex w-full max-w-5xl flex-col gap-10 sm:gap-12">
      {priority === "join" && liveLotId != null && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-accent/30 pb-6">
          <div>
            <p className="font-display text-2xl tracking-[-0.03em] text-ink">
              Lot {liveLotId} is live
            </p>
            <p className="mt-1 text-[14px] text-steel-deep">
              This page is finished. Bid on the open vault.
            </p>
          </div>
          <MotionNavLink
            href={`/vault/${liveLotId}`}
            className={cn(buttonVariants({ size: "lg" }))}
          >
            Join lot {liveLotId}
          </MotionNavLink>
        </div>
      )}

      {priority === "claim" && (
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-accent/30 pb-6">
          <div className="max-w-lg">
            <p className="font-display text-2xl tracking-[-0.03em] text-ink">
              {closer.busy
                ? "Almost there"
                : closer.canEnd
                  ? "Claim your pack"
                  : closer.canReveal
                    ? "Reveal the pack"
                    : "Save your pack"}
            </p>
            <p className="mt-1 text-[14px] text-steel-deep">
              {closer.busy
                ? closer.phase ??
                  "Approve each Phantom popup. You’ll see the cards next."
                : "Tap once — approve in Phantom when asked. Then we open what you won."}
            </p>
            {closer.error && (
              <p
                role="alert"
                className="mt-2 text-[13px] font-medium text-stamp-red-deep"
              >
                {closer.error}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              onClick={() => void closer.run()}
              disabled={closer.busy}
            >
              {closer.busy
                ? "Waiting on Phantom…"
                : closer.error
                  ? "Try claim again"
                  : "Claim my pack"}
            </Button>
            <MotionNavLink
              href={`/vault/${params.id}/reveal`}
              className="text-[13px] font-medium text-accent"
            >
              Results
            </MotionNavLink>
          </div>
        </div>
      )}

      {priority === "refund" && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
          <p className="max-w-md text-[14px] text-steel-deep">
            {refund.isAbandonedBidder
              ? "This lot was cleared. Reclaim your SCRIP (you must sign)."
              : "You didn’t win — reclaim your sealed SCRIP."}
          </p>
          <Button
            variant="paper"
            onClick={() => void refund.refund()}
            disabled={refund.busy}
          >
            {refund.busy ? "Refunding…" : "Reclaim SCRIP"}
          </Button>
        </div>
      )}

      {priority === "wait" && (
        <div className="border-b border-line pb-6">
          <p className="font-display text-xl tracking-[-0.02em] text-ink">
            Waiting on the sealed bidder
          </p>
          <p className="mt-1 max-w-lg text-[14px] text-steel-deep">
            Connect the wallet that bid, Sign in, then claim. Or open the live
            lot when Join appears on Home (~
            {formatMinutesLabel(typicalSecs)} each).
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {!tee.token && connected && (
              <Button
                variant="paper"
                size="sm"
                onClick={() => void tee.signGuestBook()}
              >
                Sign in
              </Button>
            )}
            <MotionNavLink
              href="/"
              className={cn(buttonVariants({ variant: "paper", size: "sm" }))}
            >
              Home
            </MotionNavLink>
          </div>
        </div>
      )}

      <header className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-[13px] font-medium text-steel-deep">
            {openForBid ? "Live auction" : "Lot archive"}
          </p>
          <h1 className="mt-1 font-display text-[clamp(2.5rem,7vw,3.75rem)] tracking-[-0.04em] text-ink">
            Lot {params.id}
          </h1>
          <p className="mt-3 text-[14px] text-steel-deep">
            <span className="text-ink">{statusLabel}</span>
            {metaLine ? ` · ${metaLine}` : ""}
            {hasPlacedBid ? " · your bid is in" : ""}
          </p>
          {priority === "results" && (
            <MotionNavLink
              href={`/vault/${params.id}/reveal`}
              className="mt-4 inline-block text-[14px] font-medium text-accent"
            >
              See what was inside →
            </MotionNavLink>
          )}
          {vaultQ.isError && (
            <p className="mt-2 text-[13px] text-stamp-red-deep">
              TEE read failed — retrying
            </p>
          )}
        </div>

        {openForBid || (nextEta && !nextOpenForBid) ? (
          <Countdown
            tone={nextEta ? "next" : "bid"}
            deadlineTs={
              nextEta
                ? nextEta.displayReadyTs
                : (vaultQ.data?.deadlineTs ?? 0)
            }
            activeLabel={nextEta ? "Next lot ~" : "Ends in"}
            expiredLabel={
              nextEta?.getReady
                ? "Watch Home"
                : nextEta
                  ? "Opening…"
                  : "Closed"
            }
            getReady={Boolean(nextEta?.getReady)}
            expiredHint={
              nextEta?.getReady
                ? "Home shows Join when bidding is live."
                : undefined
            }
          />
        ) : null}
      </header>

      <section
        className={cn(
          "grid gap-10 lg:gap-14",
          openForBid
            ? "lg:grid-cols-[1.2fr_0.9fr]"
            : "lg:grid-cols-1 lg:max-w-2xl",
        )}
      >
        <VaultHints
          hints={
            hints.length
              ? hints
              : [0, 1, 2, 3].map((kind) => ({
                  kind,
                  a: 0,
                  b: 0,
                  released: false,
                  releasedTs: 0,
                }))
          }
          openTs={vaultQ.data?.openTs}
          hintTimes={vaultQ.data?.hintTimes}
          nowTs={nowTs}
        />

        {openForBid && (
          <aside className="flex flex-col gap-6 lg:border-l lg:border-line/70 lg:pl-10">
            <div>
              <h2 className="font-display text-[1.65rem] tracking-[-0.03em]">
                Your bid
              </h2>
              <p className="mt-1 text-[13px] text-steel-deep">
                One sealed bid per wallet · min {minBid} SCRIP
              </p>
            </div>

            {!connected ? (
              <p className="text-[14px] text-steel-deep">
                Connect a Devnet wallet (top right) to bid.
              </p>
            ) : !tee.token && !hasPlacedBid ? (
              <Button
                variant="paper"
                onClick={() => void tee.signGuestBook()}
                className="w-fit"
              >
                Sign in to bid
              </Button>
            ) : null}

            {hasPlacedBid ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={spring}
              >
                <p className="text-[15px] font-medium text-ink">Bid locked in</p>
                {placedAmount != null && (
                  <p className="mt-1 font-mono text-[13px] text-steel-deep">
                    {placedAmount} SCRIP
                  </p>
                )}
                <Button size="lg" className="mt-4 w-full" disabled>
                  Bid placed
                </Button>
              </motion.div>
            ) : (
              <div className="flex flex-col gap-4">
                <label
                  htmlFor="bid-amount"
                  className="block text-[13px] font-medium text-ink"
                >
                  Amount
                  <div className="mt-2 flex items-center gap-2 border-b border-line pb-2 focus-within:border-accent">
                    <input
                      id="bid-amount"
                      name="bidAmount"
                      type="number"
                      inputMode="decimal"
                      autoComplete="off"
                      spellCheck={false}
                      min={minBid}
                      step="any"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="w-full min-w-0 bg-transparent font-mono text-[22px] tabular-nums outline-none"
                    />
                    <span className="shrink-0 text-[12px] text-steel-deep">
                      SCRIP
                    </span>
                  </div>
                </label>

                <Button
                  size="lg"
                  onClick={() => void place.placeBid(amount)}
                  disabled={
                    place.busy ||
                    myBid.isLoading ||
                    !connected ||
                    !tee.token ||
                    pastDeadline ||
                    vaultQ.data?.status !== "Open"
                  }
                >
                  {place.busy ? "Placing…" : "Place sealed bid"}
                </Button>

                <button
                  type="button"
                  onClick={() => setShowTeeNote((v) => !v)}
                  className="self-start text-left text-[12px] text-steel underline-offset-2 hover:text-ink hover:underline"
                >
                  {showTeeNote ? "Hide" : "About"} Phantom “unsafe” warning
                </button>
                {showTeeNote && (
                  <p className="text-[12px] leading-relaxed text-steel-deep">
                    Phantom may show “simulation reverted / Confirm (unsafe)” on
                    TEE bids — it’s checking public Devnet, not MagicBlock.
                    Confirm on a first bid; SCRIP only locks if the TEE tx
                    succeeds.
                  </p>
                )}
              </div>
            )}

            {place.error && (
              <p
                role="alert"
                className="text-[13px] font-medium text-stamp-red-deep"
              >
                {place.error}
              </p>
            )}
            {place.lastSig && (
              <a
                className="font-mono text-[11px] text-accent underline"
                href={teeTxUrl(place.lastSig)}
                target="_blank"
                rel="noreferrer"
              >
                {shortAddr(place.lastSig)}
              </a>
            )}

            <div className="border-t border-line/70 pt-6">
              <p className="text-[13px] font-medium text-ink">Peek</p>
              <p className="mt-1 text-[13px] text-steel-deep">
                {peekFeeScr} SCRIP · one slot’s rarity, only you see it
              </p>
              {myPeek.data ? (
                <motion.p
                  className="mt-3 font-mono text-[13px] text-steel-deep"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={soft}
                >
                  Slot {myPeek.data.slot} · {myPeek.data.rarityLabel} ·{" "}
                  {myPeek.data.categoryLabel}
                </motion.p>
              ) : (
                <Button
                  variant="paper"
                  size="sm"
                  className="mt-3"
                  onClick={() => void peek.buyPeek()}
                  disabled={
                    peek.busy ||
                    !openForBid ||
                    !tee.token ||
                    !connected
                  }
                >
                  {peek.busy ? "Buying…" : "Buy peek"}
                </Button>
              )}
              {peek.error && (
                <p
                  role="alert"
                  className="mt-2 text-[12px] text-stamp-red-deep"
                >
                  {peek.error}
                </p>
              )}
            </div>

            <MotionNavLink
              href={`/vault/${params.id}/proof`}
              className="text-[12px] font-medium text-steel hover:text-accent"
            >
              Proofs
            </MotionNavLink>
          </aside>
        )}
      </section>

      {!openForBid && priority !== "join" && (
        <p className="text-[13px] text-steel-deep">
          <MotionNavLink href="/" className="font-medium text-accent">
            Home
          </MotionNavLink>
          {" · "}
          next lots ~{formatMinutesLabel(typicalSecs)}
          {nextEta?.phaseLabel ? ` · ${nextEta.phaseLabel}` : ""}
        </p>
      )}
    </PageEnter>
  );
}
