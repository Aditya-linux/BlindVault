import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { TEE_RPC } from "./connections";
import { useSession } from "@/store/session";

const TEE_STORAGE_KEY = "bv_tee_auth";
const SESSION_DURATION = 1000 * 60 * 60 * 24 * 30;

type StoredTee = { token: string; expiresAt: number; pubkey: string };

type SignMessage = (m: Uint8Array) => Promise<Uint8Array>;

/**
 * Browser-safe TEE guest-book auth.
 * Avoids SDK `Buffer.from` (often broken in Next client) and passes Phantom's
 * required `utf8` display arg so signMessage doesn't throw "Unexpected error".
 */
export async function fetchTeeToken(
  pubkey: PublicKey,
  signMessage: SignMessage,
): Promise<string> {
  const challengeParams = new URLSearchParams({
    pubkey: pubkey.toBase58(),
  });
  const challengeResponse = await fetch(
    `${TEE_RPC}/auth/challenge?${challengeParams.toString()}`,
  );
  const challengeJson = (await challengeResponse.json()) as {
    challenge?: string;
    error?: string;
  };
  if (typeof challengeJson.error === "string" && challengeJson.error) {
    throw new Error(`Failed to get challenge: ${challengeJson.error}`);
  }
  const challenge = challengeJson.challenge;
  if (typeof challenge !== "string" || !challenge) {
    throw new Error("No challenge received from TEE");
  }

  const message = new TextEncoder().encode(challenge);
  const signature = await signChallengeUtf8(message, signMessage, pubkey);
  const signatureString = bs58.encode(signature);

  const authResponse = await fetch(`${TEE_RPC}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pubkey: pubkey.toBase58(),
      challenge,
      signature: signatureString,
    }),
  });
  const authJson = (await authResponse.json()) as {
    token?: string;
    expiresAt?: number;
    error?: string;
  };
  if (authResponse.status !== 200) {
    throw new Error(
      `Failed to authenticate: ${authJson.error ?? authResponse.status}`,
    );
  }
  if (typeof authJson.token !== "string" || !authJson.token) {
    throw new Error("No token received from TEE");
  }

  const token = authJson.token;
  const expiresAt = authJson.expiresAt ?? Date.now() + SESSION_DURATION;
  const pubkeyStr = pubkey.toBase58();
  useSession.getState().setTee({ token, expiresAt, pubkey: pubkeyStr });
  try {
    const payload: StoredTee = {
      token,
      expiresAt,
      pubkey: pubkeyStr,
    };
    sessionStorage.setItem(TEE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* sessionStorage unavailable */
  }
  return token;
}

/** Peek stored guest-book without prompting the wallet. */
export function peekStoredTeeToken(pubkey: PublicKey): string | null {
  try {
    const raw = sessionStorage.getItem(TEE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTee;
    if (parsed.pubkey !== pubkey.toBase58()) return null;
    if (!parsed.token || !parsed.expiresAt) return null;
    if (Date.now() > parsed.expiresAt - 60_000) return null;
    return parsed.token;
  } catch {
    return null;
  }
}

/**
 * Prefer Phantom’s utf8 signMessage only when that provider’s active key
 * matches the connected adapter pubkey — never sign with a different wallet
 * just because Phantom is injected alongside Solflare.
 */
async function signChallengeUtf8(
  message: Uint8Array,
  adapterSign: SignMessage,
  expectedPubkey: PublicKey,
): Promise<Uint8Array> {
  const expected = expectedPubkey.toBase58();

  if (typeof window !== "undefined") {
    const phantom = (
      window as unknown as {
        phantom?: {
          solana?: {
            signMessage?: Function;
            publicKey?: { toString(): string };
          };
        };
      }
    ).phantom?.solana;

    if (
      typeof phantom?.signMessage === "function" &&
      providerPubkeyMatches(phantom.publicKey, expected)
    ) {
      try {
        const result = await phantom.signMessage(message, "utf8");
        const sig = unwrapSignature(result);
        if (sig) return sig;
      } catch {
        /* try generic solana provider next */
      }
    }

    const solana = (
      window as unknown as {
        solana?: {
          signMessage?: Function;
          publicKey?: { toString(): string };
        };
      }
    ).solana;
    if (
      typeof solana?.signMessage === "function" &&
      providerPubkeyMatches(solana.publicKey, expected)
    ) {
      try {
        const result = await solana.signMessage(message, "utf8");
        const sig = unwrapSignature(result);
        if (sig) return sig;
      } catch {
        /* fall through to adapter */
      }
    }
  }

  return adapterSign(message);
}

function providerPubkeyMatches(
  providerKey: { toString(): string } | undefined,
  expected: string,
): boolean {
  if (!providerKey) return false;
  try {
    return providerKey.toString() === expected;
  } catch {
    return false;
  }
}

function unwrapSignature(result: unknown): Uint8Array | null {
  if (result instanceof Uint8Array) return result;
  if (
    result &&
    typeof result === "object" &&
    "signature" in result &&
    (result as { signature: unknown }).signature instanceof Uint8Array
  ) {
    return (result as { signature: Uint8Array }).signature;
  }
  return null;
}

export function restoreTeeToken(pubkey: PublicKey): string | null {
  try {
    const raw = sessionStorage.getItem(TEE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTee;
    const key = pubkey.toBase58();
    if (parsed.pubkey !== key) {
      // Stale session from another wallet — wipe so it can’t leak.
      clearStoredTeeToken();
      return null;
    }
    if (!parsed.token || !parsed.expiresAt) return null;
    if (Date.now() > parsed.expiresAt - 60_000) {
      clearStoredTeeToken();
      return null;
    }
    useSession.getState().setTee({
      token: parsed.token,
      expiresAt: parsed.expiresAt,
      pubkey: key,
    });
    return parsed.token;
  } catch {
    return null;
  }
}

export function clearStoredTeeToken(): void {
  try {
    sessionStorage.removeItem(TEE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  useSession.getState().clearTee();
}

export function teeTokenFresh(expiresAt: number | null): boolean {
  if (!expiresAt) return false;
  return Date.now() < expiresAt - 60_000;
}
