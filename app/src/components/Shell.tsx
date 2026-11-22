"use client";

import { usePathname } from "next/navigation";
import { WalletButton } from "./WalletButton";
import { WalletStatusBanner } from "./WalletStatusBanner";
import { LiveBackground } from "./LiveBackground";
import { TutorialGuide } from "./TutorialGuide";
import { BrandMark } from "./BrandMark";
import { useReducedMotion } from "motion/react";
import { MotionNavLink, motion } from "./motion";
import { useActiveVault } from "@/hooks/useActiveVault";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/warehouse", label: "Cards" },
  { href: "/history", label: "History" },
  { href: "/me", label: "My bids" },
  { href: "/paddle", label: "Setup" },
] as const;

function tabActive(path: string, href: string) {
  return path === href || path.startsWith(`${href}/`);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const reduce = useReducedMotion();
  const active = useActiveVault();
  const vaultId =
    active.data && active.data.nextVaultId > 1
      ? active.data.nextVaultId - 1
      : null;
  const onVault = path.startsWith("/vault/");
  const currentLot = path.match(/^\/vault\/(\d+)/)?.[1] ?? vaultId;
  const isHome = path === "/";

  return (
    <div className="shell-bg relative min-h-dvh">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <LiveBackground />

      <header className="sticky top-0 z-40">
        <div className="bv-page-x mx-auto max-w-6xl pt-3 sm:pt-4">
          <motion.div
            className="bv-glass flex h-12 items-center justify-between gap-2 rounded-2xl px-2.5 sm:h-14 sm:gap-3 sm:px-4"
            initial={reduce ? false : { y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
          >
            <MotionNavLink
              href="/"
              className="flex min-w-0 items-center gap-2 font-display text-[1.2rem] leading-none tracking-[-0.03em] text-ink sm:text-[1.45rem]"
              aria-label="Blind Vault home"
            >
              <BrandMark size={34} variant="mark" priority className="sm:hidden" />
              <BrandMark size={38} variant="mark" priority className="hidden sm:inline-flex" />
              <span className="truncate">Blind Vault</span>
            </MotionNavLink>

            <nav
              className="hidden items-center gap-0.5 lg:flex"
              aria-label="Primary"
            >
              {TABS.map((t) => {
                const on = tabActive(path, t.href);
                return (
                  <MotionNavLink
                    key={t.href}
                    href={t.href}
                    className={cn(
                      "rounded-xl px-3 py-1.5 text-[13px] font-medium text-steel-deep transition-colors duration-150 hover:text-ink",
                      on && "bg-accent/20 text-ink ring-1 ring-accent/35",
                    )}
                  >
                    {t.label}
                  </MotionNavLink>
                );
              })}
              {vaultId && vaultId > 0 && (
                <MotionNavLink
                  href={`/vault/${vaultId}`}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-[13px] font-medium text-steel-deep transition-colors duration-150 hover:text-ink",
                    onVault && "bg-accent/20 text-ink ring-1 ring-accent/35",
                  )}
                >
                  Lot {vaultId}
                </MotionNavLink>
              )}
            </nav>

            <div className="flex items-center gap-2">
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-steel sm:inline">
                Devnet
              </span>
              <WalletButton />
            </div>
          </motion.div>
        </div>
      </header>

      {onVault && currentLot && (
        <div className="bv-page-x mx-auto mt-3 max-w-6xl">
          <div className="bv-glass flex items-center justify-between gap-3 rounded-2xl px-3 py-2.5">
            <p className="font-mono text-[11px] text-steel-deep">
              Lot {currentLot}
            </p>
            <div className="flex gap-1">
              {[
                { href: `/vault/${currentLot}`, label: "Live" },
                { href: `/vault/${currentLot}/reveal`, label: "Reveal" },
                { href: `/vault/${currentLot}/proof`, label: "Proof" },
              ].map((t) => {
                const on =
                  t.href === `/vault/${currentLot}`
                    ? path === t.href
                    : path.startsWith(t.href);
                return (
                  <MotionNavLink
                    key={t.href}
                    href={t.href}
                    className={cn(
                      "rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-steel-deep",
                      on && "bg-accent/20 text-ink ring-1 ring-accent/35",
                    )}
                  >
                    {t.label}
                  </MotionNavLink>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <main
        id="main"
        tabIndex={-1}
        className={cn(
          "bv-page-x relative z-10 mx-auto max-w-6xl scroll-mt-24",
          isHome
            ? "pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-8 sm:pb-20 sm:pt-14"
            : "pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-6 sm:pb-16 sm:pt-10",
        )}
      >
        <WalletStatusBanner className="mb-8" />
        {children}
      </main>

      <TutorialGuide />

      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line/80 bg-[#071428]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden"
        aria-label="Mobile"
      >
        <div className="mx-auto flex max-w-lg justify-around gap-1">
          {[
            { href: "/", label: "Home" },
            { href: "/warehouse", label: "Cards" },
            { href: "/history", label: "History" },
            { href: "/me", label: "Bids" },
            { href: "/paddle", label: "Setup" },
          ].map((t) => {
            const on =
              t.href === "/" ? path === "/" : tabActive(path, t.href);
            return (
              <MotionNavLink
                key={t.href}
                href={t.href}
                className={cn(
                  "min-w-0 flex-1 rounded-xl px-1.5 py-2.5 text-center text-[11px] font-medium text-steel-deep",
                  on && "bg-accent/20 text-ink ring-1 ring-accent/35",
                )}
              >
                {t.label}
              </MotionNavLink>
            );
          })}
        </div>
      </nav>

      <footer className="bv-page-x relative z-10 mx-auto flex max-w-6xl flex-col gap-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4 text-[11px] text-steel sm:flex-row sm:items-center sm:justify-between sm:pb-10">
        <span>Free test game on Devnet · no real money</span>
        <span className="tracking-[-0.01em]">Private auctions · MagicBlock</span>
      </footer>
    </div>
  );
}
