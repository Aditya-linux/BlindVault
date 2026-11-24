"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  delegateSpl,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { BN } from "@coral-xyz/anchor";
import { useQueryClient } from "@tanstack/react-query";
import { teeConnection } from "@/lib/connections";
import { getProgram } from "@/lib/program";
import { bidPda, permissionPda, associatedTokenPda } from "@/lib/pdas";
import { sendEr, sendSolana } from "@/lib/tx";
import type { DecodedVault } from "@/lib/types";
import { rememberMyBid, rememberedBidOnLot } from "@/lib/bidMemory";
import { useTeeAuth } from "./useTeeAuth";

const TEE_VALIDATOR = new PublicKey(
  "MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo",
);

async function privateScripBalance(
  conn: Connection,
  ata: PublicKey,
): Promise<bigint> {
  if (!(await conn.getAccountInfo(ata))) return BigInt(0);
  return BigInt((await conn.getTokenAccountBalance(ata)).value.amount);
}

export function usePlaceBid(vault: DecodedVault | null | undefined) {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();
  const { ensureToken } = useTeeAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSig, setLastSig] = useState<string | null>(null);

  const placeBid = useCallback(
    async (amountScrip: number) => {
      if (!vault) {
        setError("No active vault");
        return null;
      }
      if (!connected || !publicKey || !signTransaction) {
        setError(
          "Connect Phantom or Solflare on Devnet first, then try again.",
        );
        return null;
      }
      if (rememberedBidOnLot(publicKey.toBase58(), vault.id)) {
        setError("You already placed a sealed bid on this lot — one bid per wallet.");
        return null;
      }
      if (vault.status !== "Open") {
        setError(`Vault is ${vault.status}, not Open`);
        return null;
      }
      setBusy(true);
      setError(null);
      try {
        const token = await ensureToken();
        if (!token) throw new Error("TEE guest book signature required");

        const amountRaw = BigInt(Math.round(amountScrip * 1_000_000));
        const vaultPk = new PublicKey(vault.publicKey);
        const bid = bidPda(vaultPk, publicKey);
        const conn = teeConnection(token);
        const program = getProgram(conn, {
          publicKey,
          signTransaction: async (tx) => signTransaction(tx as never) as never,
          signAllTransactions: async (txs) =>
            Promise.all(txs.map((tx) => signTransaction(tx as never))) as never,
        });

        // One bid per wallet — refuse before any Phantom popup.
        try {
          await (program.account as any).bid.fetch(bid);
          throw new Error(
            "You already placed a sealed bid on this lot — one bid per wallet.",
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("already placed a sealed bid")) throw e;
          // AccountMissing / fetch fail → first bid path continues
        }

        const housePk = new PublicKey(vault.house);
        const programSol = getProgram(connection, {
          publicKey,
          signTransaction: async (tx) => signTransaction(tx as never) as never,
          signAllTransactions: async (txs) =>
            Promise.all(txs.map((tx) => signTransaction(tx as never))) as never,
        });
        const houseAcct = await (programSol.account as any).house.fetch(housePk);
        const scripMint = houseAcct.scripMint as PublicKey;
        const bidderScrip = associatedTokenPda(scripMint, publicKey);

        const depositKey = `bv_bid_deposit_v1:${publicKey.toBase58()}:${vault.id}`;
        const recordedDeposit = BigInt(localStorage.getItem(depositKey) || "0");
        let privateBalance = await privateScripBalance(conn, bidderScrip);
        const depositNeeded =
          amountRaw > privateBalance ? amountRaw - privateBalance : BigInt(0);
        if (depositNeeded > BigInt(0) && recordedDeposit < amountRaw) {
          const balInfo = await connection
            .getTokenAccountBalance(bidderScrip)
            .catch(() => null);
          const bal = balInfo ? BigInt(balInfo.value.amount) : BigInt(0);
          if (bal < depositNeeded) {
            throw new Error(
              `Need ${Number(depositNeeded) / 1_000_000} SCRIP — claim faucet on Paddle first (balance ${Number(bal) / 1_000_000})`,
            );
          }

          // Deposit/lock SCRIP into TEE so place_bid can approve on the ER.
          const depositIxs = await delegateSpl(publicKey, scripMint, depositNeeded, {
            payer: publicKey,
            validator: TEE_VALIDATOR,
            tokenProgram: TOKEN_PROGRAM_ID,
            initIfMissing: true,
            initVaultIfMissing: true,
            initAtasIfMissing: true,
          });
          await sendSolana(
            connection,
            { publicKey, signTransaction },
            depositIxs,
            { vaultId: String(vault.id), label: "delegateSpl SCRIP for bid" },
          );
          localStorage.setItem(depositKey, amountRaw.toString());
        }

        // Base confirmation can precede the private token clone. Wait until
        // place_bid can approve the deposited SCRIP without another deposit.
        for (
          let attempt = 0;
          privateBalance < amountRaw && attempt < 30;
          attempt++
        ) {
          await new Promise((resolve) => setTimeout(resolve, 2_000));
          privateBalance = await privateScripBalance(conn, bidderScrip);
        }
        if (privateBalance < amountRaw) {
          throw new Error(
            "SCRIP deposit confirmed but still syncing to the private network. Retry this bid shortly; this device will not deposit again.",
          );
        }

        const amount = new BN(amountRaw.toString());

        const placeIx = await (program.methods as any)
          .placeBid(amount)
          .accounts({
            bidder: publicKey,
            lot: vaultPk,
            bid,
            bidderScrip,
            tokenProgram: TOKEN_PROGRAM_ID,
            magicProgram: MAGIC_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();

        const permIx = await (program.methods as any)
          .initBidPermission()
          .accounts({
            bidder: publicKey,
            vault: vaultPk,
            bid,
            bidPermission: permissionPda(bid),
            ephemeralVault: EPHEMERAL_VAULT_ID,
            magicProgram: MAGIC_PROGRAM_ID,
            permissionProgram: PERMISSION_PROGRAM_ID,
          })
          .instruction();

        const result = await sendEr(
          conn,
          { publicKey, signTransaction },
          [placeIx, permIx],
          {
            vaultId: String(vault.id),
            label: "place_bid + init_bid_permission",
          },
        );
        setLastSig(result.sig);
        rememberMyBid(publicKey.toBase58(), vault.id, amountScrip);
        localStorage.removeItem(depositKey);
        await qc.invalidateQueries({ queryKey: ["vault", vault.publicKey] });
        await qc.invalidateQueries({ queryKey: ["my-bid"] });
        return result;
      } catch (e) {
        setError(friendlyBidError(e));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [
      vault,
      connected,
      publicKey,
      signTransaction,
      ensureToken,
      qc,
      connection,
    ],
  );

  return { placeBid, busy, error, lastSig };
}

function friendlyBidError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const lower = msg.toLowerCase();
  if (lower.includes("already placed a sealed bid")) return msg;
  if (
    lower.includes("already") &&
    (lower.includes("bid") || lower.includes("in use") || lower.includes("exists"))
  ) {
    return "You already placed a sealed bid on this lot — one bid per wallet.";
  }
  if (
    lower.includes("invalid account data") ||
    lower.includes("simulation failed") ||
    lower.includes("custom program error")
  ) {
    return `Bid transaction rejected: ${msg.replace(/\s+/g, " ").slice(0, 280)}`;
  }
  return msg;
}
