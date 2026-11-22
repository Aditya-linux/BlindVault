"use client";

import { useEffect, useId } from "react";
import { useReducedMotion } from "motion/react";
import { CollectibleCard } from "@/components/CollectibleCard";
import { Button } from "@/components/ui/button";
import { motion, soft } from "@/components/motion";
import { formatPackLine } from "@/lib/packHistory";
import type { StackedItem } from "@/lib/stackInventory";

type PackPopupProps = {
  vaultId: number;
  cards: StackedItem[];
  onClose: () => void;
  onViewHistory?: () => void;
};

export function PackPopup({
  vaultId,
  cards,
  onClose,
  onViewHistory,
}: PackPopupProps) {
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  const names = cards.map((c) =>
    c.count > 1 ? `${c.name} ×${c.count}` : c.name,
  );
  const line = formatPackLine(names);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Dismiss pack"
        className="absolute inset-0 bg-[#020814]/75 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-[1] w-full max-w-md overflow-hidden rounded-[28px] border border-accent/35 bg-[#0a1528] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={soft}
      >
        <div className="border-b border-line/80 bg-[#071428] px-5 py-5 sm:px-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-accent">
            Lot {vaultId} · you won
          </p>
          <h2
            id={titleId}
            className="mt-2 font-display text-3xl tracking-[-0.03em] text-ink"
          >
            You packed {line || "these cards"}
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-steel-deep">
            Saved under My bids. Cards also show in Your cards once settlement
            finishes.
          </p>
        </div>

        <ul className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 sm:p-5">
          {cards.map((item, i) => (
            <motion.li
              key={`${item.index}-${item.indices.join("-")}`}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...soft, delay: reduceMotion ? 0 : 0.08 + i * 0.06 }}
            >
              <CollectibleCard
                index={item.index}
                name={item.name}
                rarity={item.rarity}
                category={item.category}
                value={item.value}
                count={item.count}
                compact
              />
            </motion.li>
          ))}
        </ul>

        <div className="flex flex-wrap gap-2 border-t border-line/80 px-4 py-4 sm:px-5">
          <Button className="flex-1" onClick={onClose}>
            Awesome
          </Button>
          {onViewHistory && (
            <Button variant="paper" className="flex-1" onClick={onViewHistory}>
              See my packs
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
