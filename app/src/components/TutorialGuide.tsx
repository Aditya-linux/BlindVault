"use client";

import { useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { useTutorial } from "@/hooks/useTutorial";
import { useActiveVault } from "@/hooks/useActiveVault";
import { TUTORIAL_STEPS } from "@/lib/tutorial";
import { Button } from "@/components/ui/button";
import { motion, soft } from "@/components/motion";
import { cn } from "@/lib/cn";

/**
 * Hand-guided first-time tour. Auto-opens once; skippable; restartable.
 * Copy is Devnet-honest (SCRIP ≠ real money, TEE privacy, no VRF yet).
 */
export function TutorialGuide() {
  const tour = useTutorial();
  const router = useRouter();
  const titleId = useId();
  const reduceMotion = useReducedMotion();
  const active = useActiveVault();
  const vaultId =
    active.data && active.data.nextVaultId > 1
      ? active.data.nextVaultId - 1
      : null;
  const hasLot = Boolean(active.data?.activeVault && vaultId);

  useEffect(() => {
    if (!tour.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") tour.closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tour.open, tour]);

  if (!tour.hydrated) return null;

  function resolveHref(href: string | null): string | null {
    if (href === "/") {
      return hasLot && vaultId ? `/vault/${vaultId}` : "/";
    }
    return href;
  }

  function onPrimary() {
    const step = tour.step;
    if (step.id === "done" || tour.isLast) {
      tour.dismiss();
      return;
    }
    const href = resolveHref(step.href);
    const nextHref = tour.next();
    const target = href ?? resolveHref(nextHref);
    if (target) router.push(target);
  }

  function onSecondary() {
    if (tour.step.secondaryHref) {
      router.push(tour.step.secondaryHref);
    }
    tour.next();
  }

  return (
    <>
      {/* Always-available restart control */}
      {!tour.open && (
        <button
          type="button"
          onClick={() => (tour.state.completed ? tour.start() : tour.reopen())}
          className="fixed bottom-20 right-4 z-[60] flex h-10 w-10 items-center justify-center rounded-full border border-accent/40 bg-[#0a1528]/95 text-[15px] font-medium text-accent shadow-lg backdrop-blur-sm sm:bottom-6"
          aria-label="Open guided tutorial"
          title="Guided tutorial"
        >
          ?
        </button>
      )}

      {tour.open && (
        <div
          className="fixed inset-x-0 bottom-0 z-[70] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-6 sm:right-6 sm:justify-end sm:p-0"
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
            className={cn(
              "w-full max-w-md overflow-hidden rounded-[24px] border border-accent/35 bg-[#0a1528]/97 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-md",
            )}
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={soft}
          >
            <div className="flex items-center justify-between gap-2 border-b border-line/70 px-4 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-accent">
                Quick tour · {tour.progressLabel}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="font-mono text-[11px] text-steel-deep underline-offset-2 hover:text-ink hover:underline"
                  onClick={tour.dismiss}
                >
                  Skip
                </button>
                <button
                  type="button"
                  className="rounded-lg px-2 py-1 font-mono text-[11px] text-steel hover:text-ink"
                  onClick={tour.closePanel}
                  aria-label="Minimize tutorial"
                >
                  Hide
                </button>
              </div>
            </div>

            <div className="px-4 py-4 sm:px-5">
              <h2
                id={titleId}
                className="font-display text-2xl tracking-[-0.03em] text-ink"
              >
                {tour.step.title}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-steel-deep">
                {tour.step.body}
              </p>
              {tour.step.tip && (
                <p className="mt-3 rounded-xl border border-line/80 bg-[#071428] px-3 py-2 font-mono text-[11px] leading-relaxed text-steel">
                  {tour.step.tip}
                </p>
              )}

              <div className="mt-4 flex h-1.5 gap-1">
                {TUTORIAL_STEPS.map((s, i) => (
                  <div
                    key={s.id}
                    className={cn(
                      "h-full flex-1 rounded-full",
                      i <= tour.state.stepIndex ? "bg-accent" : "bg-line",
                    )}
                  />
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {tour.state.stepIndex > 0 && (
                  <Button variant="ghost" size="sm" onClick={tour.back}>
                    Back
                  </Button>
                )}
                <Button className="flex-1" onClick={onPrimary}>
                  {tour.step.cta}
                </Button>
                {tour.step.secondaryCta && (
                  <Button variant="paper" size="sm" onClick={onSecondary}>
                    {tour.step.secondaryCta}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
