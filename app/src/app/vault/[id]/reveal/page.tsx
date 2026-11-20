"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { motion } from "@/components/motion";
import { categoryLabel, rarityLabel, shortAddr } from "@/lib/format";
import { housePda, vaultPda } from "@/lib/pdas";
import { useVaultLive } from "@/hooks/useVaultLive";
import { useItemsOnChain } from "@/hooks/useItemsOnChain";
import { MotionNavLink, PageEnter, soft } from "@/components/motion";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function RevealPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const vaultPk = useMemo(
    () =>
      Number.isFinite(id) && id > 0 ? vaultPda(housePda(), id).toBase58() : null,
    [id],
  );
  const vaultQ = useVaultLive(vaultPk, id);
  const itemsQ = useItemsOnChain();
  const revealed = vaultQ.data?.revealedItems ?? [];
  const lines =
    revealed.length > 0
      ? revealed.map((idx) => {
          const it = itemsQ.data?.find((x) => x.index === idx);
          if (!it) return `#${idx}`;
          return `${it.name} · ${rarityLabel(it.rarity)} · ${categoryLabel(it.category)} · ${it.value} SCRIP`;
        })
      : vaultQ.data?.status === "Open" || vaultQ.data?.status === "Ended"
        ? ["(vault still sealed — wait for reveal)"]
        : ["(no revealed items yet)"];

  return (
    <PageEnter>
      <section className="bv-card mx-auto max-w-2xl p-6 sm:p-8">
        <header>
          <p className="text-[13px] font-medium text-steel-deep">Reveal</p>
          <h1 className="mt-1 font-display text-4xl tracking-[-0.03em]">
            Lot {params.id}
          </h1>
          <p className="mt-2 text-[14px] text-steel-deep">
            Status {vaultQ.data?.status ?? "…"} · on-chain items only
          </p>
        </header>

        <motion.pre
          className="mt-6 overflow-x-auto rounded-2xl border border-line bg-mist p-4 font-mono text-xs leading-relaxed text-ink"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={soft}
        >
{`ROCCO'S LOCK-UP AUCTIONS
LOT #${params.id} · ${vaultQ.data?.status ?? "…"}
--------------------------------
${lines.join("\n")}
--------------------------------
TOTAL ${vaultQ.data?.revealedValue ?? "—"} SCRIP
WINNER ${shortAddr(vaultQ.data?.winner)}
HIGH BID ${(vaultQ.data?.highestBid ?? 0) / 1_000_000} SCRIP`}
        </motion.pre>

        <div className="mt-5 flex flex-wrap gap-3">
          <MotionNavLink
            href={`/vault/${params.id}/proof`}
            className={cn(buttonVariants({ variant: "paper" }))}
          >
            Evidence
          </MotionNavLink>
          <MotionNavLink href="/" className={cn(buttonVariants())}>
            Home
          </MotionNavLink>
        </div>
      </section>
    </PageEnter>
  );
}
