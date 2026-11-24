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
  hintTimes = [],
  nowTs = 0,
  className,
}: VaultHintsProps) {
  const byKind = new Map(hints.map((h) => [h.kind, h]));
  const releasedCount = hints.filter((h) => h.released).length;

  return (
    <section
      className={cn(
        "rounded-2xl border border-line/80 bg-[#071428]/92 px-4 py-5 backdrop-blur-sm sm:px-5",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-[1.65rem] tracking-[-0.03em] text-ink">
            Whispers
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[#d4e6f8]">
            Clues unlock as the clock runs — never the exact cards. The keeper can publish them without your Phantom signature.
          </p>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-[#b8d4f0]">
          {releasedCount}/4
        </span>
      </div>

      <ol className="mt-5 divide-y divide-white/10 border-y border-white/10">
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
              className={cn(
                "flex gap-4 py-3.5 first:pt-3 last:pb-3",
                !unlocked && "opacity-90",
              )}
            >
              <span
                className={cn(
                  "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                  unlocked ? "bg-accent" : "bg-[#6a8ab0]",
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9ec4ea]">
                    {slot.label}
                  </p>
                  {!unlocked && secsLeft > 0 && (
                    <span className="font-mono text-[10px] text-[#9ec4ea]">
                      {secsLeft}s
                    </span>
                  )}
                </div>
                {unlocked && presented ? (
                  <>
                    <p className="mt-1 text-[15px] font-medium leading-snug text-[#f2f8ff]">
                      {presented.headline}
                    </p>
                    {presented.whisper ? (
                      <p className="mt-1 text-[12px] leading-relaxed text-[#c5daf0]">
                        {presented.whisper}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-1 text-[14px] leading-snug text-[#c5daf0]">
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
