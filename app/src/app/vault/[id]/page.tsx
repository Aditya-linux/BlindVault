"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "@/components/motion";
import { hintCopy } from "@/lib/hints";
import { sizeLabel, shortAddr } from "@/lib/format";
import { housePda, vaultPda } from "@/lib/pdas";
import { Countdown } from "@/components/Countdown";
import { useVaultLive } from "@/hooks/useVaultLive";
import { useHintsLive } from "@/hooks/useHintsLive";
import { useMyBid } from "@/hooks/useMyBid";
import { usePlaceBid } from "@/hooks/usePlaceBid";
import { useBuyPeek, useMyPeek } from "@/hooks/useBuyPeek";
import { useHintPublisher } from "@/hooks/useHintPublisher";
import { useTeeAuth } from "@/hooks/useTeeAuth";
import { useActiveVault } from "@/hooks/useActiveVault";
import { solanaTxUrl, teeTxUrl } from "@/lib/explorer";
import { MotionNavLink, PageEnter, soft, spring } from "@/components/motion";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export default function LiveVaultPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const house = useMemo(() => housePda(), []);
  const vaultPk = useMemo(
    () =>
      Number.isFinite(id) && id > 0 ? vaultPda(house, id).toBase58() : null,
    [house, id],
  );
  const vaultQ = useVaultLive(vaultPk, id);
  const hintsQ = useHintsLive(vaultPk, id);
  const myBid = useMyBid(vaultPk);
  const place = usePlaceBid(vaultQ.data);
  const peek = useBuyPeek(vaultQ.data);
  const myPeek = useMyPeek(vaultPk);
  const tee = useTeeAuth();
  const active = useActiveVault();
  const { connected } = useWallet();
  useHintPublisher(vaultQ.data);

  const minBid = vaultQ.data
    ? vaultQ.data.minBid / 1_000_000
    : (active.data?.minBid[0] ?? 10_000_000) / 1_000_000;
  const peekFeeScr = vaultQ.data ? vaultQ.data.peekFee / 1_000_000 : 0;
  const [amount, setAmount] = useState(10);

  useEffect(() => {
    setAmount((prev) => (prev < minBid ? minBid : prev));
  }, [minBid]);

  const lotFinished =
    vaultQ.data?.status === "Revealed" ||
    vaultQ.data?.status === "Closed" ||
    vaultQ.data?.status === "Settled" ||
    vaultQ.data?.status === "Abandoned";

  const hints = hintsQ.data?.hints ?? [];
  const released = hints.filter((h) => h.released);
  const nowTs = Math.floor(Date.now() / 1000);
  const pastDeadline =
    Boolean(vaultQ.data?.deadlineTs) &&
    vaultQ.data!.deadlineTs > 0 &&
    nowTs >= vaultQ.data!.deadlineTs;
  const statusLabel = vaultQ.isLoading
    ? "Loading"
    : vaultQ.isError
      ? "Error"
      : !vaultQ.data
        ? "Unavailable"
        : pastDeadline && vaultQ.data.status === "Open"
          ? "Ended (clock)"
          : vaultQ.data.status;

  return (
    <PageEnter>
      {lotFinished && (
        <div className="bv-card mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-[14px] text-steel-deep">
            This lot is finished — open Reveal to see the cards and winner.
          </p>
          <MotionNavLink
            href={`/vault/${params.id}/reveal`}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            Open Reveal
          </MotionNavLink>
        </div>
      )}

      <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[13px] font-medium text-steel-deep">Live arena</p>
          <h1 className="mt-1 font-display text-4xl tracking-[-0.03em] text-ink sm:text-5xl">
            Lot {params.id}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="bv-chip bv-chip-live">{statusLabel}</span>
            <span className="bv-chip">
              {vaultQ.data ? sizeLabel(vaultQ.data.size) : "—"}
            </span>
            <span className="bv-chip">
              {vaultQ.data?.bidCount ?? 0} sealed bids
            </span>
            <span className="bv-chip">
              {vaultQ.data?.peeksSold ?? 0} peeks
            </span>
            {vaultQ.isError && (
              <span className="bv-chip text-stamp-red">
                TEE read failed — retrying
              </span>
            )}
          </div>
          {pastDeadline && vaultQ.data?.status === "Open" && (
            <p className="mt-3 text-[13px] font-medium text-stamp-red-deep">
              Clock hit zero — bidding closed. Waiting for reveal…
            </p>
          )}
        </div>
        <Countdown deadlineTs={vaultQ.data?.deadlineTs ?? 0} />
      </header>

      <section className="grid gap-5 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="space-y-5">
          <article className="bv-card p-6 sm:p-7">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl tracking-[-0.02em]">Hints</h2>
              <span className="font-mono text-[11px] text-steel">
                {released.length}/4
              </span>
            </div>

            <ul className="mt-5 space-y-3">
              {released.length === 0 && (
                <li className="rounded-2xl bg-cream/80 px-4 py-3 text-[14px] text-steel-deep">
                  Nothing public yet. The TEE clock releases hints in sequence.
                </li>
              )}
              {released.map((h) => (
                <motion.li
                  key={h.kind}
                  className="rounded-2xl bg-ink px-4 py-3.5 text-[14px] leading-relaxed text-paper"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={soft}
                >
                  {hintCopy(h)}
                </motion.li>
              ))}
            </ul>

            <ul className="mt-4 space-y-2">
              {(hints.length
                ? hints
                : [0, 1, 2, 3].map((kind) => ({
                    kind,
                    a: 0,
                    b: 0,
                    released: false,
                    releasedTs: 0,
                  }))
              )
                .filter((h) => !h.released)
                .map((h) => (
                  <li
                    key={h.kind}
                    className="flex items-center justify-between rounded-2xl border border-line/80 px-4 py-3 text-[13px] text-steel-deep"
                  >
                    <span>
                      {
                        ["Value band", "Top tier", "Category mix", "Rarity floor"][
                          h.kind
                        ]
                      }
                    </span>
                    <span className="font-mono text-[11px]">
                      {vaultQ.data
                        ? `T+${Math.max(0, vaultQ.data.hintTimes[h.kind] - vaultQ.data.openTs)}s`
                        : "Soon"}
                    </span>
                  </li>
                ))}
            </ul>
          </article>

          <article className="bv-card p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-steel-deep">Activity</p>
              <MotionNavLink
                href={`/vault/${params.id}/proof`}
                className="text-[12px] font-medium text-accent"
              >
                Evidence
              </MotionNavLink>
            </div>
            <ul className="mt-3 space-y-2 text-[13px] text-steel-deep">
              <li>
                {vaultQ.data?.itemCount ?? "—"} cards sealed in the vault
                (identities private)
              </li>
              <li>
                {vaultQ.data?.bidCount ?? 0} sealed bid
                {(vaultQ.data?.bidCount ?? 0) === 1 ? "" : "s"} · amounts hidden
              </li>
              <li>
                {vaultQ.data?.peeksSold ?? 0} private peek
                {(vaultQ.data?.peeksSold ?? 0) === 1 ? "" : "s"} purchased
              </li>
              <li>
                {released.length}/4 public hints released
                {released.length > 0
                  ? ` · latest: ${hintCopy(released[released.length - 1]!)}`
                  : ""}
              </li>
              {myBid.data && (
                <li className="text-accent">Your envelope is sealed</li>
              )}
            </ul>
            <p className="mt-3 font-mono text-[10px] text-steel">
              Feed uses live vault fields only — no bidder ids or amounts.
            </p>
          </article>
        </div>

        <aside className="bv-card flex flex-col gap-5 p-6">
          <div>
            <h2 className="font-display text-2xl tracking-[-0.02em]">
              Sealed bid
            </h2>
            <p className="mt-1 text-[13px] text-steel-deep">
              One bid per wallet · amounts stay private until reveal
            </p>
            <p className="mt-1 font-mono text-[11px] text-steel">
              {connected ? "Wallet ready" : "Connect a wallet"} ·{" "}
              {tee.token ? "TEE signed" : "guest book needed"}
            </p>
          </div>

          {!tee.token && (
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
              className="rounded-2xl bg-chalk-mint px-4 py-4"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={spring}
            >
              <p className="text-[14px] font-medium text-ink">Envelope sealed</p>
              <p className="mt-1 font-mono text-[12px] text-steel-deep">
                {myBid.data.amount / 1_000_000} SCRIP · #{myBid.data.bidderIndex}
              </p>
            </motion.div>
          ) : (
            <>
              <label className="block text-[13px] font-medium text-ink">
                Amount
                <div className="mt-2 flex items-center gap-2 rounded-2xl border border-line bg-mist px-4 py-3">
                  <input
                    type="number"
                    min={minBid}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full bg-transparent font-mono text-[16px] outline-none"
                  />
                  <span className="text-[12px] text-steel-deep">SCRIP</span>
                </div>
              </label>
              <p className="font-mono text-[11px] text-steel">
                Min {minBid} · one bid per wallet
              </p>
              <Button
                size="lg"
                onClick={() => void place.placeBid(amount)}
                disabled={
                  place.busy ||
                  Boolean(myBid.data) ||
                  !connected ||
                  pastDeadline ||
                  vaultQ.data?.status !== "Open"
                }
              >
                {place.busy ? "Sealing…" : "Seal bid"}
              </Button>
            </>
          )}

          {place.error && (
            <p className="font-mono text-[12px] text-stamp-red-deep">
              {place.error}
            </p>
          )}
          {place.lastSig && (
            <a
              className="font-mono text-[11px] text-accent underline"
              href={teeTxUrl(place.lastSig)}
              target="_blank"
              rel="noreferrer"
            >
              {shortAddr(place.lastSig)}
            </a>
          )}

          <div className="hairline" />

          <div>
            <h3 className="font-display text-xl tracking-[-0.02em]">
              Private peek
            </h3>
            <p className="mt-1 text-[13px] text-steel-deep">
              {peekFeeScr} SCRIP · buyer-only TEE eyes
            </p>
          </div>

          {myPeek.data ? (
            <motion.div
              className="rounded-2xl border border-line bg-mist px-4 py-4"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={soft}
            >
              <p className="text-[14px] font-medium">
                Slot {myPeek.data.slot}
              </p>
              <p className="mt-1 font-mono text-[12px] text-steel-deep">
                {myPeek.data.rarityLabel} · {myPeek.data.categoryLabel}
              </p>
            </motion.div>
          ) : (
            <Button
              variant="teal"
              onClick={() => void peek.buyPeek()}
                disabled={
                  peek.busy ||
                  vaultQ.data?.status !== "Open" ||
                  pastDeadline ||
                  !tee.token ||
                  !connected
                }
            >
              {peek.busy ? "Peering…" : "Buy private peek"}
            </Button>
          )}
          {peek.error && (
            <p className="font-mono text-[12px] text-stamp-red-deep">
              {peek.error}
            </p>
          )}
          {peek.feeSig && (
            <a
              className="block font-mono text-[11px] text-accent underline"
              href={solanaTxUrl(peek.feeSig)}
              target="_blank"
              rel="noreferrer"
            >
              fee {shortAddr(peek.feeSig)}
            </a>
          )}
          {peek.lastSig && (
            <a
              className="block font-mono text-[11px] text-accent underline"
              href={teeTxUrl(peek.lastSig)}
              target="_blank"
              rel="noreferrer"
            >
              peek {shortAddr(peek.lastSig)}
            </a>
          )}
        </aside>
      </section>
    </PageEnter>
  );
}
