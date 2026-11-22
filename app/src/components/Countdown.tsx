"use client";

import { formatClock } from "@/lib/formatTime";
import { useNowMs } from "@/hooks/useNow";
import { cn } from "@/lib/cn";

type CountdownProps = {
  /** Unix seconds — auction end while bidding; next-lot ETA after close. */
  deadlineTs: number;
  /** Label while time remains */
  activeLabel?: string;
  /** Label when clock hits zero */
  expiredLabel?: string;
  /** Optional hint under the clock when expired */
  expiredHint?: string;
  /** Soft “get ready” pulse near zero — still shows digits. */
  getReady?: boolean;
  /**
   * `bid` = live lot clock (ink → red).
   * `next` = post-deadline “next auction” clock (green).
   */
  tone?: "bid" | "next";
  className?: string;
  align?: "left" | "right";
};

export function Countdown({
  deadlineTs,
  activeLabel = "Remaining",
  expiredLabel = "Bidding closed",
  expiredHint,
  getReady = false,
  tone = "bid",
  className,
  align = "right",
}: CountdownProps) {
  const nowMs = useNowMs(200);
  const deadlineMs = deadlineTs > 0 ? deadlineTs * 1000 : 0;
  const leftMs = deadlineMs > 0 ? Math.max(0, deadlineMs - nowMs) : 0;
  const leftSecs = leftMs <= 0 ? 0 : Math.ceil(leftMs / 1000);
  const label = formatClock(leftSecs);
  const urgent = leftSecs > 0 && leftSecs < 60;
  const expired = deadlineTs > 0 && leftSecs === 0;
  const isNext = tone === "next";
  const alignCls = align === "left" ? "text-left" : "text-right";

  const statusLabel = getReady
    ? "Get ready"
    : expired
      ? expiredLabel
      : activeLabel;

  return (
    <div
      className={cn(alignCls, className)}
      aria-live="polite"
      aria-atomic="true"
      aria-label={
        expired || getReady ? statusLabel : `${activeLabel} ${label}`
      }
    >
      <p
        className={cn(
          "font-display text-[2.75rem] leading-none tracking-[-0.04em] tabular-nums sm:text-5xl",
          isNext
            ? getReady
              ? "text-go-deep animate-pulse"
              : "text-go"
            : getReady
              ? "text-accent animate-pulse"
              : urgent || expired
                ? "text-stamp-red"
                : "text-ink",
        )}
      >
        {deadlineTs > 0 ? label : "—"}
      </p>
      <p
        className={cn(
          "mt-2 text-[12px] font-medium",
          isNext ? "text-go-deep" : "text-steel-deep",
        )}
      >
        {statusLabel}
      </p>
      {(expired || getReady || isNext) && expiredHint ? (
        <p className="mt-1 max-w-[16rem] text-[11px] leading-snug text-steel">
          {expiredHint}
        </p>
      ) : null}
    </div>
  );
}
