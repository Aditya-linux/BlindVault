import { describe, expect, it } from "vitest";
import { revealGhostCall, sealGhostCall, shortCommit } from "./ghostCall";

describe("ghostCall", () => {
  it("seals a direction behind a commit hash", async () => {
    const seal = await sealGhostCall("up", "salt-1");
    expect(seal.direction).toBe("up");
    expect(seal.revealed).toBe(false);
    expect(seal.commitHash.length).toBe(64);
    expect(shortCommit(seal.commitHash)).toMatch(/…/);
  });

  it("reveals without changing the commit", async () => {
    const seal = await sealGhostCall("down");
    const revealed = revealGhostCall(seal);
    expect(revealed.revealed).toBe(true);
    expect(revealed.commitHash).toBe(seal.commitHash);
  });
});
