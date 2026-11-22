"use client";

import { useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { useTeeAuth } from "@/hooks/useTeeAuth";
import { useFaucet } from "@/hooks/useFaucet";
import { useActiveVault } from "@/hooks/useActiveVault";
import { usePaddleBalances } from "@/hooks/usePaddleBalances";
import { useFaucetCooldown } from "@/hooks/useFaucetCooldown";
import { WalletButton } from "@/components/WalletButton";
import { NextBidWindow } from "@/components/NextBidWindow";
import { shortAddr } from "@/lib/format";
import { solanaTxUrl } from "@/lib/explorer";
import {
  MotionNavLink,
  PageEnter,
  Stagger,
  StaggerItem,
} from "@/components/motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { RulesStrip } from "@/components/RulesStrip";
import { StartTutorialButton } from "@/components/StartTutorialButton";
import { useWalletHealth } from "@/hooks/useWalletHealth";
import { cn } from "@/lib/cn";

const DEVNET_FAUCET = "https://faucet.solana.com/";
const MIN_SOL_LAMPORTS = 5_000_000; // ~0.005 SOL for a few txs
const MIN_SCRIP_UI = 10; // enough for a min bid

type StepId = "wallet" | "guestbook" | "scrip";

export default function PaddlePage() {
  const { connected, publicKey } = useWallet();
  const health = useWalletHealth();
  const tee = useTeeAuth();
  const faucet = useFaucet();
  const faucetCd = useFaucetCooldown();
  const active = useActiveVault();
  const bal = usePaddleBalances();
  const qc = useQueryClient();
  const typicalSecs = active.data?.durationSecs?.[0] ?? 180;
  const onFaucetCooldown = Boolean(faucetCd.data?.onCooldown);

  async function claimScrip() {
    const result = await faucet.claim();
    if (result) {
      await qc.invalidateQueries({ queryKey: ["paddle-balances"] });
      await qc.invalidateQueries({ queryKey: ["faucet-cooldown"] });
    }
  }

  const vaultId =
    active.data && active.data.nextVaultId > 1
      ? active.data.nextVaultId - 1
      : null;
  const hasActive = Boolean(active.data?.activeVault);

  const solOk = (bal.data?.solLamports ?? 0) >= MIN_SOL_LAMPORTS;
  const scripUi = bal.data?.scripUi ?? 0;
  const scripOk = scripUi >= MIN_SCRIP_UI || Boolean(faucet.sig);
  const guestOk = Boolean(tee.token);

  const steps = useMemo(
    () =>
      [
        {
          id: "wallet" as const,
          label: "Wallet",
          done: connected,
        },
        {
          id: "guestbook" as const,
          label: "Sign in",
          done: guestOk,
        },
        {
          id: "scrip" as const,
          label: "Credits",
          done: scripOk,
        },
      ] satisfies { id: StepId; label: string; done: boolean }[],
    [connected, guestOk, scripOk],
  );

  const doneCount = steps.filter((s) => s.done).length;
  const readyToBid = connected && guestOk && scripOk;
  const activeStep: StepId = !connected
    ? "wallet"
    : !guestOk
      ? "guestbook"
      : "scrip";

  return (
    <PageEnter>
      <section className="bv-stack mx-auto w-full max-w-lg">
        <header>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-[clamp(2.25rem,6vw,2.75rem)] tracking-[-0.03em]">
                Set up to bid
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-steel-deep">
                Three quick steps.{" "}
                <span className="text-ink">SCRIP</span> is free play credit —
                not real money. Highest bid wins the cards.
              </p>
            </div>
            <StartTutorialButton label="Restart tour" />
          </div>
        </header>

        {connected && health.walletName && (
          <p className="font-mono text-[11px] text-steel">
            Connected · {health.walletName}
            {health.address ? ` · ${health.address.slice(0, 4)}…${health.address.slice(-4)}` : ""}
            {health.readyForTx ? " · ready for txs" : " · finish warnings above"}
          </p>
        )}

        {/* Progress */}
        <div className="bv-card">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium text-ink">
              Progress {doneCount}/{steps.length}
            </p>
            <p className="font-mono text-[11px] text-steel">
              {readyToBid ? "Ready to join" : "Keep going"}
            </p>
          </div>
          <div className="mt-3 flex gap-1.5">
            {steps.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  s.done ? "bg-accent" : "bg-line",
                )}
                aria-label={`${s.label}${s.done ? " done" : ""}`}
              />
            ))}
          </div>
          <ol className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-steel-deep">
            {steps.map((s, i) => (
              <li key={s.id} className={cn(s.done && "text-accent")}>
                {i + 1}. {s.label}
                {s.done ? " ✓" : ""}
              </li>
            ))}
          </ol>
        </div>

        {/* Watch without wallet */}
        {!connected && (
          <div className="bv-card border-dashed border-line">
            <p className="text-[14px] font-medium text-ink">
              Just looking? No wallet needed
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-steel-deep">
              You can browse cards and watch a live lot. Bidding and peeks need
              a Devnet wallet.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <MotionNavLink
                href="/warehouse"
                className={cn(buttonVariants({ variant: "paper", size: "sm" }))}
              >
                Browse cards
              </MotionNavLink>
              {vaultId && hasActive && (
                <MotionNavLink
                  href={`/vault/${vaultId}`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                >
                  Watch lot {vaultId}
                </MotionNavLink>
              )}
            </div>
          </div>
        )}

        <Stagger className="flex flex-col gap-4">
          {/* 1 Wallet */}
          <StaggerItem>
            <StepCard
              n={1}
              title="Connect your wallet"
              done={connected}
              active={activeStep === "wallet"}
            >
              <p className="text-[13px] text-steel-deep">
                Use Phantom or Solflare set to{" "}
                <span className="font-medium text-ink">Devnet</span>
                {" "}(wallet Settings → Developer → Testnet / Devnet). This app
                only works on Devnet.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <WalletButton />
                {connected && (
                  <span className="font-mono text-[11px] text-steel">
                    {shortAddr(publicKey?.toBase58())}
                  </span>
                )}
              </div>
              {connected && bal.data && (
                <p className="mt-3 font-mono text-[11px] text-steel-deep">
                  SOL {formatSol(bal.data.solLamports)}
                  {!solOk && (
                    <span className="text-stamp-red-deep">
                      {" "}
                      · need Devnet SOL for fees
                    </span>
                  )}
                </p>
              )}
              {connected && !solOk && (
                <p className="mt-2 text-[12px] leading-relaxed text-steel-deep">
                  Get free Devnet SOL from the{" "}
                  <a
                    className="underline underline-offset-2"
                    href={DEVNET_FAUCET}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Solana faucet
                  </a>
                  , then refresh this page.
                </p>
              )}
            </StepCard>
          </StaggerItem>

          {/* 2 Guest book */}
          <StaggerItem>
            <StepCard
              n={2}
              title="Sign in (free)"
              done={guestOk}
              active={activeStep === "guestbook"}
              locked={!connected}
            >
              <p className="text-[13px] text-steel-deep">
                Approve one free message in your wallet. That unlocks private
                bids and peeks. If you already signed this session, you can skip.
              </p>
              <Button
                variant="paper"
                className="mt-4"
                disabled={!connected || tee.busy || guestOk}
                onClick={() => void tee.signGuestBook()}
              >
                {guestOk
                  ? "Signed in"
                  : tee.busy
                    ? "Check your wallet…"
                    : "Sign in"}
              </Button>
              {tee.error && (
                <p
                  role="alert"
                  aria-live="polite"
                  className="mt-2 text-[12px] leading-relaxed text-stamp-red-deep"
                >
                  {tee.error}
                </p>
              )}
            </StepCard>
          </StaggerItem>

          {/* 3 SCRIP */}
          <StaggerItem>
            <StepCard
              n={3}
              title="Get free SCRIP"
              done={scripOk}
              active={activeStep === "scrip"}
              locked={!connected}
            >
              <p className="text-[13px] text-steel-deep">
                SCRIP is free play money for bids and peeks —{" "}
                <span className="font-medium text-ink">not real cash</span>.
                Claim 500 SCRIP (once every 12 hours). You also need a little
                free Devnet SOL for network fees.
              </p>
              {connected && (
                <p className="mt-2 font-mono text-[11px] text-steel-deep">
                  Balance{" "}
                  {bal.isLoading
                    ? "…"
                    : `${scripUi.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })} SCRIP`}
                  {scripOk && scripUi > 0 ? " · enough to bid" : ""}
                </p>
              )}
              {onFaucetCooldown && faucetCd.data?.nextClaimTs ? (
                <NextBidWindow
                  className="mt-4"
                  reason="faucet"
                  nextReadyTs={faucetCd.data.nextClaimTs}
                  typicalDurationSecs={typicalSecs}
                />
              ) : null}
              <Button
                className="mt-4"
                disabled={
                  !connected ||
                  faucet.busy ||
                  onFaucetCooldown ||
                  (scripOk && scripUi >= 100)
                }
                onClick={() => void claimScrip()}
              >
                {faucet.busy
                  ? "Claiming…"
                  : onFaucetCooldown
                    ? "On cooldown"
                    : scripOk && scripUi >= MIN_SCRIP_UI
                      ? scripUi >= 100
                        ? "Credits ready"
                        : "Claim more SCRIP"
                      : "Claim 500 SCRIP"}
              </Button>
              {faucet.sig && (
                <a
                  className="mt-2 block font-mono text-[11px] underline"
                  href={solanaTxUrl(faucet.sig)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Claim tx {shortAddr(faucet.sig)}
                </a>
              )}
              {faucet.error && (
                <p
                  role="alert"
                  aria-live="polite"
                  className="mt-2 text-[12px] leading-relaxed text-stamp-red-deep"
                >
                  {formatFaucetError(faucet.error, solOk)}
                </p>
              )}
              {!solOk && connected && (
                <p className="mt-2 text-[12px] text-steel-deep">
                  Claim may fail without Devnet SOL — use the{" "}
                  <a
                    className="underline underline-offset-2"
                    href={DEVNET_FAUCET}
                    target="_blank"
                    rel="noreferrer"
                  >
                    faucet
                  </a>{" "}
                  first.
                </p>
              )}
            </StepCard>
          </StaggerItem>
        </Stagger>

        {/* Primary CTA */}
        {readyToBid && vaultId && hasActive ? (
          <MotionNavLink
            href={`/vault/${vaultId}`}
            className={cn(buttonVariants({ size: "lg" }), "mt-8 w-full")}
          >
            Join lot {vaultId}
          </MotionNavLink>
        ) : readyToBid ? (
          <div className="mt-8 space-y-3">
            <NextBidWindow reason="no-lot" typicalDurationSecs={typicalSecs} />
            <MotionNavLink
              href="/warehouse"
              className={cn(buttonVariants({ size: "lg" }), "w-full")}
            >
              Browse cards while you wait
            </MotionNavLink>
          </div>
        ) : (
          <p className="mt-6 text-center text-[12px] text-steel">
            Finish the steps above, then join a lot. Or{" "}
            <MotionNavLink href="/warehouse" className="underline">
              browse cards
            </MotionNavLink>{" "}
            anytime.
          </p>
        )}

        <RulesStrip className="mt-8" />

        <p className="mt-6 text-center text-[11px] leading-relaxed text-steel">
          Test network only · free play credits · no real money
        </p>
      </section>
    </PageEnter>
  );
}

function StepCard({
  n,
  title,
  done,
  active,
  locked,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  active: boolean;
  locked?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "bv-card transition-opacity",
        locked && "opacity-55",
        active && !done && "ring-1 ring-accent/25",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[14px] font-medium">
          {n} · {title}
        </p>
        {done ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-accent">
            Done
          </span>
        ) : active ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-steel-deep">
            Now
          </span>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function formatSol(lamports: number): string {
  return (lamports / 1_000_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

function formatFaucetError(msg: string, solOk: boolean): string {
  const lower = msg.toLowerCase();
  if (
    !solOk ||
    lower.includes("insufficient") ||
    lower.includes("no record of a prior credit") ||
    lower.includes("attempt to debit")
  ) {
    return `${msg} — Get Devnet SOL from faucet.solana.com, switch Phantom to Devnet, then retry.`;
  }
  if (lower.includes("cooldown") || lower.includes("too early")) {
    return `${msg} — Faucet is on a 12h cooldown. If you already have SCRIP, you can enter the lot.`;
  }
  if (lower.includes("user rejected") || lower.includes("rejected")) {
    return `${msg} — Approve the transaction in your wallet.`;
  }
  return msg;
}
