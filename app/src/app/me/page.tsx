"use client";

import { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { CollectibleCard } from "@/components/CollectibleCard";
import { WalletButton } from "@/components/WalletButton";
import { useActiveVault } from "@/hooks/useActiveVault";
import { useMyBid } from "@/hooks/useMyBid";
import {
  resolveRevealedCards,
  useItemsOnChain,
  useMyInventory,
} from "@/hooks/useItemsOnChain";
import { useMyWinnings } from "@/hooks/useMyWinnings";
import { housePda, vaultPda } from "@/lib/pdas";
import { shortAddr } from "@/lib/format";
import {
  formatPackLine,
  loadPacksForOwner,
  type PackRecord,
} from "@/lib/packHistory";
import { stackInventory } from "@/lib/stackInventory";
import { useTeeAuth } from "@/hooks/useTeeAuth";
import { MotionNavLink, PageEnter, soft, motion } from "@/components/motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function MePage() {
  const { publicKey, connected } = useWallet();
  const owner = publicKey?.toBase58();
  const tee = useTeeAuth();
  const active = useActiveVault();
  const inventory = useMyInventory(owner);
  const allItems = useItemsOnChain();
  const winnings = useMyWinnings(owner);
  const [localPacks, setLocalPacks] = useState<PackRecord[]>([]);

  useEffect(() => {
    setLocalPacks(loadPacksForOwner(owner));
  }, [owner, winnings.dataUpdatedAt]);
  const vaultId =
    active.data && active.data.nextVaultId > 1
      ? active.data.nextVaultId - 1
      : null;
  const hasActive = Boolean(active.data?.activeVault);
  const vaultPk =
    vaultId && hasActive ? vaultPda(housePda(), vaultId).toBase58() : null;
  const myBid = useMyBid(vaultPk);

  const collection = useMemo(() => {
    const byIndex = new Map<
      number,
      {
        index: number;
        name: string;
        rarity: number;
        category: number;
        value: number;
        sold?: boolean;
      }
    >();

    for (const item of inventory.data ?? []) {
      byIndex.set(item.index, {
        index: item.index,
        name: item.name,
        rarity: item.rarity,
        category: item.category,
        value: item.value,
        sold: item.sold,
      });
    }

    // Pending / revealed wins before Item.owner updates (or if inventory RPC flakes).
    for (const lot of winnings.data ?? []) {
      for (const card of resolveRevealedCards(
        lot.revealedItems,
        allItems.data,
      )) {
        if (!byIndex.has(card.index)) {
          byIndex.set(card.index, {
            index: card.index,
            name: card.name,
            rarity: card.rarity,
            category: card.category,
            value: card.value,
            sold: card.sold,
          });
        }
      }
    }

    return stackInventory([...byIndex.values()]);
  }, [inventory.data, winnings.data, allItems.data]);

  const history = winnings.data ?? [];
  const packsByVault = useMemo(() => {
    const map = new Map<number, PackRecord>();
    for (const p of localPacks) map.set(p.vaultId, p);
    return map;
  }, [localPacks]);

  return (
    <PageEnter className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl tracking-[-0.03em]">My bids</h1>
        <p className="mt-2 text-[15px] text-steel-deep">
          Your current bid, the cards you won, and a history of packs you
          opened.
        </p>
      </header>

      <section className="bv-card p-6">
        <h2 className="text-[13px] font-medium text-steel-deep">Current bid</h2>
        {!connected && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-[14px] text-steel-deep">
              Connect a Devnet wallet to see your bids and cards.
            </p>
            <WalletButton />
            <MotionNavLink
              href="/paddle"
              className={cn(buttonVariants({ variant: "paper", size: "sm" }), "w-fit")}
            >
              Set up to bid
            </MotionNavLink>
          </div>
        )}
        {connected && !tee.token && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-[14px] text-steel-deep">
              Sign in once so we can show your private bid.
            </p>
            <Button
              variant="paper"
              size="sm"
              className="w-fit"
              onClick={() => void tee.signGuestBook()}
            >
              Sign in
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
              Lot {vaultId} · {myBid.data.amount / 1_000_000} SCRIP
            </p>
            <p className="mt-1 font-mono text-[11px] text-steel">
              {shortAddr(myBid.data.publicKey)} · only you can see this amount
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
              <p className="text-[14px] text-steel-deep">
                No bid on the current lot yet.
              </p>
              <MotionNavLink
                href={vaultId ? `/vault/${vaultId}` : "/paddle"}
                className="mt-3 inline-block text-[13px] font-medium text-accent"
              >
                {vaultId ? `Go to lot ${vaultId}` : "Set up to bid"}
              </MotionNavLink>
            </div>
          )
        )}
        {myBid.isError && (
          <p className="mt-3 font-mono text-[11px] text-stamp-red-deep">
            Couldn’t read your bid — sign in again or refresh.
          </p>
        )}
      </section>

      <section className="bv-card p-6">
        <h2 className="font-display text-2xl tracking-[-0.02em]">Your cards</h2>
        <p className="mt-1 text-[13px] text-steel-deep">
          Cards from auctions you won. Duplicates show as Name ×N.
        </p>
        {connected && (inventory.isLoading || winnings.isLoading) && (
          <p className="mt-5 text-[14px] text-steel-deep">Loading cards…</p>
        )}
        {connected && inventory.isError && winnings.isError && (
          <p className="mt-5 font-mono text-[12px] text-stamp-red-deep">
            Couldn’t load cards — refresh to retry.
          </p>
        )}
        {connected &&
          !inventory.isLoading &&
          !winnings.isLoading &&
          collection.length === 0 && (
            <p className="mt-5 text-[14px] text-steel-deep">
              Empty for now. Win a lot and your cards show up here after reveal.
            </p>
          )}
        {connected && collection.length > 0 && (
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {collection.map((item) => (
              <li key={`${item.index}-${item.indices.join("-")}`}>
                <CollectibleCard
                  index={item.index}
                  name={item.name}
                  rarity={item.rarity}
                  category={item.category}
                  value={item.value}
                  count={item.count}
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
          Browse cards
        </MotionNavLink>
      </section>

      <section id="winnings" className="bv-card scroll-mt-24 p-6">
        <h2 className="font-display text-2xl tracking-[-0.02em]">
          Packs you won
        </h2>
        <p className="mt-1 text-[13px] text-steel-deep">
          Lots you won, with the cards you packed.
        </p>
        {connected && winnings.isLoading && (
          <p className="mt-5 text-[14px] text-steel-deep">Loading history…</p>
        )}
        {connected && winnings.isError && (
          <p className="mt-5 font-mono text-[12px] text-stamp-red-deep">
            Couldn’t load history — refresh to retry.
          </p>
        )}
        {connected &&
          !winnings.isLoading &&
          history.length === 0 &&
          localPacks.length === 0 && (
            <p className="mt-5 text-[14px] text-steel-deep">No wins yet.</p>
          )}
        {connected && (history.length > 0 || localPacks.length > 0) && (
          <ul className="mt-5 flex flex-col gap-3">
            {history.map((lot) => {
              const cards = resolveRevealedCards(
                lot.revealedItems,
                allItems.data,
              );
              const stacked = stackInventory(cards);
              const local = packsByVault.get(lot.vaultId);
              const packLine = local?.names.length
                ? formatPackLine(local.names)
                : stacked.length > 0
                  ? formatPackLine(
                      stacked.map((c) =>
                        c.count > 1 ? `${c.name} ×${c.count}` : c.name,
                      ),
                    )
                  : null;
              return (
                <li
                  key={lot.vaultId}
                  className="rounded-2xl border border-line bg-cardboard/80 p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[15px] font-medium">
                      Lot {lot.vaultId}
                      <span className="ml-2 font-mono text-[11px] font-normal text-steel">
                        {lot.status}
                        {lot.abandoned ? " · abandoned" : ""}
                      </span>
                    </p>
                    <p className="font-mono text-[12px] text-steel-deep">
                      {lot.highestBid / 1_000_000} SCRIP
                    </p>
                  </div>
                  {packLine && (
                    <p className="mt-2 text-[14px] font-medium text-ink">
                      You packed {packLine}
                    </p>
                  )}
                  {stacked.length > 0 ? (
                    <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {stacked.map((item) => (
                        <li key={`${lot.vaultId}-${item.index}`}>
                          <CollectibleCard
                            index={item.index}
                            name={item.name}
                            rarity={item.rarity}
                            category={item.category}
                            value={item.value}
                            count={item.count}
                            compact
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[13px] text-steel-deep">
                      {lot.itemCount} card{lot.itemCount === 1 ? "" : "s"} —
                      waiting for reveal.
                    </p>
                  )}
                  <MotionNavLink
                    href={`/vault/${lot.vaultId}/reveal`}
                    className="mt-3 inline-block text-[13px] font-medium text-accent"
                  >
                    See results
                  </MotionNavLink>
                </li>
              );
            })}
            {localPacks
              .filter((p) => !history.some((h) => h.vaultId === p.vaultId))
              .map((p) => (
                <li
                  key={`local-${p.vaultId}`}
                  className="rounded-2xl border border-line bg-cardboard/80 p-4"
                >
                  <p className="text-[15px] font-medium">Lot {p.vaultId}</p>
                  <p className="mt-2 text-[14px] font-medium text-ink">
                    You packed {formatPackLine(p.names)}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-steel">
                    Saved on this device ·{" "}
                    {new Date(p.at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  <MotionNavLink
                    href={`/vault/${p.vaultId}/reveal`}
                    className="mt-3 inline-block text-[13px] font-medium text-accent"
                  >
                    See results
                  </MotionNavLink>
                </li>
              ))}
          </ul>
        )}
      </section>
    </PageEnter>
  );
}
