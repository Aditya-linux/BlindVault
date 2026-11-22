"use client";

import { motion } from "@/components/motion";
import { soft } from "@/components/motion";
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

/**
 * Suspenseful clue board — locked slots tease, unlocked clues speak plainly.
 */
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
    <article className={cn("bv-card p-6 sm:p-7", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-steel">
            Warehouse whispers
          </p>
          <h2 className="mt-1 font-display text-2xl tracking-[-0.02em] text-ink">
            Hints
          </h2>
          <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-steel-deep">
            Clues drip out while the clock runs. They never name the exact
            cards — just enough to sweat your bid.
          </p>
        </div>
        <p className="font-mono text-[11px] text-steel">
          {releasedCount}/4 unlocked
        </p>
      </div>

      <ol className="mt-6 space-y-3">
        {HINT_SLOT_META.map((slot, i) => {
          const row = byKind.get(slot.kind);
          const unlocked = Boolean(row?.released);
          const unlockAt = hintTimes[slot.kind] ?? 0;
          const secsFromOpen = openTs > 0 && unlockAt > 0 ? unlockAt - openTs : 0;
          const secsLeft =
            !unlocked && unlockAt > 0 && nowTs > 0
              ? Math.max(0, unlockAt - nowTs)
              : 0;
          const presented = unlocked && row ? presentHint(row) : null;

          return (
            <motion.li
              key={slot.kind}
              layout
              initial={unlocked ? { opacity: 0, y: 10 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...soft, delay: unlocked ? i * 0.05 : 0 }}
              className={cn(
                "relative overflow-hidden rounded-[20px] border px-4 py-3.5 sm:px-5",
                unlocked
                  ? "border-accent/35 bg-[color-mix(in_oklab,var(--color-accent)_10%,#071428)]"
                  : "border-line/80 bg-cardboard/50",
              )}
            >
              {unlocked && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-accent"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={soft}
                />
              )}

              <div className="flex items-start justify-between gap-3">
                <p
                  className={cn(
                    "text-[11px] font-medium uppercase tracking-[0.12em]",
                    unlocked ? "text-accent" : "text-steel",
                  )}
                >
                  {unlocked ? "Unlocked" : "Sealed"} · {slot.label}
                </p>
                {!unlocked && (
                  <span className="shrink-0 font-mono text-[10px] text-steel">
                    {secsLeft > 0
                      ? `in ${secsLeft}s`
                      : secsFromOpen > 0
                        ? `~${secsFromOpen}s in`
                        : "soon"}
                  </span>
                )}
              </div>

              {unlocked && presented ? (
                <>
                  <p className="mt-2 text-[16px] font-medium leading-snug text-ink sm:text-[17px]">
                    {presented.headline}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-steel-deep">
                    {presented.whisper}
                  </p>
                </>
              ) : (
                <div className="mt-2">
                  <p className="text-[14px] text-steel-deep">
                    {slot.lockedWhisper}
                  </p>
                  <div
                    aria-hidden
                    className="mt-3 flex gap-1.5"
                  >
                    {[0, 1, 2, 3, 4].map((dot) => (
                      <span
                        key={dot}
                        className="h-1.5 flex-1 rounded-full bg-line/80"
                        style={{
                          opacity: 0.35 + (dot % 3) * 0.15,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </motion.li>
          );
        })}
      </ol>
    </article>
  );
}
