"use client";

import { useActiveVault } from "@/hooks/useActiveVault";
import { useVaultLive } from "@/hooks/useVaultLive";
import { housePda, vaultPda } from "@/lib/pdas";
import { BrandMark } from "@/components/BrandMark";
import { MotionNavLink, PageEnter, motion } from "@/components/motion";
import { NextBidWindow } from "@/components/NextBidWindow";
import { RecentPrizes } from "@/components/RecentPrizes";
import { RulesStrip } from "@/components/RulesStrip";
import { StartTutorialButton } from "@/components/StartTutorialButton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatMinutesLabel } from "@/lib/formatTime";
import { useNowSecs } from "@/hooks/useNow";
import { useStableNextLotEta } from "@/hooks/useStableNextLotEta";

export default function LotPage() {
  const { data, isLoading, isError, error } = useActiveVault();
  const vaultId = data && data.nextVaultId > 1 ? data.nextVaultId - 1 : null;
  const hasLot = Boolean(data?.activeVault && vaultId && vaultId > 0);
  const vaultPk =
    hasLot && vaultId
      ? vaultPda(housePda(), vaultId).toBase58()
      : null;
  const live = useVaultLive(vaultPk, vaultId);
  const nowTs = useNowSecs();

  const status = live.data?.status;
  const finished =
    status === "Revealed" ||
    status === "Closed" ||
    status === "Settled" ||
    status === "Abandoned";
  const open = status === "Open" || status === "Ended";
  const pastDeadline =
    Boolean(live.data?.deadlineTs) &&
    live.data!.deadlineTs > 0 &&
    nowTs >= live.data!.deadlineTs;
  const biddingClosed = !hasLot || finished || pastDeadline;
  const typicalSecs =
    data?.durationSecs?.[live.data?.size ?? 0] ||
    data?.durationSecs?.[0] ||
    live.data?.durationSecs ||
    180;
  const nextEta = useStableNextLotEta({
    enabled: biddingClosed && hasLot,
    deadlineTs: live.data?.deadlineTs,
    status,
    nowTs,
    vaultId,
  });

  return (
    <PageEnter>
      <div className="bv-stack mx-auto w-full max-w-3xl">
      <section className="relative text-center">
        <motion.div
          className="bv-hero-panel px-5 py-9 sm:px-10 sm:py-14"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
        <motion.div
          className="mx-auto flex justify-center"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <BrandMark
            size={96}
            variant="plain"
            priority
            className="sm:hidden"
          />
          <BrandMark
            size={120}
            variant="plain"
            priority
            className="hidden sm:inline-flex"
          />
        </motion.div>

        <motion.p
          className="mt-6 text-[13px] font-medium tracking-[0.04em] text-steel-deep"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.04 }}
        >
          Rocco&apos;s Lock-Up
        </motion.p>

        <motion.h1
          className="mt-2 font-display text-[clamp(2.75rem,10vw,5.75rem)] leading-[0.94] tracking-[-0.04em] text-ink"
          initial={{ opacity: 0, y: 22, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
        >
          Blind Vault
        </motion.h1>

        <motion.p
          className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-steel-deep sm:mt-6 sm:text-[17px]"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          Bid on a mystery box of creature cards. What&apos;s inside — and how
          much others bid — stays secret until the timer ends. Highest bid wins
          the cards. Free play money on Devnet (not real cash).
        </motion.p>

        <motion.div
          className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {hasLot && finished ? (
            <>
              <MotionNavLink
                href={`/vault/${vaultId}/reveal`}
                className={cn(buttonVariants({ size: "lg" }))}
              >
                See what was inside · lot {vaultId}
              </MotionNavLink>
              <MotionNavLink
                href="/paddle"
                className={cn(buttonVariants({ variant: "paper", size: "lg" }))}
              >
                Set up to bid
              </MotionNavLink>
            </>
          ) : hasLot && open ? (
            <>
              <MotionNavLink
                href={`/vault/${vaultId}`}
                className={cn(buttonVariants({ size: "lg" }))}
              >
                Join lot {vaultId}
              </MotionNavLink>
              <MotionNavLink
                href="/paddle"
                className={cn(buttonVariants({ variant: "paper", size: "lg" }))}
              >
                Set up to bid
              </MotionNavLink>
            </>
          ) : hasLot ? (
            <>
              <MotionNavLink
                href={`/vault/${vaultId}`}
                className={cn(buttonVariants({ size: "lg" }))}
              >
                View lot {vaultId}
              </MotionNavLink>
              <MotionNavLink
                href="/warehouse"
                className={cn(buttonVariants({ variant: "paper", size: "lg" }))}
              >
                Browse cards
              </MotionNavLink>
            </>
          ) : (
            <>
              <MotionNavLink
                href="/paddle"
                className={cn(buttonVariants({ size: "lg" }))}
              >
                Set up to bid
              </MotionNavLink>
              <MotionNavLink
                href="/warehouse"
                className={cn(buttonVariants({ variant: "paper", size: "lg" }))}
              >
                Browse cards
              </MotionNavLink>
            </>
          )}
          <StartTutorialButton
            variant="ghost"
            size="lg"
            label="New here? Quick tour"
            className="w-full sm:w-auto"
          />
        </motion.div>

        <motion.p
          className="mt-8 font-mono text-[11px] text-steel sm:mt-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.8 }}
        >
          {isLoading || (hasLot && live.isLoading)
            ? "Loading live auction…"
            : isError
              ? `Couldn’t load auction · ${error instanceof Error ? error.message.slice(0, 80) : "try refresh"}`
              : hasLot && finished
                ? `Lot ${vaultId} finished${live.data?.abandoned ? " · no winner" : ""} · next auction soon`
                : hasLot && pastDeadline && status === "Open"
                  ? `Lot ${vaultId} · bidding closed · wrapping up`
                  : hasLot
                    ? `Lot ${vaultId} · ${status ?? "…"} · ~${formatMinutesLabel(typicalSecs)} per auction`
                    : data
                      ? `${data.itemCount} cards in the warehouse · waiting for next auction`
                      : "Auction house not ready yet"}
        </motion.p>
        </motion.div>
      </section>

      <section className="bv-stack mx-auto w-full max-w-xl">
        {(biddingClosed || !hasLot) && !isLoading && data ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
          >
            <NextBidWindow
              reason={
                finished || pastDeadline
                  ? "settling"
                  : !hasLot
                    ? "no-lot"
                    : "lot-ended"
              }
              typicalDurationSecs={typicalSecs}
              nextReadyTs={nextEta?.displayReadyTs}
              getReady={Boolean(nextEta?.getReady)}
              timerLabel="Bidding opens in"
              phaseHint={nextEta?.phaseLabel}
            />
          </motion.div>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.7 }}
        >
          <RecentPrizes />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.7 }}
        >
          <RulesStrip />
        </motion.div>
      </section>
      </div>
    </PageEnter>
  );
}
