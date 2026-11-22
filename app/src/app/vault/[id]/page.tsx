"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "@/components/motion";
import { hintCopy } from "@/lib/hints";
import { sizeLabel, shortAddr } from "@/lib/format";
import { housePda, vaultPda } from "@/lib/pdas";
import { Countdown } from "@/components/Countdown";
import { NextBidWindow } from "@/components/NextBidWindow";
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
import { solanaTxUrl, teeTxUrl } from "@/lib/explorer";
import { MotionNavLink, PageEnter, soft, spring } from "@/components/motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatMinutesLabel } from "@/lib/formatTime";
import { useNowSecs } from "@/hooks/useNow";
import { useStableNextLotEta } from "@/hooks/useStableNextLotEta";

export default function LiveVaultPage() {
  const params = useParams<{ id: string }>();
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
  const { connected } = useWallet();
  useHintPublisher(vaultQ.data);
  const closer = useLotCloser(vaultQ.data);
  const refund = useRefundBid(vaultQ.data);

  // When this lot is done, the house may already have a *new* Open lot —
  // staying here with a “next bid” clock looked like bidding restarted on
  // this page. Detect the live lot and push a Join CTA.
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

  useEffect(() => {
    setAmount((prev) => (prev < minBid ? minBid : prev));
  }, [minBid]);

  const lotFinished =
    vaultQ.data?.status === "Revealed" ||
    vaultQ.data?.status === "Closed" ||
    vaultQ.data?.status === "Settled" ||
    vaultQ.data?.status === "Abandoned";

  const hints = hintsQ.data?.hints ?? [];
  const released = hints.filter((h) => h.released);
  const nowTs = useNowSecs();
  const pastDeadline =
    Boolean(vaultQ.data?.deadlineTs) &&
    vaultQ.data!.deadlineTs > 0 &&
    nowTs >= vaultQ.data!.deadlineTs;
  // Prefer house timing for “new lots” copy — this vault may still be an old 10m lot.
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
    // Stop the fake “next bid” clock once a real Open lot exists elsewhere.
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
          ? "Ended (clock)"
          : vaultQ.data.status;

  return (
    <PageEnter className="bv-stack">
      {nextOpenForBid && liveLotId != null && (
        <div className="bv-card flex flex-wrap items-center justify-between gap-3 border-accent/40 bg-[color-mix(in_oklab,var(--color-accent)_12%,transparent)] p-4 sm:p-5">
          <div>
            <p className="text-[15px] font-medium text-ink">
              Lot {liveLotId} is open — you can bid now
            </p>
            <p className="mt-1 text-[13px] text-steel-deep">
              This page is the previous lot. Bidding moved to the new vault.
            </p>
          </div>
          <MotionNavLink
            href={`/vault/${liveLotId}`}
            className={cn(buttonVariants({ size: "lg" }))}
          >
            Join lot {liveLotId} · bid now
          </MotionNavLink>
        </div>
      )}

      {lotFinished && (
        <div className="bv-card flex flex-wrap items-center justify-between gap-3">
          <p className="text-[14px] leading-relaxed text-steel-deep">
            This auction is over — see what was inside and who won.
          </p>
          <MotionNavLink
            href={`/vault/${params.id}/reveal`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            See results
          </MotionNavLink>
        </div>
      )}

      <header className="flex flex-wrap items-end justify-between gap-4 sm:gap-6">
        <div>
          <p className="text-[13px] font-medium text-steel-deep">Live auction</p>
          <h1 className="mt-1 font-display text-[clamp(2.25rem,6vw,3.25rem)] tracking-[-0.03em] text-ink">
            Lot {params.id}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="bv-chip bv-chip-live">{statusLabel}</span>
            <span className="bv-chip">
              {vaultQ.data ? sizeLabel(vaultQ.data.size) : "—"}
            </span>
            <span className="bv-chip">
              {vaultQ.data?.bidCount ?? 0} sealed bids
            </span>
            <span className="bv-chip">
              {vaultQ.data?.peeksSold ?? 0} peeks
            </span>
            {vaultQ.isError && (
              <span className="bv-chip text-stamp-red">
                TEE read failed — retrying
              </span>
            )}
          </div>
          {pastDeadline && vaultQ.data?.status === "Open" && (
            <p className="mt-3 rounded-xl border border-stamp-red/35 bg-[#2a1218]/85 px-3 py-2 text-[13px] font-medium text-stamp-red-deep">
              Bidding is closed. The next auction opens after this lot wraps up
              — see the timer below.
            </p>
          )}
        </div>
        <Countdown
          tone={nextEta ? "next" : "bid"}
          deadlineTs={
            nextEta
              ? nextEta.displayReadyTs
              : (vaultQ.data?.deadlineTs ?? 0)
          }
          activeLabel={nextEta ? "Next bid in" : "Bidding ends in"}
          expiredLabel={
            nextEta?.getReady
              ? "Get ready"
              : nextEta
                ? "Opening soon"
                : "Bidding closed"
          }
          getReady={Boolean(nextEta?.getReady)}
          expiredHint={
            nextEta
              ? nextEta.getReady
                ? `Stay ready — tap Join when the next lot opens (~${formatMinutesLabel(typicalSecs)} each).`
                : `Next auction timer — wraps up this lot, then opens the next (~${formatMinutesLabel(typicalSecs)} each).`
              : vaultQ.data
                ? `When this hits zero, the green next-bid timer starts (~${formatMinutesLabel(typicalSecs)} lots).`
                : undefined
          }
        />
      </header>

      {(pastDeadline || lotFinished) && (
        <NextBidWindow
          className="mb-6"
          reason={lotFinished ? "settling" : "lot-ended"}
          typicalDurationSecs={typicalSecs}
          nextReadyTs={nextEta?.displayReadyTs}
          getReady={Boolean(nextEta?.getReady)}
          timerLabel="Bidding opens in"
          phaseHint={nextEta?.phaseLabel}
        />
      )}

      {(closer.canEnd || closer.canSettle) && (
        <div className="bv-card mb-6 flex flex-col gap-3 p-5">
          <p className="text-[14px] text-steel-deep">
            {closer.canEnd
              ? "You bid on this lot. Tap below to close bidding so cards can reveal. Your amount stays private."
              : "You won — confirm settlement so the next auction can open."}
          </p>
          <Button
            onClick={() => void closer.run()}
            disabled={closer.busy}
            className="w-fit"
          >
            {closer.busy
              ? "Working…"
              : closer.canEnd
                ? "Close bidding"
                : "Claim my win"}
          </Button>
          {closer.error && (
            <p
              role="alert"
              aria-live="polite"
              className="font-mono text-[11px] text-stamp-red-deep"
            >
              {closer.error}
            </p>
          )}
          {closer.sig && (
            <p className="font-mono text-[11px] text-accent">
              Sent · {closer.sig.slice(0, 12)}…
            </p>
          )}
        </div>
      )}

      {refund.canRefund && (
        <div className="bv-card mb-6 flex flex-col gap-3 p-5">
          <p className="text-[14px] text-steel-deep">
            {refund.isAbandonedBidder
              ? "This lot was abandoned. Unlock your SCRIP approve so the next auction can continue."
              : "You didn’t win — reclaim your sealed SCRIP (you must sign; the house can’t do this for you)."}
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

      {pastDeadline &&
        vaultQ.data?.status === "Open" &&
        connected &&
        !closer.hasMyBid && (
          <p className="mb-6 text-[13px] text-steel-deep">
            {(vaultQ.data?.bidCount ?? 0) === 0
              ? `No bids this round — the house crank is closing it so the next ~${formatMinutesLabel(typicalSecs)} auction can open.`
              : `A sealed bidder (or the house crank) must close this lot before the next auction. Typical lots run ~${formatMinutesLabel(typicalSecs)}.`}
          </p>
        )}

      <section className="grid gap-5 md:gap-6 lg:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-5">
          <article className="bv-card p-6 sm:p-7">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl tracking-[-0.02em]">Hints</h2>
              <span className="font-mono text-[11px] text-steel">
                {released.length}/4
              </span>
            </div>

            <ul className="mt-5 space-y-3">
              {released.length === 0 && (
                <li className="rounded-2xl border border-line bg-cardboard/90 px-4 py-3 text-[14px] text-steel-deep">
                  No public hints yet. Clues unlock automatically as time
                  passes.
                </li>
              )}
              {released.map((h) => (
                <motion.li
                  key={h.kind}
                  className="rounded-2xl border border-accent/25 bg-[#0a1a33] px-4 py-3.5 text-[14px] leading-relaxed text-ink"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={soft}
                >
                  {hintCopy(h)}
                </motion.li>
              ))}
            </ul>

            <ul className="mt-4 space-y-2">
              {(hints.length
                ? hints
                : [0, 1, 2, 3].map((kind) => ({
                    kind,
                    a: 0,
                    b: 0,
                    released: false,
                    releasedTs: 0,
                  }))
              )
                .filter((h) => !h.released)
                .map((h) => (
                  <li
                    key={h.kind}
                    className="flex items-center justify-between rounded-2xl border border-line/80 px-4 py-3 text-[13px] text-steel-deep"
                  >
                    <span>
                      {
                        ["Value band", "Top tier", "Category mix", "Rarity floor"][
                          h.kind
                        ]
                      }
                    </span>
                    <span className="font-mono text-[11px]">
                      {vaultQ.data
                        ? `T+${Math.max(0, vaultQ.data.hintTimes[h.kind] - vaultQ.data.openTs)}s`
                        : "Soon"}
                    </span>
                  </li>
                ))}
            </ul>
          </article>

          <article className="bv-card p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-steel-deep">
                What’s happening
              </p>
              <MotionNavLink
                href={`/vault/${params.id}/proof`}
                className="text-[12px] font-medium text-accent"
              >
                Proofs
              </MotionNavLink>
            </div>
            <ul className="mt-3 space-y-2 text-[13px] text-steel-deep">
              <li>
                {vaultQ.data?.itemCount ?? "—"} cards inside (hidden until
                reveal)
              </li>
              <li>
                {vaultQ.data?.bidCount ?? 0} bid
                {(vaultQ.data?.bidCount ?? 0) === 1 ? "" : "s"} · amounts hidden
              </li>
              <li>
                {vaultQ.data?.peeksSold ?? 0} peek
                {(vaultQ.data?.peeksSold ?? 0) === 1 ? "" : "s"} bought
              </li>
              <li>
                {released.length}/4 public hints
                {released.length > 0
                  ? ` · latest: ${hintCopy(released[released.length - 1]!)}`
                  : ""}
              </li>
              {myBid.data && (
                <li className="text-accent">Your bid is in</li>
              )}
            </ul>
            <p className="mt-3 font-mono text-[10px] text-steel">
              Live counts only — no names or bid amounts shown.
            </p>
          </article>
        </div>

        <aside className="bv-card flex flex-col gap-5 p-6">
          <div>
            <h2 className="font-display text-2xl tracking-[-0.02em]">
              Your bid
            </h2>
            <p className="mt-1 text-[13px] text-steel-deep">
              One bid per wallet. Others can’t see your amount until reveal.
            </p>
            <p className="mt-1 font-mono text-[11px] text-steel">
              {connected ? "Wallet connected" : "Connect a wallet"} ·{" "}
              {tee.token ? "signed in" : "sign in needed"}
            </p>
          </div>

          {!tee.token && (
            <Button
              variant="paper"
              size="sm"
              onClick={() => void tee.signGuestBook()}
            >
              Sign in
            </Button>
          )}

          {myBid.data ? (
            <motion.div
              className="rounded-2xl bg-chalk-mint px-4 py-4"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={spring}
            >
              <p className="text-[14px] font-medium text-ink">Bid locked in</p>
              <p className="mt-1 font-mono text-[12px] text-steel-deep">
                {myBid.data.amount / 1_000_000} SCRIP · #{myBid.data.bidderIndex}
              </p>
            </motion.div>
          ) : (
            <>
              <label
                htmlFor="bid-amount"
                className="block text-[13px] font-medium text-ink"
              >
                How much SCRIP?
                <div className="mt-2 flex items-center gap-2 rounded-2xl border border-line bg-mist px-4 py-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[color-mix(in_oklab,var(--color-accent)_55%,transparent)]">
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
                    placeholder={`${minBid}…`}
                    className="w-full min-w-0 bg-transparent font-mono text-[16px] tabular-nums outline-none"
                  />
                  <span className="shrink-0 text-[12px] text-steel-deep">
                    SCRIP
                  </span>
                </div>
              </label>
              <p className="font-mono text-[11px] text-steel">
                Minimum {minBid} · one bid only
              </p>
              <p className="rounded-xl border border-line bg-mist/80 px-3 py-2 text-[12px] leading-snug text-steel-deep">
                Phantom may show a red “simulation reverted / Confirm (unsafe)”
                warning on private TEE bids. That is Phantom checking public
                Devnet — not MagicBlock. On a first bid, Confirm is expected;
                your SCRIP only locks if the TEE tx succeeds.
              </p>
              <Button
                size="lg"
                onClick={() => void place.placeBid(amount)}
                disabled={
                  place.busy ||
                  Boolean(myBid.data) ||
                  !connected ||
                  pastDeadline ||
                  vaultQ.data?.status !== "Open"
                }
              >
                {place.busy ? "Placing bid…" : "Place sealed bid"}
              </Button>
            </>
          )}

          {place.error && (
            <p
              role="alert"
              aria-live="polite"
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

          <div className="hairline" />

          <div>
            <h3 className="font-display text-xl tracking-[-0.02em]">
              Optional peek
            </h3>
            <p className="mt-1 text-[13px] text-steel-deep">
              {peekFeeScr} SCRIP · see one slot’s rarity & type (only you)
            </p>
          </div>

          {myPeek.data ? (
            <motion.div
              className="rounded-2xl border border-line bg-mist px-4 py-4"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={soft}
            >
              <p className="text-[14px] font-medium">
                Slot {myPeek.data.slot}
              </p>
              <p className="mt-1 font-mono text-[12px] text-steel-deep">
                {myPeek.data.rarityLabel} · {myPeek.data.categoryLabel}
              </p>
            </motion.div>
          ) : (
            <Button
              variant="teal"
              onClick={() => void peek.buyPeek()}
                disabled={
                  peek.busy ||
                  vaultQ.data?.status !== "Open" ||
                  pastDeadline ||
                  !tee.token ||
                  !connected
                }
            >
              {peek.busy ? "Buying peek…" : "Buy a peek"}
            </Button>
          )}
          {peek.error && (
            <p
              role="alert"
              aria-live="polite"
              className="font-mono text-[12px] text-stamp-red-deep"
            >
              {peek.error}
            </p>
          )}
          {peek.feeSig && (
            <a
              className="block font-mono text-[11px] text-accent underline"
              href={solanaTxUrl(peek.feeSig)}
              target="_blank"
              rel="noreferrer"
            >
              fee {shortAddr(peek.feeSig)}
            </a>
          )}
          {peek.lastSig && (
            <a
              className="block font-mono text-[11px] text-accent underline"
              href={teeTxUrl(peek.lastSig)}
              target="_blank"
              rel="noreferrer"
            >
              peek {shortAddr(peek.lastSig)}
            </a>
          )}
        </aside>
      </section>
    </PageEnter>
  );
}
