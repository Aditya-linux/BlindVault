"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { CollectibleCard } from "@/components/CollectibleCard";
import { WalletButton } from "@/components/WalletButton";
import { useActiveVault } from "@/hooks/useActiveVault";
import { useMyBid } from "@/hooks/useMyBid";
import { useVaultLive } from "@/hooks/useVaultLive";
import { useLotCloser } from "@/hooks/useLotCloser";
import {
  resolveRevealedCards,
  useItemsOnChain,
  useMyInventory,
} from "@/hooks/useItemsOnChain";
import { useMyWinnings } from "@/hooks/useMyWinnings";
import { housePda, vaultPda } from "@/lib/pdas";
import {
  formatPackLine,
  loadPacksForOwner,
  type PackRecord,
} from "@/lib/packHistory";
import {
  listRememberedBids,
  type RememberedBid,
} from "@/lib/bidMemory";
import { formatPackScoreLine, scorePack } from "@/lib/packScore";
import { stackInventory } from "@/lib/stackInventory";
import { useTeeAuth } from "@/hooks/useTeeAuth";
import { MotionNavLink, PageEnter, soft, motion } from "@/components/motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function MePage() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const owner = publicKey?.toBase58();
  const tee = useTeeAuth();
  const active = useActiveVault();
  const inventory = useMyInventory(owner);
  const allItems = useItemsOnChain();
  const winnings = useMyWinnings(owner);
  const [localPacks, setLocalPacks] = useState<PackRecord[]>([]);
  const [remembered, setRemembered] = useState<RememberedBid[]>([]);

  const vaultId =
    active.data && active.data.nextVaultId > 1
      ? active.data.nextVaultId - 1
      : null;
  const hasActive = Boolean(active.data?.activeVault);
  const vaultPk =
    vaultId && hasActive ? vaultPda(housePda(), vaultId).toBase58() : null;
  const myBid = useMyBid(vaultPk);
  const vaultLive = useVaultLive(vaultPk, vaultId);
  const closer = useLotCloser(vaultLive.data);

  useEffect(() => {
    setLocalPacks(loadPacksForOwner(owner));
    setRemembered(listRememberedBids(owner));
  }, [owner, winnings.dataUpdatedAt, tee.token, myBid.dataUpdatedAt]);

  useEffect(() => {
    if (
      closer.completedVaultId != null &&
      vaultId != null &&
      closer.completedVaultId === vaultId
    ) {
      router.push(`/vault/${vaultId}/reveal`);
    }
  }, [closer.completedVaultId, vaultId, router]);

  const rememberedOnLive =
    owner && vaultId != null
      ? remembered.find((b) => b.vaultId === vaultId)
      : undefined;

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

    for (const lot of winnings.data ?? []) {
      if (!lot.settled) continue;
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

  const pastRemembered = remembered.filter((b) => b.vaultId !== vaultId);

  return (
    <PageEnter className="mx-auto flex max-w-2xl flex-col gap-12">
      <header>
        <h1 className="font-display text-4xl tracking-[-0.03em]">My bids</h1>
        <p className="mt-2 max-w-md text-[15px] leading-relaxed text-steel-deep">
          Your sealed bid, packs you claimed, and a quick note on play money.
        </p>
      </header>

      <p className="border-l border-accent/40 pl-4 text-[13px] leading-relaxed text-steel-deep">
        <span className="font-medium text-ink">SCRIP</span> is Blind Vault’s
        free Devnet play token — not real money. Claim it on{" "}
        <MotionNavLink href="/paddle" className="font-medium text-accent">
          Paddle
        </MotionNavLink>
        , bid with it, win cards. Nothing here has cash value.
      </p>

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-2xl tracking-[-0.03em]">
            Current bid
          </h2>
          {vaultId != null && hasActive && (
            <span className="font-mono text-[11px] text-steel">
              Lot {vaultId}
              {vaultLive.data?.status ? ` · ${vaultLive.data.status}` : ""}
            </span>
          )}
        </div>

        {!connected && (
          <div className="mt-5 flex flex-col gap-3">
            <p className="text-[14px] text-steel-deep">
              Connect a Devnet wallet to see your sealed bid.
            </p>
            <WalletButton />
          </div>
        )}

        {connected && !tee.token && (
          <div className="mt-5 flex flex-col gap-3">
            <p className="text-[14px] text-steel-deep">
              Sign in once — sealed bids stay private until you do.
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

        {connected && tee.token && myBid.isLoading && (
          <p className="mt-5 text-[14px] text-steel-deep">Loading your bid…</p>
        )}

        {connected && tee.token && myBid.data && vaultId != null && (
          <motion.div
            className="mt-5"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={soft}
          >
            <p className="text-[22px] font-medium tabular-nums text-ink">
              {myBid.data.amount / 1_000_000}{" "}
              <span className="text-[14px] font-normal text-steel-deep">
                SCRIP sealed
              </span>
            </p>
            <p className="mt-1 text-[13px] text-steel-deep">
              Only you can see this amount until reveal.
            </p>
            <MotionNavLink
              href={`/vault/${vaultId}`}
              className="mt-4 inline-block text-[14px] font-medium text-accent"
            >
              Open lot {vaultId} →
            </MotionNavLink>
          </motion.div>
        )}

        {connected &&
          tee.token &&
          !myBid.isLoading &&
          !myBid.data &&
          rememberedOnLive &&
          vaultId != null && (
            <div className="mt-5">
              <p className="text-[15px] font-medium text-ink">
                You sealed a bid on lot {vaultId}
                {rememberedOnLive.amountScrip != null
                  ? ` · ~${rememberedOnLive.amountScrip} SCRIP`
                  : ""}
              </p>
              <p className="mt-1 text-[13px] text-steel-deep">
                Saved on this device. Open the lot (and Sign in) to refresh the
                private amount from TEE.
              </p>
              <MotionNavLink
                href={`/vault/${vaultId}`}
                className="mt-4 inline-block text-[14px] font-medium text-accent"
              >
                Open lot {vaultId} →
              </MotionNavLink>
            </div>
          )}

        {connected &&
          tee.token &&
          !myBid.isLoading &&
          !myBid.data &&
          !rememberedOnLive && (
            <div className="mt-5">
              <p className="text-[14px] text-steel-deep">
                {hasActive && vaultId
                  ? "No sealed bid on the live lot from this wallet."
                  : "No live lot right now — check Home when Join appears."}
              </p>
              <MotionNavLink
                href={vaultId && hasActive ? `/vault/${vaultId}` : "/"}
                className="mt-3 inline-block text-[14px] font-medium text-accent"
              >
                {vaultId && hasActive ? `Go to lot ${vaultId}` : "Home"}
              </MotionNavLink>
            </div>
          )}

        {pastRemembered.length > 0 && (
          <ul className="mt-8 space-y-3 border-t border-line/70 pt-6">
            <li className="text-[11px] font-medium uppercase tracking-[0.12em] text-steel">
              Recent bids on this device
            </li>
            {pastRemembered.slice(0, 5).map((b) => (
              <li
                key={b.vaultId}
                className="flex flex-wrap items-baseline justify-between gap-2 text-[14px]"
              >
                <span className="text-ink">
                  Lot {b.vaultId}
                  {b.amountScrip != null ? (
                    <span className="text-steel-deep">
                      {" "}
                      · {b.amountScrip} SCRIP
                    </span>
                  ) : null}
                </span>
                <MotionNavLink
                  href={`/vault/${b.vaultId}`}
                  className="font-medium text-accent"
                >
                  Open
                </MotionNavLink>
              </li>
            ))}
          </ul>
        )}
      </section>

      {closer.needsAction &&
        vaultId != null &&
        !history.some((h) => h.vaultId === vaultId) && (
        <section className="border-t border-accent/30 pt-8">
          <h2 className="font-display text-2xl tracking-[-0.03em]">
            Claim lot {vaultId}
          </h2>
          <p className="mt-2 max-w-md text-[14px] text-steel-deep">
            Timer’s up. Tap Claim, then approve in Phantom — you’ll see the
            pack next.
          </p>
          <Button
            size="lg"
            className="mt-5"
            disabled={closer.busy}
            onClick={() => void closer.run()}
          >
            {closer.busy
              ? "Waiting on Phantom…"
              : closer.error
                ? "Try claim again"
                : "Claim my pack"}
          </Button>
          {closer.busy && closer.phase && (
            <p className="mt-2 text-[13px] text-steel-deep">{closer.phase}</p>
          )}
          {closer.error && (
            <p
              role="alert"
              className="mt-2 text-[13px] font-medium text-stamp-red-deep"
            >
              {closer.error}
            </p>
          )}
        </section>
      )}

      <section>
        <h2 className="font-display text-2xl tracking-[-0.03em]">Your cards</h2>
        <p className="mt-1 text-[13px] text-steel-deep">
          Cards whose ownership finalized on Solana.
        </p>
        {connected && (inventory.isLoading || winnings.isLoading) && (
          <p className="mt-5 text-[14px] text-steel-deep">Loading…</p>
        )}
        {connected &&
          !inventory.isLoading &&
          !winnings.isLoading &&
          collection.length === 0 && (
            <p className="mt-5 text-[14px] text-steel-deep">
              Empty for now — win a lot, claim the pack, cards land here.
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
      </section>

      <section id="winnings" className="scroll-mt-24">
        <h2 className="font-display text-2xl tracking-[-0.03em]">
          Packs you won
        </h2>
        <p className="mt-1 text-[13px] text-steel-deep">
          After you claim on a finished lot.
        </p>
        {connected &&
          !winnings.isLoading &&
          history.length === 0 &&
          localPacks.length === 0 && (
            <p className="mt-5 text-[14px] text-steel-deep">No packs yet.</p>
          )}
        {connected && (history.length > 0 || localPacks.length > 0) && (
          <ul className="mt-6 divide-y divide-line/70 border-y border-line/70">
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
                <li key={lot.vaultId} className="py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[15px] font-medium text-ink">
                      Lot {lot.vaultId}
                    </p>
                    <p className="font-mono text-[12px] text-steel">
                      {lot.highestBid / 1_000_000} SCRIP
                    </p>
                  </div>
                  {packLine && (
                    <p className="mt-1 text-[14px] text-steel-deep">
                      You packed {packLine}
                    </p>
                  )}
                  {stacked.length > 0 && lot.highestBid > 0 && (
                    <p className="mt-1 text-[13px] font-medium text-ink">
                      {formatPackScoreLine(
                        scorePack({
                          highestBidRaw: lot.highestBid,
                          cards: stacked,
                        }),
                      )}
                    </p>
                  )}
                  {stacked.length > 0 && (
                    <ul className="mt-3 grid grid-cols-3 gap-2">
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
                <li key={`local-${p.vaultId}`} className="py-5">
                  <p className="text-[15px] font-medium">Lot {p.vaultId}</p>
                  <p className="mt-1 text-[14px] text-steel-deep">
                    You packed {formatPackLine(p.names)}
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
