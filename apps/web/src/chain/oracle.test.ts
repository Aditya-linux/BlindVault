import { describe, expect, it } from "vitest";
import { decodeOraclePrice } from "./oracle";

function buildPriceAccount(raw: bigint, exponent: number): Uint8Array {
  const data = new Uint8Array(133);
  // ephemeral oracle discriminator
  data.set([234, 161, 14, 36, 172, 239, 15, 232], 0);
  const view = new DataView(data.buffer);
  view.setBigInt64(73, raw, true);
  view.setInt32(89, exponent, true);
  view.setBigInt64(93, 1_700_000_000n, true);
  view.setBigUint64(125, 42n, true);
  return data;
}

describe("decodeOraclePrice", () => {
  it("decodes a scaled SOL/USD price", () => {
    // 148.25 with exponent -2 → raw 14825
    const price = decodeOraclePrice(buildPriceAccount(14825n, -2));
    expect(price.display).toBe("148.25");
    expect(price.slot).toBe("42");
  });

  it("rejects unknown discriminators", () => {
    const data = buildPriceAccount(1n, 0);
    data[0] = 1;
    expect(() => decodeOraclePrice(data)).toThrow(/recognized/i);
  });
});
