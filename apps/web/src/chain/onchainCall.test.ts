import { describe, expect, it } from "vitest";
import { decodeCallAccount, formatRawPrice } from "./onchainCall";

function buildCallAccount(overrides?: {
  status?: number;
  direction?: number;
  open?: bigint;
  settle?: bigint;
  payoutBps?: bigint;
  pulse?: number;
  won?: boolean;
}): Uint8Array {
  const data = new Uint8Array(8 + 1 + 32 + 1 + 1 + 8 + 8 + 8 + 8 + 8 + 4 + 1 + 1);
  const view = new DataView(data.buffer);
  let o = 8;
  data[o++] = 1; // schema
  o += 32; // player
  data[o++] = overrides?.status ?? 2;
  data[o++] = overrides?.direction ?? 0;
  view.setBigInt64(o, overrides?.open ?? 100n, true);
  o += 8;
  view.setBigInt64(o, overrides?.settle ?? 110n, true);
  o += 8;
  view.setBigUint64(o, 1n, true); // slot
  o += 8;
  view.setBigInt64(o, 1_700_000_000n, true);
  o += 8;
  view.setBigUint64(o, overrides?.payoutBps ?? 15_000n, true);
  o += 8;
  view.setUint32(o, overrides?.pulse ?? 42, true);
  o += 4;
  data[o] = overrides?.won ? 1 : 0;
  return data;
}

describe("decodeCallAccount", () => {
  it("reads settle fields and VRF pulse", () => {
    const call = decodeCallAccount(
      buildCallAccount({ pulse: 99, payoutBps: 12_500n, won: true }),
    );
    expect(call.pulseSeed).toBe(99);
    expect(call.payoutBps).toBe(12_500n);
    expect(call.won).toBe(true);
  });
});

describe("formatRawPrice", () => {
  it("scales i64 with exponent", () => {
    expect(formatRawPrice(14825n, -2)).toBe("148.25");
  });
});
