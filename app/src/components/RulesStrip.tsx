"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

const RULES = [
  {
    q: "What am I bidding on?",
    a: "A sealed vault of creature cards. You don’t see which cards until the timer ends.",
  },
  {
    q: "What do I win?",
    a: "If your sealed bid is highest, you get those cards in your wallet after the round settles.",
  },
  {
    q: "What if I lose?",
    a: "Your SCRIP bid is refunded. SCRIP is free play money on Devnet — not real cash.",
  },
  {
    q: "Can others see my bid?",
    a: "No. Your bid amount stays private until the round ends.",
  },
  {
    q: "What’s a peek?",
    a: "For a small SCRIP fee you can glimpse one slot’s rarity and type — not the exact creature. Only you can see it.",
  },
] as const;

export function RulesStrip({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("bv-card", className)}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-[14px] font-medium text-ink">
          How it works (30 seconds)
        </span>
        <span className="font-mono text-[11px] text-steel">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && (
        <ul className="mt-4 space-y-4 border-t border-line pt-4">
          {RULES.map((r) => (
            <li key={r.q}>
              <p className="text-[13px] font-medium text-ink">{r.q}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-steel-deep">
                {r.a}
              </p>
            </li>
          ))}
          <li className="font-mono text-[10px] text-steel">
            Test network only · free play credits · no real funds
          </li>
        </ul>
      )}
    </div>
  );
}
