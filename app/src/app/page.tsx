"use client";

import { useActiveVault } from "@/hooks/useActiveVault";
import { useVaultLive } from "@/hooks/useVaultLive";
import { housePda, vaultPda } from "@/lib/pdas";
import { MotionNavLink, PageEnter, motion } from "@/components/motion";
import { PixelVaultStage } from "@/components/PixelVaultStage";
import { RulesStrip } from "@/components/RulesStrip";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function LotPage() {
  const { data, isLoading, isError, error } = useActiveVault();
  const vaultId = data && data.nextVaultId > 1 ? data.nextVaultId - 1 : null;
  const hasLot = Boolean(data?.activeVault && vaultId && vaultId > 0);
  const vaultPk =
    hasLot && vaultId ? vaultPda(housePda(), vaultId).toBase58() : null;
  const live = useVaultLive(vaultPk, vaultId);

  const status = live.data?.status;
  const finished =
    status === "Revealed" ||
    status === "Closed" ||
    status === "Settled" ||
    status === "Abandoned";
  const open = status === "Open" || status === "Ended";

  const statusLine = isLoading || (hasLot && live.isLoading)
    ? "Listening to the house…"
    : isError
      ? `House RPC error · ${error instanceof Error ? error.message.slice(0, 80) : "retry"}`
      : hasLot && finished
        ? `Lot ${vaultId} · ${status}${live.data?.abandoned ? " (abandoned)" : ""} · waiting for next open vault`
        : hasLot
          ? `${data?.itemCount ?? "—"} cards in pool · lot ${vaultId} · ${status ?? "…"}`
          : data
            ? `${data.itemCount} cards in pool · waiting for next lot`
            : "House not initialized";

  return (
    <PageEnter>
      <section className="landing-game relative mx-auto flex max-w-5xl flex-col items-center gap-8 lg:flex-row lg:items-center lg:gap-10 lg:text-left">
        {/* Pixel stage — visual hero */}
        <motion.div
          className="w-full shrink-0 lg:w-[52%]"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <PixelVaultStage />
          <p className="mt-2 text-center font-pixel text-[11px] uppercase tracking-[0.18em] text-steel-deep lg:text-left">
            Sealed unit · TEE private
          </p>
        </motion.div>

        {/* Copy + CTAs */}
        <div className="w-full max-w-md text-center lg:max-w-none lg:flex-1 lg:text-left">
          <motion.p
            className="font-pixel text-[12px] uppercase tracking-[0.22em] text-accent"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            Rocco&apos;s Lock-Up
          </motion.p>

          <motion.h1
            className="mt-3 font-display text-[clamp(3.2rem,10vw,5.5rem)] leading-[0.92] tracking-[-0.04em] text-ink"
            initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.06 }}
          >
            Blind Vault
          </motion.h1>

          <motion.p
            className="mt-4 text-[16px] leading-relaxed text-steel-deep sm:text-[17px]"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.16 }}
          >
            Bid free SCRIP on a mystery box of creature cards. Contents and bids
            stay private until the vault cracks open.
          </motion.p>

          <motion.div
            className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.28 }}
          >
            {hasLot && finished ? (
              <>
                <MotionNavLink
                  href={`/vault/${vaultId}/reveal`}
                  className={cn(buttonVariants({ size: "lg" }), "pixel-btn")}
                >
                  Open reveal · lot {vaultId}
                </MotionNavLink>
                <MotionNavLink
                  href="/paddle"
                  className={cn(
                    buttonVariants({ variant: "paper", size: "lg" }),
                    "pixel-btn-paper",
                  )}
                >
                  Get paddle
                </MotionNavLink>
              </>
            ) : hasLot && open ? (
              <>
                <MotionNavLink
                  href={`/vault/${vaultId}`}
                  className={cn(buttonVariants({ size: "lg" }), "pixel-btn")}
                >
                  Enter lot {vaultId}
                </MotionNavLink>
                <MotionNavLink
                  href="/paddle"
                  className={cn(
                    buttonVariants({ variant: "paper", size: "lg" }),
                    "pixel-btn-paper",
                  )}
                >
                  Get paddle
                </MotionNavLink>
              </>
            ) : hasLot ? (
              <>
                <MotionNavLink
                  href={`/vault/${vaultId}`}
                  className={cn(buttonVariants({ size: "lg" }), "pixel-btn")}
                >
                  View lot {vaultId}
                </MotionNavLink>
                <MotionNavLink
                  href="/warehouse"
                  className={cn(
                    buttonVariants({ variant: "paper", size: "lg" }),
                    "pixel-btn-paper",
                  )}
                >
                  Browse cards
                </MotionNavLink>
              </>
            ) : (
              <>
                <MotionNavLink
                  href="/paddle"
                  className={cn(buttonVariants({ size: "lg" }), "pixel-btn")}
                >
                  Start · get paddle
                </MotionNavLink>
                <MotionNavLink
                  href="/warehouse"
                  className={cn(
                    buttonVariants({ variant: "paper", size: "lg" }),
                    "pixel-btn-paper",
                  )}
                >
                  Browse warehouse
                </MotionNavLink>
              </>
            )}
          </motion.div>

          <motion.p
            className="mt-6 font-mono text-[11px] text-steel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.7 }}
          >
            {statusLine}
          </motion.p>
        </div>
      </section>

      <motion.div
        className="mx-auto mt-12 max-w-lg"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.7 }}
      >
        <RulesStrip />
      </motion.div>
    </PageEnter>
  );
}
