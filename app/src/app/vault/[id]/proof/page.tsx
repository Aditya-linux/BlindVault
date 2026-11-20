"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { motion } from "@/components/motion";
import { computeHint, hintCopy } from "@/lib/hints";
import { housePda, vaultPda, contentsPda } from "@/lib/pdas";
import { useVaultLive } from "@/hooks/useVaultLive";
import { useHintsLive } from "@/hooks/useHintsLive";
import { useItemsOnChain } from "@/hooks/useItemsOnChain";
import { loadEvidence } from "@/lib/evidence";
import { solanaTxUrl, teeTxUrl, stripToken } from "@/lib/explorer";
import { teeConnection } from "@/lib/connections";
import { useTeeAuth } from "@/hooks/useTeeAuth";
import { shortAddr } from "@/lib/format";
import { IconMagnifier, IconStamp } from "@/components/icons";
import { PageEnter, Stagger, StaggerItem, soft } from "@/components/motion";
import { Button } from "@/components/ui/button";

export default function ProofPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const vaultPk = useMemo(
    () =>
      Number.isFinite(id) && id > 0 ? vaultPda(housePda(), id).toBase58() : null,
    [id],
  );
  const vaultQ = useVaultLive(vaultPk, id);
  const hintsQ = useHintsLive(vaultPk, id);
  const itemsQ = useItemsOnChain();
  const tee = useTeeAuth();
  const [snoop, setSnoop] = useState<string | null>(null);

  const revealed = vaultQ.data?.revealedItems ?? [];
  const sample = revealed
    .map((i) => itemsQ.data?.find((x) => x.index === i))
    .filter(Boolean)
    .map((it) => ({
      index: it!.index,
      rarity: it!.rarity,
      category: it!.category,
      value: it!.value,
    }));
  const checks =
    sample.length > 0
      ? [0, 1, 2, 3].map((kind) => {
          const h = computeHint(kind, sample);
          const released = hintsQ.data?.hints[kind];
          const match =
            released?.released && released.a === h.a && released.b === h.b;
          return { kind, copy: hintCopy(h), match };
        })
      : [];

  const evidence = loadEvidence(String(params.id));

  const runSnoop = async () => {
    if (!vaultPk || !tee.token) {
      setSnoop("Sign the guest book first");
      return;
    }
    const conn = teeConnection(tee.token);
    const contents = contentsPda(new PublicKey(vaultPk));
    const info = await conn.getAccountInfo(contents);
    if (!info) {
      setSnoop("ACCESS DENIED (TEE) — no data for VaultContents");
    } else if (
      vaultQ.data?.status === "Revealed" ||
      vaultQ.data?.status === "Closed" ||
      vaultQ.data?.status === "Settled"
    ) {
      setSnoop(`Readable after reveal · ${info.data.length} bytes`);
    } else {
      setSnoop(
        `Unexpected data len=${info.data.length} (should be denied while private)`,
      );
    }
  };

  return (
    <PageEnter>
      <section className="bv-card p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl border border-line bg-mist text-ink">
            <IconStamp className="size-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl tracking-[-0.03em] sm:text-3xl">
              Evidence board
            </h1>
            <p className="text-[13px] text-steel-deep">
              Lot #{params.id} · live signatures only
            </p>
          </div>
        </div>

        <Stagger className="mt-6 grid gap-3 sm:grid-cols-2">
          {evidence.length === 0 && (
            <StaggerItem>
              <article className="rounded-2xl border border-line bg-mist p-4">
                <p className="text-[14px] font-medium">No exhibits yet</p>
                <p className="mt-1 font-mono text-[11px] text-steel-deep">
                  Stamped after live vault txs land
                </p>
              </article>
            </StaggerItem>
          )}
          {evidence.map((e) => (
            <StaggerItem key={e.sig}>
              <motion.article
                className="rounded-2xl border border-line bg-mist p-4"
                whileHover={{ y: -2 }}
                transition={soft}
              >
                <p className="text-[14px] font-medium">{e.label}</p>
                <a
                  className="mt-2 block font-mono text-[11px] underline"
                  href={stripToken(
                    e.layer === "tee" ? teeTxUrl(e.sig) : solanaTxUrl(e.sig),
                  )}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortAddr(e.sig)} · {e.layer}
                </a>
              </motion.article>
            </StaggerItem>
          ))}
        </Stagger>

        <div className="mt-6 rounded-2xl border border-line bg-mist p-4">
          <h2 className="font-display text-lg tracking-[-0.02em]">
            Hint math check
          </h2>
          {checks.length === 0 ? (
            <p className="mt-2 font-mono text-xs text-steel-deep">
              Waiting for reveal — no sample indices
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1 font-mono text-xs">
              {checks.map((c) => (
                <li key={c.kind}>
                  H{c.kind + 1}: {c.copy}{" "}
                  <span className="text-accent">
                    {c.match ? "✓ matches released hint" : "· pending"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 rounded-2xl border border-stamp-red/40 bg-mist p-4">
          <div className="flex items-center gap-2">
            <IconMagnifier className="size-5 text-stamp-red-deep" />
            <p className="text-[14px] font-medium text-stamp-red-deep">
              Snoop test
            </p>
          </div>
          <p className="mt-1 text-[13px] text-steel-deep">
            Read VaultContents with your TEE token. Before reveal you should see
            ACCESS DENIED.
          </p>
          <Button
            variant="paper"
            size="sm"
            className="mt-3"
            onClick={() => void runSnoop()}
          >
            Try the magnifying glass
          </Button>
          {snoop && (
            <p className="mt-2 font-mono text-xs text-stamp-red-deep">{snoop}</p>
          )}
        </div>
      </section>
    </PageEnter>
  );
}
