import type { CallDirection } from "../../chain/program";

/**
 * Ghost Call — direction is sealed client-side until arena lock / settle.
 * Onchain commit-hash can land later; this is the fairness UX path.
 */
export type GhostSeal = {
  sealed: true;
  direction: CallDirection;
  commitHash: string;
  sealedAtMs: number;
  revealed: boolean;
};

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sealGhostCall(
  direction: CallDirection,
  salt: string = crypto.randomUUID(),
): Promise<GhostSeal> {
  const commitHash = await sha256Hex(`${direction}:${salt}:${Date.now()}`);
  return {
    sealed: true,
    direction,
    commitHash,
    sealedAtMs: Date.now(),
    revealed: false,
  };
}

export function revealGhostCall(seal: GhostSeal): GhostSeal {
  return { ...seal, revealed: true };
}

export function shortCommit(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}
