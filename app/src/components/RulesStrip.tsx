"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

const RULES = [
  {
    q: "What am I bidding on?",
    a: "A sealed vault of creature cards. Identities stay private until reveal.",
  },
  {
    q: "What can I win?",
    a: "The highest sealed SCRIP bid wins the lot’s SPL cards into their wallet after finalize.",
  },
  {
    q: "What if I lose?",
    a: "Losing bids are refunded on the settlement path. SCRIP is free Devnet play money — not real value.",
  },
  {
    q: "Can anyone see my bid?",
    a: "No. Bid amounts are ACL’d on MagicBlock TEE until the round settles.",
  },
  {
    q: "What does a paid peek show?",
    a: "One slot’s rarity and category — not the exact creature — and only to the buyer’s wallet.",
  },
] as const;

export function RulesStrip({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("bv-card p-4", className)}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-[14px] font-medium text-ink">How Blind Vault works</span>
        <span className="font-mono text-[11px] text-steel">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && (
        <ul className="mt-3 space-y-3 border-t border-line pt-3">
          {RULES.map((r) => (
            <li key={r.q}>
              <p className="text-[13px] font-medium text-ink">{r.q}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-steel-deep">
                {r.a}
              </p>
            </li>
          ))}
          <li className="font-mono text-[10px] text-steel">
            Fill uses TEE-local entropy today — not ER VRF. Devnet only.
          </li>
        </ul>
      )}
    </div>
  );
}
