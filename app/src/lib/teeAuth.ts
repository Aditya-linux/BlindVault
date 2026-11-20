import { PublicKey } from "@solana/web3.js";
import { getAuthToken } from "@magicblock-labs/ephemeral-rollups-sdk";
import { TEE_RPC } from "./connections";
import { useSession } from "@/store/session";

const TEE_STORAGE_KEY = "bv_tee_auth";

type StoredTee = { token: string; expiresAt: number; pubkey: string };

export async function fetchTeeToken(
  pubkey: PublicKey,
  signMessage: (m: Uint8Array) => Promise<Uint8Array>,
): Promise<string> {
  const { token, expiresAt } = await getAuthToken(
    TEE_RPC,
    pubkey,
    signMessage,
  );
  useSession.getState().setTee({ token, expiresAt });
  try {
    const payload: StoredTee = {
      token,
      expiresAt,
      pubkey: pubkey.toBase58(),
    };
    sessionStorage.setItem(TEE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* sessionStorage unavailable */
  }
  return token;
}

export function restoreTeeToken(pubkey: PublicKey): string | null {
  try {
    const raw = sessionStorage.getItem(TEE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredTee;
    if (parsed.pubkey !== pubkey.toBase58()) return null;
    if (!parsed.token || !parsed.expiresAt) return null;
    if (Date.now() > parsed.expiresAt - 60_000) return null;
    useSession.getState().setTee({
      token: parsed.token,
      expiresAt: parsed.expiresAt,
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
