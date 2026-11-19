import { describe, expect, it } from "vitest";
import {
  beginTx,
  createTxState,
  markFailure,
  markSubmitted,
  markSuccess,
  resetTx,
} from "./txMachine";

describe("txMachine", () => {
  it("blocks double-submit while busy", () => {
    let s = createTxState();
    s = beginTx(s, "capture-1");
    const again = beginTx(s, "capture-2");
    expect(again.error).toMatch(/already in progress/i);
    expect(again.id).toBe("capture-1");
  });

  it("reaches success and resets", () => {
    let s = beginTx(createTxState(), "x");
    s = markSubmitted(s);
    s = markSuccess(s);
    expect(s.phase).toBe("success");
    expect(s.busy).toBe(false);
    s = resetTx();
    expect(s.phase).toBe("idle");
  });

  it("records retryable failure", () => {
    let s = beginTx(createTxState(), "y");
    s = markFailure(s, "rpc timeout", true);
    expect(s.phase).toBe("retryable");
    expect(s.busy).toBe(false);
  });
});
