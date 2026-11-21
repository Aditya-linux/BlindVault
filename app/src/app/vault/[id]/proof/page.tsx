"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { motion } from "@/components/motion";
import { computeHint, hintCopy } from "@/lib/hints";
import { housePda, vaultPda, peekPda } from "@/lib/pdas";
import { useVaultLive } from "@/hooks/useVaultLive";
import { useHintsLive } from "@/hooks/useHintsLive";
import { useItemsOnChain } from "@/hooks/useItemsOnChain";
import { useMyPeek } from "@/hooks/useBuyPeek";
import { loadEvidence } from "@/lib/evidence";
import { solanaTxUrl, teeTxUrl, stripToken } from "@/lib/explorer";
import { useTeeAuth } from "@/hooks/useTeeAuth";
import { shortAddr, rarityLabel, categoryLabel } from "@/lib/format";
import {
  probePeekAccount,
  probeVaultContents,
  type AccountProbe,
  type ProbeOutcome,
} from "@/lib/privacyProbe";
import { IconMagnifier, IconStamp } from "@/components/icons";
import { PageEnter, Stagger, StaggerItem, soft } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const STRANGER_PEEK_KEY = "bv-proof-stranger-peek";

export default function ProofPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { publicKey } = useWallet();
  const vaultPk = useMemo(
    () =>
      Number.isFinite(id) && id > 0 ? vaultPda(housePda(), id).toBase58() : null,
    [id],
  );
  const vaultQ = useVaultLive(vaultPk, id);
  const hintsQ = useHintsLive(vaultPk, id);
  const itemsQ = useItemsOnChain();
  const tee = useTeeAuth();
  const myPeek = useMyPeek(vaultPk);

  const [contentsProbe, setContentsProbe] = useState<AccountProbe | null>(null);
  const [peekProbe, setPeekProbe] = useState<AccountProbe | null>(null);
  const [busy, setBusy] = useState<"contents" | "my-peek" | "stranger" | null>(
    null,
  );
  const [strangerOwner, setStrangerOwner] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem(STRANGER_PEEK_KEY) ?? "";
  });

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

  const runContentsProbe = async () => {
    if (!vaultPk) return;
    setBusy("contents");
    try {
      const result = await probeVaultContents({
        vaultPk: new PublicKey(vaultPk),
        token: tee.token,
        vaultStatus: vaultQ.data?.status ?? null,
      });
      setContentsProbe(result);
    } finally {
      setBusy(null);
    }
  };

  const runMyPeekProbe = async () => {
    if (!vaultPk || !publicKey) return;
    setBusy("my-peek");
    try {
      // Remember this peek owner so a second wallet can probe the same PDA
      sessionStorage.setItem(STRANGER_PEEK_KEY, publicKey.toBase58());
      setStrangerOwner(publicKey.toBase58());
      const result = await probePeekAccount({
        vaultPk: new PublicKey(vaultPk),
        owner: publicKey,
        token: tee.token,
        caller: publicKey,
      });
      setPeekProbe(result);
    } finally {
      setBusy(null);
    }
  };

  const runStrangerPeekProbe = async () => {
    if (!vaultPk || !strangerOwner) return;
    setBusy("stranger");
    try {
      const owner = new PublicKey(strangerOwner);
      const result = await probePeekAccount({
        vaultPk: new PublicKey(vaultPk),
        owner,
        token: tee.token,
        caller: publicKey ?? null,
      });
      setPeekProbe(result);
    } finally {
      setBusy(null);
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
              Lot #{params.id} · live signatures + honest TEE reads
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

        {/* Contents probe */}
        <div className="mt-4 rounded-2xl border border-line bg-mist p-4">
          <div className="flex items-center gap-2">
            <IconMagnifier className="size-5 text-ink" />
            <p className="text-[14px] font-medium">VaultContents probe</p>
          </div>
          <p className="mt-1 text-[13px] text-steel-deep">
            Authenticated TEE <code className="text-[12px]">getAccountInfo</code>.
            Null is{" "}
            <span className="font-medium text-ink">not</span> labeled ACCESS
            DENIED alone — we check whether the public Vault still exists.
          </p>
          <Button
            variant="paper"
            size="sm"
            className="mt-3"
            disabled={busy !== null}
            onClick={() => void runContentsProbe()}
          >
            {busy === "contents" ? "Probing…" : "Probe VaultContents"}
          </Button>
          {contentsProbe && <ProbeResult probe={contentsProbe} />}
        </div>

        {/* Two-wallet peek demo */}
        <div className="mt-4 rounded-2xl border border-stamp-red/35 bg-mist p-4">
          <p className="text-[14px] font-medium text-stamp-red-deep">
            Two-wallet peek proof
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-steel-deep">
            Wallet A buys a peek on Live, then probes here (authorized). Switch
            to Wallet B, sign the guest book, and probe the{" "}
            <span className="font-medium text-ink">same peek PDA</span> —
            you should get no data (ACL deny / hidden), not a decoded peek.
          </p>

          {myPeek.data && (
            <p className="mt-2 font-mono text-[11px] text-steel-deep">
              Your peek (decoded): slot {myPeek.data.slot} ·{" "}
              {rarityLabel(myPeek.data.rarity)} ·{" "}
              {categoryLabel(myPeek.data.category)} — not the exact creature id
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="paper"
              size="sm"
              disabled={!publicKey || busy !== null}
              onClick={() => void runMyPeekProbe()}
            >
              {busy === "my-peek" ? "Probing…" : "A · Probe my peek"}
            </Button>
            <Button
              variant="paper"
              size="sm"
              disabled={!strangerOwner || busy !== null}
              onClick={() => void runStrangerPeekProbe()}
            >
              {busy === "stranger"
                ? "Probing…"
                : "B · Probe saved peek as this wallet"}
            </Button>
          </div>

          {strangerOwner && (
            <p className="mt-2 font-mono text-[10px] text-steel">
              Saved peek owner {shortAddr(strangerOwner)}
              {vaultPk
                ? ` · PDA ${shortAddr(peekPda(new PublicKey(vaultPk), new PublicKey(strangerOwner)).toBase58())}`
                : ""}
            </p>
          )}
          {peekProbe && <ProbeResult probe={peekProbe} />}
          <p className="mt-3 text-[11px] text-steel">
            Auth tokens never appear in explorer links. Session storage only
            keeps the peek owner pubkey for the stranger probe.
          </p>
        </div>
      </section>
    </PageEnter>
  );
}

function ProbeResult({ probe }: { probe: AccountProbe }) {
  return (
    <div className="mt-3 rounded-xl border border-line bg-paper/80 p-3">
      <p
        className={cn(
          "text-[13px] font-medium",
          toneClass(probe.outcome),
        )}
      >
        {probe.label}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-steel-deep">
        {probe.detail}
      </p>
      {probe.existenceHint && (
        <p className="mt-1 font-mono text-[10px] text-steel">
          {probe.existenceHint}
        </p>
      )}
      <p className="mt-1 font-mono text-[10px] text-steel">
        account {shortAddr(probe.account)}
        {probe.bytes !== null ? ` · ${probe.bytes}B` : ""}
      </p>
    </div>
  );
}

function toneClass(o: ProbeOutcome): string {
  switch (o) {
    case "authorized":
      return "text-accent";
    case "unauthorized_or_hidden":
      return "text-stamp-red-deep";
    case "not_found":
      return "text-steel-deep";
    case "rpc_error":
      return "text-stamp-red-deep";
    case "needs_auth":
      return "text-steel-deep";
    default: {
      const _exhaustive: never = o;
      return _exhaustive;
    }
  }
}
