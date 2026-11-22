"use client";

import { motion, soft } from "@/components/motion";
import {
  HINT_SLOT_META,
  presentHint,
  type HintResult,
} from "@/lib/hints";
import { cn } from "@/lib/cn";

type HintRow = HintResult & {
  released: boolean;
  releasedTs?: number;
};

type VaultHintsProps = {
  hints: HintRow[];
  openTs?: number;
  hintTimes?: number[];
  nowTs?: number;
  className?: string;
};

/** Compact clue board — suspense without a wall of boxes. */
export function VaultHints({
  hints,
  openTs = 0,
  hintTimes = [],
  nowTs = 0,
  className,
}: VaultHintsProps) {
  const byKind = new Map(hints.map((h) => [h.kind, h]));
  const releasedCount = hints.filter((h) => h.released).length;

  return (
    <section className={cn(className)}>
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-[1.65rem] tracking-[-0.03em] text-ink">
            Whispers
          </h2>
          <p className="mt-1 text-[13px] text-steel-deep">
            Clues unlock as the clock runs — never the exact cards.
          </p>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-steel">
          {releasedCount}/4
        </span>
      </div>

      <ol className="mt-5 divide-y divide-line/70 border-y border-line/70">
        {HINT_SLOT_META.map((slot, i) => {
          const row = byKind.get(slot.kind);
          const unlocked = Boolean(row?.released);
          const unlockAt = hintTimes[slot.kind] ?? 0;
          const secsLeft =
            !unlocked && unlockAt > 0 && nowTs > 0
              ? Math.max(0, unlockAt - nowTs)
              : 0;
          const presented = unlocked && row ? presentHint(row) : null;

          return (
            <motion.li
              key={slot.kind}
              initial={unlocked ? { opacity: 0, y: 6 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...soft, delay: unlocked ? i * 0.04 : 0 }}
              className="flex gap-4 py-3.5 first:pt-3 last:pb-3"
            >
              <span
                className={cn(
                  "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                  unlocked ? "bg-accent" : "bg-steel/40",
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-steel">
                    {slot.label}
                  </p>
                  {!unlocked && secsLeft > 0 && (
                    <span className="font-mono text-[10px] text-steel">
                      {secsLeft}s
                    </span>
                  )}
                </div>
                {unlocked && presented ? (
                  <p className="mt-1 text-[15px] leading-snug text-ink">
                    {presented.headline}
                  </p>
                ) : (
                  <p className="mt-1 text-[14px] text-steel-deep/80">
                    {slot.lockedWhisper}
                  </p>
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
