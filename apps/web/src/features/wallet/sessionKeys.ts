/**
 * Session-key scaffold for popup-free Arena spam.
 * Stores only an ephemeral public key + expiry — never the authority seed in logs.
 * Full createSessionV2 wiring lands after Devnet deploy + session program accounts.
 */

export type SessionSnapshot = {
  status: "idle" | "ready" | "active" | "expired" | "unavailable";
  publicKey: string | null;
  expiresAtMs: number | null;
  message: string;
};

const STORAGE_KEY = "pulse.call.session.v1";

type StoredSession = {
  publicKey: string;
  secretKey: number[];
  expiresAtMs: number;
};

export function loadSessionSnapshot(now = Date.now()): SessionSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        status: "idle",
        publicKey: null,
        expiresAtMs: null,
        message: "No session — connect wallet, then create a scoped session once.",
      };
    }
    const stored = JSON.parse(raw) as StoredSession;
    if (!stored.publicKey || !stored.expiresAtMs) {
      localStorage.removeItem(STORAGE_KEY);
      return {
        status: "idle",
        publicKey: null,
        expiresAtMs: null,
        message: "Session cleared (malformed).",
      };
    }
    if (stored.expiresAtMs <= now) {
      localStorage.removeItem(STORAGE_KEY);
      return {
        status: "expired",
        publicKey: null,
        expiresAtMs: null,
        message: "Session expired — create a new one for popup-free calls.",
      };
    }
    return {
      status: "active",
      publicKey: stored.publicKey,
      expiresAtMs: stored.expiresAtMs,
      message: `Session active until ${new Date(stored.expiresAtMs).toLocaleTimeString()}.`,
    };
  } catch {
    return {
      status: "unavailable",
      publicKey: null,
      expiresAtMs: null,
      message: "Session storage unavailable.",
    };
  }
}

/** Local ephemeral keypair for future session signing — not an onchain session yet. */
export async function prepareLocalSession(
  ttlMinutes = 60,
): Promise<SessionSnapshot> {
  const { Keypair } = await import("@solana/web3.js");
  const kp = Keypair.generate();
  const expiresAtMs = Date.now() + ttlMinutes * 60_000;
  const stored: StoredSession = {
    publicKey: kp.publicKey.toBase58(),
    secretKey: Array.from(kp.secretKey),
    expiresAtMs,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  return {
    status: "ready",
    publicKey: stored.publicKey,
    expiresAtMs,
    message:
      "Local session key prepared. Onchain createSessionV2 still required after deploy — not counted as authorized yet.",
  };
}

export function clearSession(): SessionSnapshot {
  localStorage.removeItem(STORAGE_KEY);
  return {
    status: "idle",
    publicKey: null,
    expiresAtMs: null,
    message: "Session cleared.",
  };
}
