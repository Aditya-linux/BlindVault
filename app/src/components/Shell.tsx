"use client";

import { usePathname } from "next/navigation";
import { WalletButton } from "./WalletButton";
import { LiveBackground } from "./LiveBackground";
import { MotionNavLink, motion } from "./motion";
import { useActiveVault } from "@/hooks/useActiveVault";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/warehouse", label: "Warehouse" },
  { href: "/me", label: "My bids" },
  { href: "/paddle", label: "Paddle" },
] as const;

function tabActive(path: string, href: string) {
  return path === href || path.startsWith(`${href}/`);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
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
      <LiveBackground />

      <header className="sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <motion.div
            className={cn(
              "flex h-12 items-center justify-between gap-3 rounded-2xl px-3 sm:h-14 sm:px-4",
              isHome ? "bv-glass-dark" : "bv-glass",
            )}
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <MotionNavLink
              href="/"
              className={cn(
                "font-display text-[1.35rem] leading-none tracking-[-0.03em] sm:text-[1.5rem]",
                isHome ? "text-white" : "text-ink",
              )}
              aria-label="Blind Vault home"
            >
              Blind Vault
            </MotionNavLink>

            <nav
              className="hidden items-center gap-1 md:flex"
              aria-label="Primary"
            >
              {TABS.map((t) => {
                const on = tabActive(path, t.href);
                return (
                  <MotionNavLink
                    key={t.href}
                    href={t.href}
                    className={cn(
                      "rounded-xl px-3 py-1.5 text-[13px] font-medium transition-colors",
                      isHome
                        ? cn(
                            "text-white/70 hover:text-white",
                            on && "bg-white/12 text-white",
                          )
                        : cn(
                            "text-steel-deep hover:text-ink",
                            on && "bg-cardboard/70 text-ink",
                          ),
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
                    "rounded-xl px-3 py-1.5 text-[13px] font-medium transition-colors",
                    isHome
                      ? cn(
                          "text-white/70 hover:text-white",
                          onVault && "bg-white/12 text-white",
                        )
                      : cn(
                          "text-steel-deep hover:text-ink",
                          onVault && "bg-cardboard/70 text-ink",
                        ),
                  )}
                >
                  Live lot
                </MotionNavLink>
              )}
            </nav>

            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "hidden font-mono text-[10px] uppercase tracking-[0.14em] sm:inline",
                  isHome ? "text-white/55" : "text-steel",
                )}
              >
                Devnet
              </span>
              <WalletButton />
            </div>
          </motion.div>
        </div>
      </header>

      {onVault && currentLot && (
        <div className="mx-auto mt-3 flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
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
                    "rounded-lg px-2.5 py-1 text-[12px] font-medium text-steel-deep",
                    on && "bg-paper text-ink",
                  )}
                >
                  {t.label}
                </MotionNavLink>
              );
            })}
          </div>
        </div>
      )}

      <main
        className={cn(
          "relative z-10",
          isHome
            ? "mx-auto max-w-6xl px-4 pb-8 sm:px-6"
            : "mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 sm:pb-16 sm:pt-10",
        )}
      >
        {children}
      </main>

      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 px-2 py-2 backdrop-blur-xl md:hidden",
          isHome
            ? "border-t border-white/10 bg-black/45"
            : "border-t border-line/80 bg-paper/90",
        )}
        aria-label="Mobile"
      >
        <div className="mx-auto flex max-w-lg justify-around">
          {[
            { href: "/", label: "Home" },
            { href: "/warehouse", label: "Warehouse" },
            { href: "/me", label: "Bids" },
            { href: "/paddle", label: "Paddle" },
          ].map((t) => {
            const on =
              t.href === "/" ? path === "/" : tabActive(path, t.href);
            return (
              <MotionNavLink
                key={t.href}
                href={t.href}
                className={cn(
                  "rounded-xl px-3 py-2 text-[11px] font-medium",
                  isHome
                    ? cn("text-white/70", on && "bg-white/12 text-white")
                    : cn("text-steel-deep", on && "bg-cardboard/80 text-ink"),
                )}
              >
                {t.label}
              </MotionNavLink>
            );
          })}
        </div>
      </nav>

      <footer
        className={cn(
          "relative z-10 mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 pb-10 pt-2 text-[11px] sm:px-6",
          isHome ? "text-white/50" : "text-steel",
        )}
      >
        <span>Devnet only. No real value.</span>
        <span className="tracking-[-0.01em]">Private Ephemeral Rollups</span>
      </footer>
    </div>
  );
}
