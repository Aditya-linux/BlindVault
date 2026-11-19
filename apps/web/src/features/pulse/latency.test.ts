import { describe, expect, it } from "vitest";
import {
  createLatencySample,
  formatLatency,
  markPlace,
  markSettle,
} from "./latency";

describe("latency sample", () => {
  it("computes place→settle round trip", () => {
    let s = createLatencySample("guest", "guest");
    s = markPlace(s, 1000);
    s = markSettle(s, 1450);
    expect(s.roundTripMs).toBe(450);
    expect(formatLatency(s.roundTripMs)).toBe("450ms");
  });
});
