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
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
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
