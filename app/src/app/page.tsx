"use client";

import { useActiveVault } from "@/hooks/useActiveVault";
import { MotionNavLink, motion } from "@/components/motion";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function LotPage() {
  const { data, isLoading, isError, error } = useActiveVault();
  const vaultPk = data?.activeVault?.toBase58() ?? null;
  const vaultId = data && data.nextVaultId > 1 ? data.nextVaultId - 1 : null;
  const hasLot = Boolean(vaultPk && vaultId && vaultId > 0);

  return (
    <section className="relative flex min-h-[calc(100dvh-7.5rem)] flex-col justify-end pb-6 pt-16 sm:justify-center sm:pb-16 sm:pt-8">
      <div className="mx-auto w-full max-w-3xl text-center">
        <motion.p
          className="text-[12px] font-medium uppercase tracking-[0.22em] text-white/70"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          Rocco&apos;s Lock-Up
        </motion.p>

        <motion.h1
          className="mt-5 font-display text-[clamp(3.6rem,12vw,7rem)] leading-[0.9] tracking-[-0.04em] text-white"
          initial={{ opacity: 0, y: 28, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.06 }}
        >
          Blind Vault
        </motion.h1>

        <motion.p
          className="mx-auto mt-6 max-w-md text-[16px] leading-relaxed text-white/78 sm:text-[17px]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          Sealed creature lots. Private bids. Winner takes the cards.
        </motion.p>

        <motion.div
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          {hasLot ? (
            <MotionNavLink
              href={`/vault/${vaultId}`}
              className={cn(
                buttonVariants({ size: "lg" }),
                "border-0 bg-white text-ink hover:bg-white/92",
              )}
            >
              Enter lot {vaultId}
            </MotionNavLink>
          ) : (
            <MotionNavLink
              href="/paddle"
              className={cn(
                buttonVariants({ size: "lg" }),
                "border-0 bg-white text-ink hover:bg-white/92",
              )}
            >
              Get your paddle
            </MotionNavLink>
          )}
          <MotionNavLink
            href="/warehouse"
            className={cn(
              buttonVariants({ variant: "paper", size: "lg" }),
              "border-white/25 bg-white/10 text-white backdrop-blur-md hover:bg-white/16",
            )}
          >
            Browse cards
          </MotionNavLink>
        </motion.div>

        <motion.p
          className="mt-14 font-mono text-[11px] text-white/55"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.9 }}
        >
          {isLoading
            ? "Listening to the house…"
            : isError
              ? `House RPC error · ${error instanceof Error ? error.message.slice(0, 80) : "retry"}`
              : hasLot
                ? `${data?.itemCount ?? "—"} cards in pool · lot ${vaultId} live`
                : data
                  ? `${data.itemCount} cards in pool · waiting for next lot`
                  : "House not initialized"}
        </motion.p>
      </div>

      <motion.div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/25 to-transparent sm:hidden"
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      />
    </section>
  );
}
