"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { SystemProgram } from "@solana/web3.js";
import { getProgram } from "@/lib/program";
import { faucetTicketPda, housePda } from "@/lib/pdas";
import { associatedTokenAddress } from "@/lib/ata";
import { sendSolana } from "@/lib/tx";

export function useFaucet() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);

  const claim = useCallback(async () => {
    if (!publicKey || !signTransaction) {
      setError("Connect a wallet first");
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      const program = getProgram(connection, {
        publicKey,
        signTransaction: async (tx) => signTransaction(tx),
        signAllTransactions: async (txs) =>
          Promise.all(txs.map((tx) => signTransaction(tx))),
      });
      const house = housePda();
      const houseAcct = await (program.account as any).house.fetch(house);
      const scripMint = houseAcct.scripMint as PublicKey;
      const userAta = associatedTokenAddress(scripMint, publicKey);
      const ix = await (program.methods as any)
        .faucet()
        .accounts({
          user: publicKey,
          house,
          scripMint,
          userScripAta: userAta,
          faucetTicket: faucetTicketPda(publicKey),
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .instruction();
      const result = await sendSolana(
        connection,
        { publicKey, signTransaction },
        [ix],
        { vaultId: "house", label: "faucet" },
      );
      setSig(result.sig);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return null;
    } finally {
      setBusy(false);
    }
  }, [connection, publicKey, signTransaction]);

  return { claim, busy, error, sig };
}
