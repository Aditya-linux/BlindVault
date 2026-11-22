"use client";

import { useWalletHealth } from "@/hooks/useWalletHealth";
import { WalletButton } from "@/components/WalletButton";
import { cn } from "@/lib/cn";

const FAUCET = "https://faucet.solana.com/";

/**
 * Surfaces wallet / network loopholes before users hit cryptic tx errors.
 */
export function WalletStatusBanner({ className }: { className?: string }) {
  const health = useWalletHealth();

  if (!health.connected || health.warnings.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-stamp-red/40 bg-[#2a1218]/90 px-4 py-3 text-left",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <p className="text-[13px] font-medium text-stamp-red-deep">
        Wallet needs a quick fix
      </p>
      <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[13px] leading-snug text-steel-deep">
        {health.warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={FAUCET}
          target="_blank"
          rel="noreferrer"
          className="text-[12px] font-medium text-accent underline underline-offset-2"
        >
          Open Solana Devnet faucet
        </a>
        <span className="text-[11px] text-steel">·</span>
        <span className="text-[12px] text-steel-deep">
          Then disconnect & reconnect below
        </span>
        <WalletButton />
      </div>
    </div>
  );
}
