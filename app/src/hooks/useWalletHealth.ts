"use client";

import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { usePaddleBalances } from "@/hooks/usePaddleBalances";
import { SOLANA_RPC } from "@/lib/connections";

/** Known Solana Devnet genesis hash — wallet txs must hit this network. */
export const DEVNET_GENESIS =
  "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWdtNHvccc";

const MIN_SOL_LAMPORTS = 5_000_000; // ~0.005 SOL

export type WalletHealth = {
  connected: boolean;
  connecting: boolean;
  address: string | null;
  walletName: string | null;
  canSignTx: boolean;
  canSignMessage: boolean;
  /** App RPC genesis matches Devnet. */
  rpcIsDevnet: boolean;
  /** Live genesis from connection (null while loading). */
  genesisOk: boolean | null;
  solLamports: number;
  solOk: boolean;
  warnings: string[];
  readyForTx: boolean;
};

/**
 * Deep wallet readiness check — connection, signing, Devnet, fee SOL.
 * Used to block confusing failed txs when the wallet is on the wrong cluster.
 */
export function useWalletHealth(): WalletHealth {
  const { connection } = useConnection();
  const {
    connected,
    connecting,
    publicKey,
    wallet,
    signTransaction,
    signMessage,
  } = useWallet();
  const bal = usePaddleBalances();

  const genesisQ = useQuery({
    queryKey: ["rpc-genesis", SOLANA_RPC],
    queryFn: async () => connection.getGenesisHash(),
    staleTime: 60_000,
    retry: 2,
  });

  return useMemo(() => {
    const rpcIsDevnet = isDevnetRpc(SOLANA_RPC);
    const genesis = genesisQ.data ?? null;
    const genesisOk =
      genesis == null ? null : genesis === DEVNET_GENESIS || rpcIsDevnet;
    const solLamports = bal.data?.solLamports ?? 0;
    const solOk = solLamports >= MIN_SOL_LAMPORTS;
    const canSignTx = Boolean(signTransaction);
    const canSignMessage = Boolean(signMessage);
    const warnings: string[] = [];

    if (connected && publicKey) {
      if (genesisOk === false) {
        warnings.push(
          "This app talks to Solana Devnet, but the RPC doesn’t look like Devnet. Refresh or check NEXT_PUBLIC_SOLANA_RPC.",
        );
      }
      if (!canSignTx) {
        warnings.push(
          "This wallet can’t sign transactions. Try Phantom or Solflare.",
        );
      }
      if (!canSignMessage) {
        warnings.push(
          "This wallet can’t sign messages (needed for private bids). Try Phantom or Solflare.",
        );
      }
      if (!solOk && !bal.isLoading) {
        warnings.push(
          "Need a little free Devnet SOL for fees. Switch the wallet to Devnet, then use faucet.solana.com.",
        );
      }
      if (solOk === false && solLamports === 0 && !bal.isLoading) {
        warnings.push(
          "Balance is 0 on Devnet — your wallet may still be on Mainnet. In Phantom: Settings → Developer Settings → Testnet Mode / Devnet.",
        );
      }
    }

    const readyForTx =
      connected &&
      Boolean(publicKey) &&
      canSignTx &&
      genesisOk !== false &&
      solOk;

    return {
      connected,
      connecting,
      address: publicKey?.toBase58() ?? null,
      walletName: wallet?.adapter?.name ?? null,
      canSignTx,
      canSignMessage,
      rpcIsDevnet,
      genesisOk,
      solLamports,
      solOk,
      warnings: dedupe(warnings),
      readyForTx,
    };
  }, [
    connected,
    connecting,
    publicKey,
    wallet,
    signTransaction,
    signMessage,
    bal.data?.solLamports,
    bal.isLoading,
    genesisQ.data,
  ]);
}

function isDevnetRpc(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes("devnet") ||
    u.includes("127.0.0.1") ||
    u.includes("localhost")
  );
}

function dedupe(list: string[]): string[] {
  return [...new Set(list)];
}
