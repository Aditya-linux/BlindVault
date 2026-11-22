"use client";

import { formatClock, formatMinutesLabel } from "@/lib/formatTime";
import { useNowMs } from "@/hooks/useNow";
import { MotionNavLink } from "@/components/motion";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type NextBidWindowProps = {
  typicalDurationSecs?: number;
  nextReadyTs?: number | null;
  timerLabel?: string;
  phaseHint?: string | null;
  getReady?: boolean;
  reason?: "lot-ended" | "no-lot" | "settling" | "faucet";
  className?: string;
};

/** Clear wait panel: when bidding starts again + what to do meanwhile. */
export function NextBidWindow({
  typicalDurationSecs = 180,
  nextReadyTs,
  timerLabel,
  phaseHint,
  getReady = false,
  reason = "no-lot",
  className,
}: NextBidWindowProps) {
  const nowMs = useNowMs(200);
  const hasDeadline = Boolean(nextReadyTs && nextReadyTs > 0);
  const leftMs =
    hasDeadline && nextReadyTs
      ? Math.max(0, nextReadyTs * 1000 - nowMs)
      : 0;
  const leftSecs = leftMs <= 0 ? 0 : Math.ceil(leftMs / 1000);
  const atZero = hasDeadline && leftSecs === 0;
  const lotReason = reason === "lot-ended" || reason === "settling";

  const title =
    reason === "faucet"
      ? atZero
        ? "You can claim SCRIP again"
        : "SCRIP cooldown"
      : getReady || atZero
        ? "Still wrapping up — Join appears on Home when the next lot is live"
        : lotReason
          ? "This lot closed — next bidding window next"
          : "Waiting for the next auction";

  const body =
    reason === "faucet"
      ? atZero
        ? "Claim free SCRIP, then join a live lot."
        : "Free SCRIP needs a short cooldown between claims."
      : getReady || atZero
        ? `The estimate hit zero, but bidding is not open on this page. Go to Home — when you see “Join lot · bid now”, tap it (~${formatMinutesLabel(typicalDurationSecs)} each). The timer will not restart.`
        : lotReason
          ? `The bid clock hit zero. Closing this lot takes about a minute, then the next opens (~${formatMinutesLabel(typicalDurationSecs)}). Finish wallet + SCRIP on Paddle, then watch Home for Join — don’t wait on this timer alone.`
          : `No live auction yet. When one opens, Home shows Join. Auctions run about ${formatMinutesLabel(typicalDurationSecs)}.`;

  const clockCaption =
    getReady || atZero
      ? "Go to Home for Join"
      : (timerLabel ??
        (reason === "faucet" ? "Claim again in" : "Estimate · next lot"));

  return (
    <div
      className={cn(
        "bv-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      aria-live="polite"
    >
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[14px] font-medium text-ink">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-steel-deep">{body}</p>
        {lotReason ? (
          <ol className="mt-3 list-decimal space-y-1 pl-4 text-[12px] leading-snug text-steel-deep">
            <li>Watch the timer</li>
            <li>Set up wallet + free SCRIP</li>
            <li>When the lot opens, join and place your bid</li>
          </ol>
        ) : null}
        {phaseHint ? (
          <p className="mt-2 text-[12px] text-steel">{phaseHint}</p>
        ) : null}
        {lotReason || reason === "no-lot" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <MotionNavLink
              href="/paddle"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Set up to bid
            </MotionNavLink>
            <MotionNavLink
              href="/"
              className={cn(buttonVariants({ variant: "paper", size: "sm" }))}
            >
              Back to Home
            </MotionNavLink>
          </div>
        ) : null}
      </div>
      {hasDeadline ? (
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-go-deep/80">
            {getReady || atZero ? "Almost open" : "Next bid in"}
          </p>
          <p
            className={cn(
              "mt-1 font-display text-4xl tabular-nums tracking-[-0.03em]",
              getReady || atZero
                ? "text-go-deep animate-pulse"
                : "text-go",
            )}
          >
            {formatClock(leftSecs)}
          </p>
          <p className="mt-1 text-[11px] font-medium text-go-deep">
            {clockCaption}
          </p>
        </div>
      ) : null}
    </div>
  );
}
