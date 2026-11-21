"use client";

import { useQuery } from "@tanstack/react-query";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { associatedTokenAddress } from "@/lib/ata";
import { useActiveVault } from "@/hooks/useActiveVault";
import { SOLANA_RPC } from "@/lib/connections";

export type PaddleBalances = {
  solLamports: number;
  scripRaw: number;
  scripUi: number;
  /** App RPC is Devnet; wallet must match or txs fail. */
  rpcIsDevnet: boolean;
};

export function usePaddleBalances() {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const house = useActiveVault();
  const scripMint = house.data?.scripMint ?? null;

  const q = useQuery({
    queryKey: [
      "paddle-balances",
      publicKey?.toBase58() ?? null,
      scripMint?.toBase58() ?? null,
    ],
    enabled: Boolean(connected && publicKey),
    refetchInterval: 8_000,
    queryFn: async (): Promise<PaddleBalances> => {
      if (!publicKey) {
        return {
          solLamports: 0,
          scripRaw: 0,
          scripUi: 0,
          rpcIsDevnet: isDevnetRpc(SOLANA_RPC),
        };
      }
      const solLamports = await connection.getBalance(publicKey, "confirmed");
      let scripRaw = 0;
      if (scripMint) {
        const ata = associatedTokenAddress(scripMint, publicKey);
        try {
          const bal = await connection.getTokenAccountBalance(ata);
          scripRaw = Number(bal.value.amount);
        } catch {
          scripRaw = 0;
        }
      }
      return {
        solLamports,
        scripRaw,
        scripUi: scripRaw / 1_000_000,
        rpcIsDevnet: isDevnetRpc(SOLANA_RPC),
      };
    },
  });

  return {
    ...q,
    connected,
    publicKey: publicKey as PublicKey | null,
    scripMint,
  };
}

function isDevnetRpc(url: string): boolean {
  const u = url.toLowerCase();
  return u.includes("devnet") || u.includes("127.0.0.1") || u.includes("localhost");
}
