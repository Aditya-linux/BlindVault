import type { PulseEnv } from "./env";

/** Known program constants mirrored from programs/pulse_call/src/lib.rs */
export const PROGRAM_SEEDS = {
  pool: "pulse_pool",
  call: "pulse_call",
} as const;

export const VRF_QUEUES = {
  /** Base-layer Devnet MagicBlock VRF queue */
  default: "Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh",
  /** Local test queue */
  test: "GKE6d7iv8kCBrsxr78W3xVdjGLLLJnxsGiuzrsZCGEvb",
  ephemeral: "5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc",
  ephemeralTest: "Sc9MJUngNbQXSXGP3F67KvKwVnhaYn6kcioxXNVowYT",
} as const;

export type CallDirection = "up" | "down";

export type CallFlowStep =
  | "idle"
  | "need_wallet"
  | "create_pending"
  | "delegate_pending"
  | "open"
  | "pulse_pending"
  | "ready_to_settle"
  | "settle_pending"
  | "settled"
  | "error";

export type CallFlowState = {
  step: CallFlowStep;
  direction: CallDirection | null;
  openPrice: string | null;
  settlePrice: string | null;
  message: string;
  signature: string | null;
  won: boolean | null;
  placeMs: number | null;
  settleMs: number | null;
  pulseSeed: number | null;
  payoutBps: number | null;
};

export function createCallFlow(): CallFlowState {
  return {
    step: "idle",
    direction: null,
    openPrice: null,
    settlePrice: null,
    message:
      "Connect a Devnet wallet to create_call → delegate → place_call → VRF pulse → settle.",
    signature: null,
    won: null,
    placeMs: null,
    settleMs: null,
    pulseSeed: null,
    payoutBps: null,
  };
}

export function beginOnchainCall(
  state: CallFlowState,
  connected: boolean,
  direction: CallDirection,
): CallFlowState {
  if (!connected) {
    return {
      ...state,
      step: "need_wallet",
      direction,
      message: "Connect a Devnet wallet for onchain Pulse Calls. Guest practice still works.",
      signature: null,
      won: null,
      placeMs: null,
      settleMs: null,
      pulseSeed: null,
      payoutBps: null,
    };
  }
  if (
    state.step === "create_pending" ||
    state.step === "delegate_pending" ||
    state.step === "settle_pending" ||
    state.step === "pulse_pending"
  ) {
    return {
      ...state,
      step: "error",
      message: "Call already in flight — wait for confirmation.",
    };
  }
  return {
    step: "create_pending",
    direction,
    openPrice: null,
    settlePrice: null,
    message: "Sign create_call / place_call on Devnet (not counted as settled until settle tx confirms).",
    signature: null,
    won: null,
    placeMs: null,
    settleMs: null,
    pulseSeed: null,
    payoutBps: null,
  };
}

export function markDelegated(state: CallFlowState): CallFlowState {
  if (state.step !== "create_pending" && state.step !== "delegate_pending") {
    return { ...state, step: "error", message: "Cannot delegate from this step." };
  }
  return {
    ...state,
    step: "delegate_pending",
    message: "Delegating Call PDA to MagicBlock ER…",
  };
}

export function markOpen(
  state: CallFlowState,
  openPrice: string,
  signature: string,
  placeMs = performance.now(),
): CallFlowState {
  return {
    ...state,
    step: "open",
    openPrice,
    signature,
    placeMs,
    message: `Call open at ${openPrice}. Waiting for duration + optional VRF pulse.`,
  };
}

export function markPulsePending(state: CallFlowState): CallFlowState {
  if (state.step !== "open") {
    return { ...state, step: "error", message: "Pulse only while call is open." };
  }
  return {
    ...state,
    step: "pulse_pending",
    message: "VRF pulse requested — payout trim is not final until consume_pulse lands.",
  };
}

export function markReadyToSettle(state: CallFlowState): CallFlowState {
  if (state.step !== "open" && state.step !== "pulse_pending") {
    return { ...state, step: "error", message: "Nothing ready to settle." };
  }
  return {
    ...state,
    step: "ready_to_settle",
    message: "Duration elapsed. Sign settle_call against the live ER oracle.",
  };
}

export function markSettlePending(state: CallFlowState): CallFlowState {
  if (state.step !== "ready_to_settle" && state.step !== "open") {
    return { ...state, step: "error", message: "Settle only after open/ready." };
  }
  return {
    ...state,
    step: "settle_pending",
    message: "Settling on ER — outcome not final until confirmation.",
  };
}

export function markSettled(
  state: CallFlowState,
  settlePrice: string,
  won: boolean,
  signature: string,
  extras?: {
    settleMs?: number;
    pulseSeed?: number | null;
    payoutBps?: number | null;
  },
): CallFlowState {
  const settleMs = extras?.settleMs ?? performance.now();
  const trip =
    state.placeMs !== null ? Math.max(0, settleMs - state.placeMs) : null;
  return {
    ...state,
    step: "settled",
    settlePrice,
    won,
    signature,
    settleMs,
    pulseSeed: extras?.pulseSeed ?? state.pulseSeed,
    payoutBps: extras?.payoutBps ?? state.payoutBps,
    message: won
      ? `Won vs settle ${settlePrice}${trip !== null ? ` · ${Math.round(trip)}ms` : ""}. Tx ${signature.slice(0, 12)}…`
      : `Lost vs settle ${settlePrice}${trip !== null ? ` · ${Math.round(trip)}ms` : ""}. Tx ${signature.slice(0, 12)}…`,
  };
}

export function oracleQueueForEnv(env: PulseEnv): string {
  return env.network === "localnet" ? VRF_QUEUES.test : VRF_QUEUES.default;
}

export function ephemeralOracleQueueForEnv(env: PulseEnv): string {
  return env.network === "localnet"
    ? VRF_QUEUES.ephemeralTest
    : VRF_QUEUES.ephemeral;
}
