import { beforeEach, describe, expect, it } from "vitest";
import {
  armGuestRound,
  loadGuestLedger,
  openGuestRound,
  settleGuestRound,
} from "./guestRound";

describe("guestRound", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not invent a settle without a live oracle price", () => {
    let round = armGuestRound("up", 5);
    round = openGuestRound(round, "100.5", 1_000);
    const { round: next } = settleGuestRound(round, "not-a-price", loadGuestLedger());
    expect(next.phase).toBe("live");
    expect(next.message).toMatch(/not inventing/i);
  });

  it("awards practice points on a clear win", () => {
    let round = armGuestRound("up", 5);
    round = openGuestRound(round, "100", 1_000);
    const { round: settled, ledger } = settleGuestRound(
      round,
      "101",
      loadGuestLedger(),
    );
    expect(settled.phase).toBe("settled");
    expect(settled.won).toBe(true);
    expect(ledger.wins).toBe(1);
    expect(ledger.points).toBeGreaterThan(100);
  });

  it("marks ties without changing points", () => {
    let round = armGuestRound("down", 5);
    round = openGuestRound(round, "88.2", 1_000);
    const start = loadGuestLedger();
    const { round: settled, ledger } = settleGuestRound(round, "88.2", start);
    expect(settled.tie).toBe(true);
    expect(ledger.points).toBe(start.points);
    expect(ledger.ties).toBe(1);
  });
});
