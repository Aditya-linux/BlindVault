import { describe, expect, it } from "vitest";
import {
  beginOnchainCall,
  createCallFlow,
  markOpen,
  markPulsePending,
  markReadyToSettle,
  markSettlePending,
  markSettled,
} from "./program";

describe("onchain call flow", () => {
  it("blocks start without wallet", () => {
    const next = beginOnchainCall(createCallFlow(), false, "up");
    expect(next.step).toBe("need_wallet");
  });

  it("does not invent a win before settle confirmation", () => {
    let state = beginOnchainCall(createCallFlow(), true, "down");
    state = markOpen(state, "140.12", "sig-open");
    expect(state.step).toBe("open");
    expect(state.won).toBeNull();
    state = markPulsePending(state);
    expect(state.message).toMatch(/not final/i);
    state = markReadyToSettle(state);
    state = markSettlePending(state);
    expect(state.won).toBeNull();
    state = markSettled(state, "139.01", true, "sig-settle");
    expect(state.step).toBe("settled");
    expect(state.won).toBe(true);
  });
});
