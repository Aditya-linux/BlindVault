"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { WalletAdapterNetwork, WalletError } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { SOLANA_RPC } from "@/lib/connections";
import { clearStoredTeeToken } from "@/lib/teeAuth";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 1_500, refetchOnWindowFocus: false },
        },
      }),
  );

  // Explicit Devnet for adapters that honor network (Solflare).
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network: WalletAdapterNetwork.Devnet }),
    ],
    [],
  );

  const onError = useCallback((error: WalletError) => {
    // User rejects are normal — don't spam. Clear TEE if the session died.
    const msg = error?.message?.toLowerCase?.() ?? "";
    if (
      msg.includes("user rejected") ||
      msg.includes("rejected") ||
      msg.includes("cancelled") ||
      msg.includes("canceled")
    ) {
      return;
    }
    if (
      msg.includes("disconnected") ||
      msg.includes("wallet not connected") ||
      msg.includes("not connected")
    ) {
      clearStoredTeeToken();
    }
    console.warn("[wallet]", error.name, error.message);
  }, []);

  return (
    <ConnectionProvider endpoint={SOLANA_RPC}>
      <WalletProvider
        wallets={wallets}
        autoConnect
        onError={onError}
        localStorageKey="bv_wallet"
      >
        <WalletModalProvider>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
