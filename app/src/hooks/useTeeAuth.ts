"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSession } from "@/store/session";
import {
  clearStoredTeeToken,
  fetchTeeToken,
  restoreTeeToken,
  teeTokenFresh,
} from "@/lib/teeAuth";

/** One in-flight guest-book sign — parallel ensureToken calls share it (no popup spam). */
let guestBookInflight: Promise<string | null> | null = null;

/**
 * TEE guest-book auth bound tightly to the connected wallet.
 * Clears tokens on disconnect / account switch so one wallet can’t reuse
 * another’s private session (bid/peek ACL loophole).
 */
export function useTeeAuth() {
  const { publicKey, signMessage, connected, disconnecting } = useWallet();
  const token = useSession((s) => s.token);
  const expiresAt = useSession((s) => s.expiresAt);
  const tokenPubkey = useSession((s) => s.pubkey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (disconnecting || !connected || !publicKey) {
      lastKey.current = null;
      clearStoredTeeToken();
      setError(null);
      return;
    }

    const key = publicKey.toBase58();
    if (lastKey.current && lastKey.current !== key) {
      clearStoredTeeToken();
      setError(null);
    }
    lastKey.current = key;
    restoreTeeToken(publicKey);
  }, [publicKey, connected, disconnecting]);

  const keyStr = publicKey?.toBase58() ?? null;
  const tokenBoundToWallet = Boolean(
    token &&
      teeTokenFresh(expiresAt) &&
      connected &&
      keyStr &&
      tokenPubkey === keyStr &&
      lastKey.current === keyStr,
  );

  const signGuestBook = useCallback(async () => {
    if (!connected || !publicKey) {
      setError("Connect a wallet first.");
      return null;
    }
    if (!signMessage) {
      setError(
        "This wallet can’t sign messages. Use Phantom or Solflare on Devnet.",
      );
      return null;
    }

    // Reuse in-flight sign so Place Bid + peek + closer don’t stack popups.
    if (guestBookInflight) return guestBookInflight;

    setBusy(true);
    setError(null);
    guestBookInflight = (async () => {
      try {
        // Only clear after we know we’ll re-auth — keep prior token until then.
        const t = await fetchTeeToken(publicKey, signMessage);
        lastKey.current = publicKey.toBase58();
        return t;
      } catch (e) {
        setError(formatTeeSignError(e));
        return null;
      } finally {
        guestBookInflight = null;
        setBusy(false);
      }
    })();

    return guestBookInflight;
  }, [connected, publicKey, signMessage]);

  const ensureToken = useCallback(async () => {
    if (
      token &&
      teeTokenFresh(expiresAt) &&
      publicKey &&
      tokenPubkey === publicKey.toBase58() &&
      lastKey.current === publicKey.toBase58()
    ) {
      return token;
    }
    // Prefer sessionStorage restore before prompting Phantom again.
    if (publicKey) {
      const restored = restoreTeeToken(publicKey);
      if (restored) {
        lastKey.current = publicKey.toBase58();
        return restored;
      }
    }
    return signGuestBook();
  }, [token, expiresAt, tokenPubkey, publicKey, signGuestBook]);

  return {
    token: tokenBoundToWallet ? token : null,
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
  if (lower.includes("unexpected error")) {
    return `${raw} — Hard-refresh, disconnect wallet, reconnect on Devnet, then approve the Message request (not a transaction).`;
  }
  if (
    lower.includes("user rejected") ||
    lower.includes("rejected") ||
    lower.includes("cancelled") ||
    lower.includes("canceled")
  ) {
    return `${raw} — Approve the wallet message popup to unlock private bids.`;
  }
  if (lower.includes("signmessage") || lower.includes("sign message")) {
    return `${raw} — Use Phantom or Solflare with message signing enabled.`;
  }
  return raw;
}
