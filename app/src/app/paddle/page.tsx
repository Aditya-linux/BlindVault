"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useTeeAuth } from "@/hooks/useTeeAuth";
import { useFaucet } from "@/hooks/useFaucet";
import { useActiveVault } from "@/hooks/useActiveVault";
import { WalletButton } from "@/components/WalletButton";
import { shortAddr } from "@/lib/format";
import { solanaTxUrl } from "@/lib/explorer";
import { MotionNavLink, PageEnter, Stagger, StaggerItem } from "@/components/motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function PaddlePage() {
  const { connected, publicKey } = useWallet();
  const tee = useTeeAuth();
  const faucet = useFaucet();
  const active = useActiveVault();
  const vaultId =
    active.data && active.data.nextVaultId > 1
      ? active.data.nextVaultId - 1
      : null;
  const hasActive = Boolean(active.data?.activeVault);

  return (
    <PageEnter>
      <section className="mx-auto max-w-lg">
        <header className="mb-8">
          <h1 className="font-display text-4xl tracking-[-0.03em]">Paddle</h1>
          <p className="mt-2 text-[15px] text-steel-deep">
            Three quiet steps before you seal an envelope.
          </p>
        </header>

        <Stagger className="flex flex-col gap-3">
          <StaggerItem>
            <div className="bv-card p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[14px] font-medium">1 · Wallet</p>
                {connected && (
                  <span className="font-mono text-[10px] text-accent">Done</span>
                )}
              </div>
              <p className="mt-1 text-[13px] text-steel-deep">
                Devnet wallet for guest book and bidding.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <WalletButton />
                {connected && (
                  <span className="font-mono text-[11px] text-steel">
                    {shortAddr(publicKey?.toBase58())}
                  </span>
                )}
              </div>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="bv-card p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[14px] font-medium">2 · Guest book</p>
                {tee.token && (
                  <span className="font-mono text-[10px] text-accent">Done</span>
                )}
              </div>
              <p className="mt-1 text-[13px] text-steel-deep">
                Free signature unlocks private TEE reads.
              </p>
              <Button
                variant="paper"
                className="mt-4"
                disabled={!connected || tee.busy || Boolean(tee.token)}
                onClick={() => void tee.signGuestBook()}
              >
                {tee.token
                  ? "Signed"
                  : tee.busy
                    ? "Waiting…"
                    : "Sign guest book"}
              </Button>
              {tee.error && (
                <p className="mt-2 font-mono text-[11px] text-stamp-red-deep">
                  {tee.error}
                </p>
              )}
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="bv-card p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[14px] font-medium">3 · SCRIP</p>
                {faucet.sig && (
                  <span className="font-mono text-[10px] text-accent">Done</span>
                )}
              </div>
              <p className="mt-1 text-[13px] text-steel-deep">
                Claim 500 SCRIP (12h cooldown). Devnet SOL still needed for fees.
              </p>
              <Button
                className="mt-4"
                disabled={!connected || faucet.busy}
                onClick={() => void faucet.claim()}
              >
                {faucet.busy ? "Claiming…" : "Claim 500 SCRIP"}
              </Button>
              {faucet.sig && (
                <a
                  className="mt-2 block font-mono text-[11px] underline"
                  href={solanaTxUrl(faucet.sig)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortAddr(faucet.sig)}
                </a>
              )}
              {faucet.error && (
                <p className="mt-2 font-mono text-[11px] text-stamp-red-deep">
                  {faucet.error}
                </p>
              )}
            </div>
          </StaggerItem>
        </Stagger>

        {vaultId && hasActive ? (
          <MotionNavLink
            href={`/vault/${vaultId}`}
            className={cn(buttonVariants({ size: "lg" }), "mt-8 w-full")}
          >
            Enter lot {vaultId}
          </MotionNavLink>
        ) : (
          <MotionNavLink
            href="/warehouse"
            className={cn(
              buttonVariants({ variant: "paper", size: "lg" }),
              "mt-8 w-full",
            )}
          >
            Browse warehouse
          </MotionNavLink>
        )}
      </section>
    </PageEnter>
  );
}
