"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSession } from "@/store/session";
import {
  clearStoredTeeToken,
  fetchTeeToken,
  restoreTeeToken,
  teeTokenFresh,
} from "@/lib/teeAuth";

export function useTeeAuth() {
  const { publicKey, signMessage, connected, disconnecting } = useWallet();
  const token = useSession((s) => s.token);
  const expiresAt = useSession((s) => s.expiresAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) {
      clearStoredTeeToken();
      return;
    }
    restoreTeeToken(publicKey);
  }, [publicKey]);

  useEffect(() => {
    if (disconnecting) clearStoredTeeToken();
  }, [disconnecting]);

  const signGuestBook = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setError("Connect a wallet that supports signMessage.");
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      const t = await fetchTeeToken(publicKey, signMessage);
      return t;
    } catch (e) {
      setError(formatTeeSignError(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, [publicKey, signMessage]);

  const ensureToken = useCallback(async () => {
    if (token && teeTokenFresh(expiresAt)) return token;
    return signGuestBook();
  }, [token, expiresAt, signGuestBook]);

  return {
    token: token && teeTokenFresh(expiresAt) ? token : null,
    connected,
    busy,
    error,
    signGuestBook,
    ensureToken,
    hasSignMessage: Boolean(signMessage),
  };
}

function formatTeeSignError(e: unknown): string {
  const raw =
    e instanceof Error
      ? e.message
      : typeof e === "object" && e && "message" in e
        ? String((e as { message: unknown }).message)
        : String(e);
  const lower = raw.toLowerCase();
  if (
    lower.includes("unexpected error") ||
    lower.includes("user rejected") ||
    lower.includes("rejected") ||
    lower.includes("cancelled") ||
    lower.includes("canceled")
  ) {
    return `${raw} — In Phantom: Settings → Developer Settings → enable Testnet Mode, then set network to Devnet. Approve the message popup (not a transaction).`;
  }
  if (lower.includes("signmessage") || lower.includes("sign message")) {
    return `${raw} — Use Phantom or Solflare with message signing enabled.`;
  }
  return raw;
}
