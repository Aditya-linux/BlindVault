export type TxPhase =
  | "idle"
  | "awaiting_signature"
  | "submitted"
  | "confirming"
  | "success"
  | "failure"
  | "retryable";

export type TxState = {
  phase: TxPhase;
  id: string | null;
  error: string | null;
  /** Prevents double-submit for the same logical action. */
  busy: boolean;
};

export function createTxState(): TxState {
  return { phase: "idle", id: null, error: null, busy: false };
}

export function beginTx(state: TxState, id: string): TxState {
  if (state.busy) {
    return { ...state, error: "Another action is already in progress." };
  }
  return {
    phase: "awaiting_signature",
    id,
    error: null,
    busy: true,
  };
}

export function markSubmitted(state: TxState): TxState {
  if (!state.busy || state.phase !== "awaiting_signature") {
    return { ...state, error: "Invalid tx transition to submitted." };
  }
  return { ...state, phase: "submitted" };
}

export function markConfirming(state: TxState): TxState {
  if (!state.busy || (state.phase !== "submitted" && state.phase !== "confirming")) {
    return { ...state, error: "Invalid tx transition to confirming." };
  }
  return { ...state, phase: "confirming" };
}

export function markSuccess(state: TxState): TxState {
  return { phase: "success", id: state.id, error: null, busy: false };
}

export function markFailure(state: TxState, error: string, retryable = false): TxState {
  return {
    phase: retryable ? "retryable" : "failure",
    id: state.id,
    error,
    busy: false,
  };
}

export function resetTx(): TxState {
  return createTxState();
}
