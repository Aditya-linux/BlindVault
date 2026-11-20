"use client";

import { useActiveVault } from "@/hooks/useActiveVault";
import { MotionNavLink, PageEnter, motion } from "@/components/motion";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function LotPage() {
  const { data, isLoading, isError, error } = useActiveVault();
  const vaultPk = data?.activeVault?.toBase58() ?? null;
  const vaultId = data && data.nextVaultId > 1 ? data.nextVaultId - 1 : null;
  const hasLot = Boolean(vaultPk && vaultId && vaultId > 0);

  return (
    <PageEnter>
      <section className="relative mx-auto max-w-3xl text-center">
        <motion.p
          className="text-[13px] font-medium tracking-[0.02em] text-steel-deep"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          Rocco&apos;s Lock-Up
        </motion.p>

        <motion.h1
          className="mt-5 font-display text-[clamp(3.4rem,11vw,6.5rem)] leading-[0.92] tracking-[-0.04em] text-ink"
          initial={{ opacity: 0, y: 22, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
        >
          Blind Vault
        </motion.h1>

        <motion.p
          className="mx-auto mt-6 max-w-md text-[17px] leading-relaxed text-steel-deep"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          Sealed lots. Private peeks. Contents stay inside a MagicBlock TEE
          until the gavel falls.
        </motion.p>

        <motion.div
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {hasLot ? (
            <MotionNavLink
              href={`/vault/${vaultId}`}
              className={cn(buttonVariants({ size: "lg" }))}
            >
              Enter lot {vaultId}
            </MotionNavLink>
          ) : (
            <MotionNavLink
              href="/paddle"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              Prepare paddle
            </MotionNavLink>
          )}
          <MotionNavLink
            href="/warehouse"
            className={cn(buttonVariants({ variant: "paper", size: "lg" }))}
          >
            Browse warehouse
          </MotionNavLink>
        </motion.div>

        <motion.p
          className="mt-14 font-mono text-[11px] text-steel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.8 }}
        >
          {isLoading
            ? "Listening to the house…"
            : isError
              ? `House RPC error · ${error instanceof Error ? error.message.slice(0, 80) : "retry"}`
              : hasLot
                ? `${data?.itemCount ?? "—"} items in pool · lot ${vaultId} open`
                : data
                  ? `${data.itemCount} items in pool · waiting for next lot`
                  : "House not initialized"}
        </motion.p>
      </section>
    </PageEnter>
  );
}
