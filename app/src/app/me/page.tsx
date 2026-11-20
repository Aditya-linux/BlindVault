"use client";

import Image from "next/image";
import { useWallet } from "@solana/wallet-adapter-react";
import { useActiveVault } from "@/hooks/useActiveVault";
import { useMyBid } from "@/hooks/useMyBid";
import { useMyInventory } from "@/hooks/useItemsOnChain";
import { housePda, vaultPda } from "@/lib/pdas";
import { categoryLabel, rarityLabel, shortAddr } from "@/lib/format";
import { itemImageSrc } from "@/lib/itemArt";
import { useTeeAuth } from "@/hooks/useTeeAuth";
import { MotionNavLink, PageEnter, soft, motion } from "@/components/motion";
import { Button } from "@/components/ui/button";

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

  return (
    <PageEnter className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="font-display text-4xl tracking-[-0.03em]">My bids</h1>
        <p className="mt-2 text-[15px] text-steel-deep">
          Private envelopes and claimed warehouse lots.
        </p>
      </header>

      <section className="bv-card p-6">
        {!connected && (
          <p className="text-[14px] text-steel-deep">Connect a wallet to begin.</p>
        )}
        {connected && !tee.token && (
          <Button
            variant="paper"
            size="sm"
            onClick={() => void tee.signGuestBook()}
          >
            Sign guest book
          </Button>
        )}
        {myBid.data ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={soft}
          >
            <p className="text-[15px] font-medium">
              Lot {vaultId} · {myBid.data.amount / 1_000_000} SCRIP sealed
            </p>
            <p className="mt-1 font-mono text-[11px] text-steel">
              {shortAddr(myBid.data.publicKey)}
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
            <p className="text-[14px] text-steel-deep">No sealed bids yet.</p>
          )
        )}
      </section>

      <section className="bv-card p-6">
        <h2 className="font-display text-2xl tracking-[-0.02em]">Storage</h2>
        <p className="mt-1 text-[13px] text-steel-deep">
          Items after finalize.
        </p>
        {connected && inventory.isLoading && (
          <p className="mt-5 text-[14px] text-steel-deep">Reading chain…</p>
        )}
        {connected && !inventory.isLoading && inventory.data.length === 0 && (
          <p className="mt-5 text-[14px] text-steel-deep">Empty for now.</p>
        )}
        {connected && inventory.data.length > 0 && (
          <ul className="mt-5 space-y-2">
            {inventory.data.map((item) => {
              const src = itemImageSrc(item.index);
              return (
                <li
                  key={item.index}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-mist px-3 py-2.5"
                >
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-paper">
                    {src ? (
                      <Image
                        src={src}
                        alt={item.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    ) : null}
                  </div>
                  <div>
                    <p className="text-[14px] font-medium">
                      {item.name}
                      <span className="ml-2 font-mono text-[11px] text-steel">
                        #{item.index}
                      </span>
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-steel">
                      {rarityLabel(item.rarity)} · {categoryLabel(item.category)}{" "}
                      · {item.value} SCRIP
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <MotionNavLink
          href="/warehouse"
          className="mt-4 inline-block text-[13px] font-medium text-accent"
        >
          Warehouse
        </MotionNavLink>
      </section>
    </PageEnter>
  );
}
