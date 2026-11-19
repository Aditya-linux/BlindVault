import { describe, expect, it } from "vitest";
import { arenaLabel, arenaRoundAt } from "./arena";

describe("arenaRoundAt", () => {
  it("aligns round ids to wall-clock buckets", () => {
    const a = arenaRoundAt(16_000, 8);
    const b = arenaRoundAt(23_999, 8);
    expect(a.roundId).toBe(2);
    expect(b.roundId).toBe(2);
    expect(a.opensAtMs).toBe(16_000);
    expect(a.settlesAtMs).toBe(24_000);
  });

  it("locks near the end of the window", () => {
    const round = arenaRoundAt(22_500, 8);
    expect(round.phase).toBe("locked");
    expect(arenaLabel(round)).toMatch(/locked/i);
  });
});
