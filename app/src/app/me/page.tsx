"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { CollectibleCard } from "@/components/CollectibleCard";
import { WalletButton } from "@/components/WalletButton";
import { useActiveVault } from "@/hooks/useActiveVault";
import { useMyBid } from "@/hooks/useMyBid";
import { useMyInventory } from "@/hooks/useItemsOnChain";
import { housePda, vaultPda } from "@/lib/pdas";
import { shortAddr } from "@/lib/format";
import { useTeeAuth } from "@/hooks/useTeeAuth";
import { MotionNavLink, PageEnter, soft, motion } from "@/components/motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function MePage() {
  const { publicKey, connected } = useWallet();
  const tee = useTeeAuth();
  const active = useActiveVault();
  const inventory = useMyInventory(publicKey?.toBase58());
  const vaultId =
    active.data && active.data.nextVaultId > 1
      ? active.data.nextVaultId - 1
      : null;
  const hasActive = Boolean(active.data?.activeVault);
  const vaultPk =
    vaultId && hasActive ? vaultPda(housePda(), vaultId).toBase58() : null;
  const myBid = useMyBid(vaultPk);
  const cards = inventory.data ?? [];

  return (
    <PageEnter className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl tracking-[-0.03em]">My bids</h1>
        <p className="mt-2 text-[15px] text-steel-deep">
          Your sealed envelope and cards won after finalize.
        </p>
      </header>

      <section className="bv-card p-6">
        <h2 className="text-[13px] font-medium text-steel-deep">Active bid</h2>
        {!connected && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-[14px] text-steel-deep">
              Connect a Devnet wallet to see sealed bids and storage.
            </p>
            <WalletButton />
            <MotionNavLink
              href="/paddle"
              className={cn(buttonVariants({ variant: "paper", size: "sm" }), "w-fit")}
            >
              Open paddle setup
            </MotionNavLink>
          </div>
        )}
        {connected && !tee.token && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-[14px] text-steel-deep">
              Sign the TEE guest book to read your private bid account.
            </p>
            <Button
              variant="paper"
              size="sm"
              className="w-fit"
              onClick={() => void tee.signGuestBook()}
            >
              Sign guest book
            </Button>
          </div>
        )}
        {myBid.data ? (
          <motion.div
            className="mt-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={soft}
          >
            <p className="text-[15px] font-medium">
              Lot {vaultId} · {myBid.data.amount / 1_000_000} SCRIP sealed
            </p>
            <p className="mt-1 font-mono text-[11px] text-steel">
              {shortAddr(myBid.data.publicKey)} · amount private to you on TEE
            </p>
            <MotionNavLink
              href={`/vault/${vaultId}`}
              className="mt-3 inline-block text-[13px] font-medium text-accent"
            >
              Open lot
            </MotionNavLink>
          </motion.div>
        ) : (
          connected &&
          tee.token && (
            <div className="mt-4">
              <p className="text-[14px] text-steel-deep">No sealed bid on the active lot.</p>
              <MotionNavLink
                href={vaultId ? `/vault/${vaultId}` : "/paddle"}
                className="mt-3 inline-block text-[13px] font-medium text-accent"
              >
                {vaultId ? `Go to lot ${vaultId}` : "Get paddle"}
              </MotionNavLink>
            </div>
          )
        )}
        {myBid.isError && (
          <p className="mt-3 font-mono text-[11px] text-stamp-red-deep">
            Could not read bid — retry guest book or refresh.
          </p>
        )}
      </section>

      <section className="bv-card p-6">
        <h2 className="font-display text-2xl tracking-[-0.02em]">Storage</h2>
        <p className="mt-1 text-[13px] text-steel-deep">
          Creature cards after finalize lands them in your wallet.
        </p>
        {connected && inventory.isLoading && (
          <p className="mt-5 text-[14px] text-steel-deep">Reading chain…</p>
        )}
        {connected && inventory.isError && (
          <p className="mt-5 font-mono text-[12px] text-stamp-red-deep">
            Inventory read failed — refresh to retry.
          </p>
        )}
        {connected && !inventory.isLoading && cards.length === 0 && (
          <p className="mt-5 text-[14px] text-steel-deep">
            Empty for now. Win a lot, wait for finalize, then cards appear here.
          </p>
        )}
        {connected && cards.length > 0 && (
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cards.map((item) => (
              <li key={item.index}>
                <CollectibleCard
                  index={item.index}
                  name={item.name}
                  rarity={item.rarity}
                  category={item.category}
                  value={item.value}
                  compact
                />
              </li>
            ))}
          </ul>
        )}
        <MotionNavLink
          href="/warehouse"
          className="mt-4 inline-block text-[13px] font-medium text-accent"
        >
          Browse warehouse
        </MotionNavLink>
      </section>
    </PageEnter>
  );
}
