import {
  GhostIcon,
  KeyRoundIcon,
  WalletIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createChainClients } from "@/chain/clients";
import { validateEnv } from "@/chain/env";
import { FEED_ORDER, PRICE_FEEDS, type FeedId } from "@/chain/feeds";
import {
  delegateCall,
  ensureCallCreated,
  ensurePoolInitialized,
  fetchCallOnEr,
  formatRawPrice,
  getInjectedWallet,
  placeCallOnEr,
  requestPulseOnEr,
  resetCallOnEr,
  settleCallOnEr,
} from "@/chain/onchainCall";
import {
  subscribeOraclePrice,
  type OraclePrice,
} from "@/chain/oracle";
import {
  beginOnchainCall,
  createCallFlow,
  markOpen,
  markPulsePending,
  markReadyToSettle,
  markSettlePending,
  markSettled,
  type CallDirection,
  type CallFlowState,
} from "@/chain/program";
import {
  CallChainBoard,
  type ChainDuration,
} from "@/components/CallChainBoard";
import { LatencyHud } from "@/components/LatencyHud";
import { PriceChart } from "@/components/PriceChart";
import { PulseReceipt } from "@/components/PulseReceipt";
import { TradeBlotter } from "@/components/TradeBlotter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { arenaLabel, arenaRoundAt } from "@/features/pulse/arena";
import {
  revealGhostCall,
  sealGhostCall,
  shortCommit,
  type GhostSeal,
} from "@/features/pulse/ghostCall";
import {
  armGuestRound,
  createGuestRound,
  loadGuestLedger,
  openGuestRound,
  remainingMs,
  settleGuestRound,
  type GuestLedger,
  type GuestRound,
} from "@/features/pulse/guestRound";
import {
  createLatencySample,
  markPlace,
  markSettle,
  type LatencySample,
} from "@/features/pulse/latency";
import {
  appendTick,
  seriesChange,
  type ChartMarker,
  type PriceTick,
} from "@/features/pulse/priceSeries";
import {
  appendTrade,
  clearTradeHistory,
  loadTradeHistory,
  type TradeRecord,
} from "@/features/pulse/tradeHistory";
import {
  clearSession,
  loadSessionSnapshot,
  prepareLocalSession,
  type SessionSnapshot,
} from "@/features/wallet/sessionKeys";
import {
  WalletController,
  type WalletSnapshot,
} from "@/features/wallet/WalletController";
import { cn } from "@/lib/utils";

const DURATIONS = [5, 8, 15] as const satisfies readonly ChainDuration[];
const PRACTICE_PAYOUT = 1.8;
type PlayMode = "solo" | "arena";

function shortKey(key: string | null): string {
  if (!key) return "Guest";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export function App() {
  const validation = useMemo(() => validateEnv(), []);
  const wallet = useMemo(() => new WalletController(), []);
  const [walletSnap, setWalletSnap] = useState<WalletSnapshot>(() =>
    wallet.snapshot(),
  );
  const [session, setSession] = useState<SessionSnapshot>(() =>
    loadSessionSnapshot(),
  );
  const [feedId, setFeedId] = useState<FeedId>("sol");
  const [oracle, setOracle] = useState<OraclePrice | null>(null);
  const [oracleError, setOracleError] = useState<string | null>(null);
  const [series, setSeries] = useState<PriceTick[]>([]);
  const [markers, setMarkers] = useState<ChartMarker[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>(() => loadTradeHistory());
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(8);
  const [mode, setMode] = useState<PlayMode>("arena");
  const [ghostMode, setGhostMode] = useState(false);
  const [ghostSeal, setGhostSeal] = useState<GhostSeal | null>(null);
  const [guestRound, setGuestRound] = useState<GuestRound>(() =>
    createGuestRound(8),
  );
  const [ledger, setLedger] = useState<GuestLedger>(() => loadGuestLedger());
  const [callFlow, setCallFlow] = useState<CallFlowState>(() => createCallFlow());
  const [latency, setLatency] = useState<LatencySample | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [log, setLog] = useState<string[]>([
    "Pulse Call pit open — Arena, Ghost, multi-feed, Latency HUD.",
  ]);
  const guestSettleLock = useRef(false);

  const feed = PRICE_FEEDS[feedId];
  const clients = useMemo(() => {
    if (!validation.ok) return null;
    return createChainClients(validation.env);
  }, [validation]);
  const arena = useMemo(() => arenaRoundAt(now, duration), [now, duration]);

  useEffect(() => {
    setWalletSnap(wallet.detect());
  }, [wallet]);

  useEffect(() => {
    if (!validation.ok) return;
    setOracle(null);
    setSeries([]);
    setMarkers([]);
    return subscribeOraclePrice(
      validation.env,
      (price) => {
        setOracle(price);
        setOracleError(null);
        setSeries((prev) => appendTick(prev, price.display));
      },
      (error) => {
        setOracleError(
          error instanceof Error ? error.message : `Failed to read ${feed.symbol}`,
        );
      },
      feed.address,
    );
  }, [validation, feed.address, feed.symbol]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (guestRound.phase !== "live") {
      guestSettleLock.current = false;
      return;
    }
    if (remainingMs(guestRound, now) > 0) return;
    if (!oracle) return;
    if (guestSettleLock.current) return;
    guestSettleLock.current = true;
    const placedAtMs = guestRound.openedAtMs ?? now;
    const result = settleGuestRound(guestRound, oracle.display, ledger);
    setGuestRound(result.round);
    setLedger(result.ledger);
    const settlePerf = performance.now();
    setLatency((prev) =>
      markSettle(
        prev ?? createLatencySample("guest settle", "guest"),
        settlePerf,
      ),
    );
    const settlePrice = Number(result.round.settlePrice);
    if (Number.isFinite(settlePrice)) {
      setMarkers((prev) => [
        ...prev,
        {
          t: Date.now(),
          kind: "settle",
          price: settlePrice,
          direction: result.round.direction ?? undefined,
          won: result.round.won,
        },
      ]);
    }
    if (result.round.direction && result.round.openPrice !== null) {
      setTrades((prev) =>
        appendTrade(prev, {
          source: "guest",
          feedSymbol: feed.symbol,
          direction: result.round.direction!,
          openPrice: String(result.round.openPrice),
          settlePrice: String(result.round.settlePrice),
          won: result.round.won,
          tie: result.round.tie,
          placedAtMs,
          settledAtMs: Date.now(),
          latencyMs: Date.now() - placedAtMs,
          signature: null,
          ghost: Boolean(ghostSeal),
          pointsDelta: result.round.pointsDelta,
          durationSecs: result.round.durationSecs,
        }),
      );
    }
    if (ghostSeal && !ghostSeal.revealed) {
      setGhostSeal(revealGhostCall(ghostSeal));
    }
    setLog((prev) => [result.round.message, ...prev].slice(0, 12));
    toast.message(result.round.message);
  }, [guestRound, ledger, now, oracle, ghostSeal, feed.symbol]);

  function pushLog(message: string) {
    setLog((prev) => [message, ...prev].slice(0, 12));
  }

  async function startGuest(
    direction: CallDirection,
    secs: ChainDuration = duration,
  ) {
    if (secs !== duration) setDuration(secs);

    if (mode === "arena" && arena.phase !== "betting") {
      toast.error("Arena locked — wait for the next window.");
      return;
    }

    let seal: GhostSeal | null = null;
    if (ghostMode) {
      seal = await sealGhostCall(direction);
      setGhostSeal(seal);
      pushLog(`Ghost sealed ${shortCommit(seal.commitHash)}`);
    } else {
      setGhostSeal(null);
    }

    const roundDuration =
      mode === "arena"
        ? Math.max(1, Math.ceil(arena.remainingMs / 1000))
        : secs;
    const armed = armGuestRound(direction, roundDuration);
    if (!oracle) {
      setGuestRound({
        ...armed,
        message: "Waiting for live ER oracle before opening.",
      });
      toast.error("No oracle price yet.");
      return;
    }
    const opened = openGuestRound(armed, oracle.display);
    setGuestRound(opened);
    const openPrice = Number(oracle.display);
    if (Number.isFinite(openPrice)) {
      setMarkers((prev) => [
        ...prev,
        {
          t: Date.now(),
          kind: "open",
          price: openPrice,
          direction,
        },
      ]);
    }
    setLatency(
      markPlace(
        createLatencySample(
          mode === "arena" ? `arena #${arena.roundId}` : "solo guest",
          "guest",
        ),
        performance.now(),
      ),
    );
    pushLog(opened.message);
  }

  async function runOnchain(direction: CallDirection) {
    if (!validation.ok) return;
    const connected = walletSnap.status === "connected";
    let flow = beginOnchainCall(callFlow, connected, direction);
    setCallFlow(flow);
    pushLog(flow.message);
    if (flow.step === "need_wallet") {
      toast.error(flow.message);
      return;
    }

    const signer = getInjectedWallet();
    if (!signer) {
      toast.error("Wallet provider missing signTransaction.");
      return;
    }

    setBusy("onchain");
    const env = {
      ...validation.env,
      priceFeedId: feed.address,
    };
    const placeStarted = performance.now();
    setLatency(markPlace(createLatencySample("ER place→settle", "er"), placeStarted));

    try {
      const pool = await ensurePoolInitialized(env, signer);
      if ("signature" in pool) {
        pushLog(`initialize_pool ${pool.signature.slice(0, 12)}…`);
      } else {
        pushLog(pool.reason);
      }

      const created = await ensureCallCreated(env, signer);
      if ("signature" in created) {
        pushLog(`create_call ${created.signature.slice(0, 12)}…`);
      } else {
        pushLog(created.reason);
      }

      try {
        const delegated = await delegateCall(env, signer);
        pushLog(
          `delegate ${delegated.signature.slice(0, 12)}… (${Math.round(delegated.sendMs)}ms)`,
        );
      } catch (delegateErr) {
        pushLog(
          `delegate deferred: ${delegateErr instanceof Error ? delegateErr.message : String(delegateErr)}`,
        );
      }

      const placed = await placeCallOnEr(env, signer, direction, duration);
      const openDisplay = oracle?.display ?? "oracle";
      flow = markOpen(flow, openDisplay, placed.signature, placeStarted);
      setCallFlow(flow);
      const openNum = Number(openDisplay);
      if (Number.isFinite(openNum)) {
        setMarkers((prev) => [
          ...prev,
          { t: Date.now(), kind: "open", price: openNum, direction },
        ]);
      }
      toast.success(`place_call in ${Math.round(placed.sendMs)}ms`);

      try {
        flow = markPulsePending(flow);
        setCallFlow(flow);
        const pulse = await requestPulseOnEr(env, signer);
        pushLog(`request_pulse ${pulse.signature.slice(0, 12)}…`);
      } catch (pulseErr) {
        pushLog(
          `VRF pulse skipped: ${pulseErr instanceof Error ? pulseErr.message : String(pulseErr)}`,
        );
      }

      await new Promise((r) => window.setTimeout(r, duration * 1000));
      flow = markReadyToSettle(flow);
      flow = markSettlePending(flow);
      setCallFlow(flow);

      const settled = await settleCallOnEr(env, signer);
      const settleAt = performance.now();
      setLatency((prev) =>
        markSettle(prev ?? createLatencySample("ER place→settle", "er"), settleAt),
      );

      const account = await fetchCallOnEr(env, signer.publicKey);
      const settlePrice = account
        ? formatRawPrice(account.settlePrice, oracle?.exponent ?? -8)
        : oracle?.display ?? "—";
      const won = account?.won ?? false;
      flow = markSettled(flow, settlePrice, won, settled.signature, {
        settleMs: settleAt,
        pulseSeed: account?.pulseSeed ?? null,
        payoutBps: account ? Number(account.payoutBps) : null,
      });
      setCallFlow(flow);
      const settleNum = Number(settlePrice);
      if (Number.isFinite(settleNum)) {
        setMarkers((prev) => [
          ...prev,
          {
            t: Date.now(),
            kind: "settle",
            price: settleNum,
            direction,
            won,
          },
        ]);
      }
      setTrades((prev) =>
        appendTrade(prev, {
          source: "onchain",
          feedSymbol: feed.symbol,
          direction,
          openPrice: openDisplay,
          settlePrice,
          won,
          tie: false,
          placedAtMs: Date.now() - duration * 1000,
          settledAtMs: Date.now(),
          latencyMs: settleAt - placeStarted,
          signature: settled.signature,
          ghost: false,
          pointsDelta: null,
          durationSecs: duration,
        }),
      );
      toast.success(flow.message);

      try {
        await resetCallOnEr(env, signer);
      } catch {
        // optional
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCallFlow({ ...flow, step: "error", message: `Onchain failed (honest): ${message}` });
      toast.error(message);
      pushLog(`Onchain failed (honest): ${message}`);
    } finally {
      setBusy(null);
    }
  }

  const leftMs = remainingMs(guestRound, now);
  const guestBusy = guestRound.phase === "live" || busy !== null;
  const arenaProgress =
    mode === "arena"
      ? Math.max(0, Math.min(100, (1 - arena.remainingMs / (duration * 1000)) * 100))
      : 0;
  const spotDelta = seriesChange(series);
  const chainDisabled =
    guestBusy || (mode === "arena" && arena.phase !== "betting");

  if (!validation.ok) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg items-center p-6">
        <Alert variant="destructive">
          <AlertTitle>Environment invalid</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 flex flex-col gap-1">
              {validation.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-3 p-3 pb-12 sm:gap-4 sm:p-5 md:p-6">
      <header className="sticky top-0 z-20 -mx-3 flex items-center justify-between gap-3 border-b border-border/50 bg-background/85 px-3 py-2.5 backdrop-blur-md sm:-mx-5 sm:px-5 md:-mx-6 md:px-6">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="flex flex-col gap-0.5">
            <h1 className="font-display text-xl leading-none tracking-tight sm:text-2xl">
              Pulse Call
            </h1>
            <p className="text-muted-foreground text-[10px] font-medium tracking-[0.12em] uppercase sm:text-[11px]">
              Live ER pit · Devnet
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Badge variant="outline" className="font-mono text-[10px] sm:text-xs">
            {shortKey(walletSnap.publicKey)}
          </Badge>
          {walletSnap.status === "connected" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWalletSnap(wallet.disconnect())}
            >
              Disconnect
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() =>
                void wallet.connect().then((snap) => {
                  setWalletSnap(snap);
                  toast.message(snap.message);
                })
              }
            >
              <WalletIcon data-icon="inline-start" />
              Connect
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          value={feedId}
          onValueChange={(value) => setFeedId(value as FeedId)}
          className="w-full sm:w-auto"
        >
          <TabsList className="w-full sm:w-auto">
            {FEED_ORDER.map((id) => (
              <TabsTrigger
                key={id}
                value={id}
                disabled={guestBusy}
                className="flex-1 font-mono sm:flex-none"
              >
                {PRICE_FEEDS[id].symbol.split("/")[0]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <ToggleGroup
            value={[mode]}
            onValueChange={(values) => {
              const next = values[0] as PlayMode | undefined;
              if (next) setMode(next);
            }}
            variant="outline"
            disabled={guestBusy}
          >
            <ToggleGroupItem value="arena">Arena</ToggleGroupItem>
            <ToggleGroupItem value="solo">Solo</ToggleGroupItem>
          </ToggleGroup>
          <Button
            variant={ghostMode ? "default" : "outline"}
            size="sm"
            disabled={guestBusy}
            onClick={() => setGhostMode((v) => !v)}
          >
            <GhostIcon data-icon="inline-start" />
            Ghost
          </Button>
        </div>
      </div>

      {mode === "arena" ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-card/60 px-3 py-2">
          <div className="flex items-center justify-between gap-2 font-mono text-xs sm:text-sm">
            <span>{arenaLabel(arena)}</span>
            <span className="text-muted-foreground tabular-nums">
              {(arena.remainingMs / 1000).toFixed(1)}s
            </span>
          </div>
          <div className="bg-muted h-1 overflow-hidden rounded-full">
            <div
              className={cn(
                "h-full rounded-full bg-accent transition-[width]",
                arena.phase === "locked" && "bg-destructive",
              )}
              style={{ width: `${arenaProgress}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start">
        <div className="flex flex-col gap-3">
          <PriceChart
            symbol={feed.symbol}
            price={oracle}
            error={oracleError}
            series={series}
            markers={markers}
          />
          <LatencyHud sample={latency} />
        </div>

        <div className="flex flex-col gap-3">
          <CallChainBoard
            symbol={feed.symbol}
            spot={oracle?.display ?? null}
            spotChangeAbs={spotDelta?.abs ?? null}
            spotChangePct={spotDelta?.pct ?? null}
            durations={DURATIONS}
            selected={duration}
            onSelectDuration={setDuration}
            onCall={(direction, secs) => void startGuest(direction, secs)}
            disabled={chainDisabled}
            trades={trades}
            liveDirection={
              guestRound.phase === "live" ? guestRound.direction : null
            }
            liveLeftSec={
              guestRound.phase === "live" ? leftMs / 1000 : null
            }
            payoutMult={PRACTICE_PAYOUT}
          />

          <div className="rounded-lg border border-border/60 bg-card/60 px-3 py-2.5 font-mono text-xs sm:text-sm">
            {guestRound.phase === "live" ? (
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <strong className="text-accent">
                  {ghostMode && ghostSeal && !ghostSeal.revealed
                    ? "GHOST LIVE"
                    : `${guestRound.direction?.toUpperCase()} live`}
                </strong>
                <span className="tabular-nums">{(leftMs / 1000).toFixed(1)}s</span>
                <span>open ${guestRound.openPrice}</span>
              </div>
            ) : guestRound.phase === "settled" ? (
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <strong
                  className={
                    guestRound.tie
                      ? ""
                      : guestRound.won
                        ? "text-up"
                        : "text-down"
                  }
                >
                  {guestRound.tie ? "Tie" : guestRound.won ? "Win" : "Loss"}
                </strong>
                <span className="tabular-nums">
                  {guestRound.openPrice} → {guestRound.settlePrice}
                </span>
                <span className="tabular-nums">
                  {guestRound.pointsDelta >= 0 ? "+" : ""}
                  {guestRound.pointsDelta} pts
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">{guestRound.message}</span>
            )}
            <div className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
              <span>pts {ledger.points}</span>
              <span>
                W{ledger.wins} / L{ledger.losses} / T{ledger.ties}
              </span>
              <span>streak {ledger.streak}</span>
            </div>
          </div>
        </div>
      </div>

      <PulseReceipt
        mode="guest"
        openPrice={
          guestRound.openPrice !== null ? String(guestRound.openPrice) : null
        }
        settlePrice={
          guestRound.settlePrice !== null
            ? String(guestRound.settlePrice)
            : null
        }
        won={guestRound.won}
        tie={guestRound.tie}
        payoutBps={null}
        pulseSeed={null}
        signature={null}
        ghostCommit={
          ghostSeal
            ? `${shortCommit(ghostSeal.commitHash)}${
                ghostSeal.revealed
                  ? ` → ${ghostSeal.direction.toUpperCase()}`
                  : " (sealed)"
              }`
            : null
        }
      />

      <section className="rounded-lg border border-border/80 bg-card/80 p-3 backdrop-blur-sm sm:p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base tracking-tight sm:text-lg">
            Onchain path
          </h2>
          <Badge variant="outline" className="font-mono text-[10px]">
            Devnet only
          </Badge>
        </div>
        <p className="text-muted-foreground mb-3 text-[11px] sm:text-xs">
          Real place → VRF pulse → settle on MagicBlock ER. Never mocked as
          proof.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-up/40 text-up hover:bg-up/10"
            disabled={busy !== null}
            onClick={() => void runOnchain("up")}
          >
            Onchain UP
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-down/40 text-down hover:bg-down/10"
            disabled={busy !== null}
            onClick={() => void runOnchain("down")}
          >
            Onchain DOWN
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              void prepareLocalSession().then((snap) => {
                setSession(snap);
                toast.message(snap.message);
              })
            }
          >
            <KeyRoundIcon data-icon="inline-start" />
            Session
          </Button>
          {session.status === "active" || session.status === "ready" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSession(clearSession());
                toast.message("Session cleared");
              }}
            >
              Clear session
            </Button>
          ) : null}
        </div>
        <p className="text-muted-foreground mt-2 text-xs">{callFlow.message}</p>
        <p className="text-muted-foreground text-[11px]">{session.message}</p>
        <Separator className="my-3" />
        <PulseReceipt
          mode="onchain"
          openPrice={callFlow.openPrice}
          settlePrice={callFlow.settlePrice}
          won={callFlow.won}
          payoutBps={callFlow.payoutBps}
          pulseSeed={callFlow.pulseSeed}
          signature={callFlow.signature}
        />
      </section>

      <TradeBlotter
        trades={trades}
        onClear={() => {
          setTrades(clearTradeHistory());
          toast.message("Trade blotter cleared");
        }}
      />

      <aside className="text-muted-foreground flex flex-col gap-1.5 px-0.5 font-mono text-[11px] sm:text-xs">
        <p>{clients?.er.describeCallRoute()}</p>
        <p>{walletSnap.message}</p>
        <ul className="flex flex-col gap-0.5 border-l border-border/50 pl-3">
          {log.map((entry) => (
            <li key={entry} className="truncate">
              {entry}
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}
