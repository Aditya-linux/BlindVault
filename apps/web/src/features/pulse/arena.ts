/** Shared wall-clock Arena rounds — same open window for every client. */

export type ArenaPhase = "betting" | "locked" | "settling";

export type ArenaRound = {
  /** Floor(unix / duration) — identical across clients for the same clock. */
  roundId: number;
  durationSecs: number;
  phase: ArenaPhase;
  opensAtMs: number;
  locksAtMs: number;
  settlesAtMs: number;
  remainingMs: number;
};

const DEFAULT_ARENA_SECS = 8;
/** Last portion of the window is locked (no new calls). */
const LOCK_RATIO = 0.25;

export function arenaRoundAt(
  nowMs = Date.now(),
  durationSecs = DEFAULT_ARENA_SECS,
): ArenaRound {
  const durationMs = durationSecs * 1000;
  const roundId = Math.floor(nowMs / durationMs);
  const opensAtMs = roundId * durationMs;
  const settlesAtMs = opensAtMs + durationMs;
  const locksAtMs = settlesAtMs - Math.floor(durationMs * LOCK_RATIO);
  const remainingMs = Math.max(0, settlesAtMs - nowMs);

  let phase: ArenaPhase = "betting";
  if (nowMs >= locksAtMs && nowMs < settlesAtMs) phase = "locked";
  if (nowMs >= settlesAtMs) phase = "settling";

  return {
    roundId,
    durationSecs,
    phase,
    opensAtMs,
    locksAtMs,
    settlesAtMs,
    remainingMs,
  };
}

export function arenaLabel(round: ArenaRound): string {
  const left = (round.remainingMs / 1000).toFixed(1);
  switch (round.phase) {
    case "betting":
      return `Arena #${round.roundId} · betting · ${left}s`;
    case "locked":
      return `Arena #${round.roundId} · locked · settle in ${left}s`;
    case "settling":
      return `Arena #${round.roundId} · settling…`;
    default: {
      const _exhaustive: never = round.phase;
      return _exhaustive;
    }
  }
}
