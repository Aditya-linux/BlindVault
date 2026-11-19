import { describe, expect, it } from "vitest";
import { validateEnv } from "./env";

describe("validateEnv", () => {
  it("accepts Devnet or localnet public endpoints", () => {
    const result = validateEnv();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(["devnet", "localnet"]).toContain(result.env.network);
      expect(result.env.solanaRpcUrl).toContain("http");
      expect(result.env.magicblockErRpcUrl).toContain("http");
      expect(result.env.programId.length).toBeGreaterThan(30);
    }
  });
});

