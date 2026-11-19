import { beforeEach, describe, expect, it } from "vitest";
import {
  appendTrade,
  clearTradeHistory,
  loadTradeHistory,
  tradeStats,
} from "./tradeHistory";

describe("tradeHistory", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists guest and onchain fills", () => {
    let rows = loadTradeHistory();
    rows = appendTrade(rows, {
      source: "guest",
      feedSymbol: "SOL/USD",
      direction: "up",
      openPrice: "100",
      settlePrice: "101",
      won: true,
      tie: false,
      placedAtMs: 1,
      settledAtMs: 2,
      latencyMs: 800,
      signature: null,
      ghost: false,
      pointsDelta: 18,
    });
    rows = appendTrade(rows, {
      source: "onchain",
      feedSymbol: "BTC/USD",
      direction: "down",
      openPrice: "90",
      settlePrice: "89",
      won: true,
      tie: false,
      placedAtMs: 3,
      settledAtMs: 4,
      latencyMs: 120,
      signature: "sig123",
      ghost: true,
      pointsDelta: null,
    });
    expect(loadTradeHistory()).toHaveLength(2);
    expect(tradeStats(rows).wins).toBe(2);
    expect(tradeStats(rows).onchain).toBe(1);
    expect(clearTradeHistory()).toEqual([]);
  });
});
