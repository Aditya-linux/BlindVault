import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Idl, Program } from "@coral-xyz/anchor";
import idl from "@/idl/blind_vault.json";
import { SOLANA_RPC, TEE_RPC } from "@/lib/connections";
import { housePda, vaultPda } from "@/lib/pdas";
import {
  revealedItemsVisible,
  vaultStatusName,
  type HistoryLot,
} from "@/lib/types";

export type { HistoryLot };

function readonlyProgram(connection: Connection) {
  const wallet = {
    publicKey: PublicKey.default,
    signTransaction: async <T>(tx: T) => tx,
    signAllTransactions: async <T>(txs: T[]) => txs,
  };
  return new Program(
    idl as Idl,
    new AnchorProvider(connection, wallet as never, {
      commitment: "confirmed",
    }),
  );
}

const ZERO = PublicKey.default;

/**
 * Scan house vaults 1..(nextVaultId-1) from TEE + Solana base.
 * Shared by public history + personal winnings so both stay in sync.
 */
export async function loadVaultHistory(opts?: {
  /** Cap how far back we scan (newest first). */
  limit?: number;
}): Promise<{
  nextVaultId: number;
  activeVault: string | null;
  lots: HistoryLot[];
}> {
  const limit = opts?.limit ?? 40;
  const house = housePda();
  const solana = new Connection(SOLANA_RPC, "confirmed");
  const tee = new Connection(TEE_RPC, "confirmed");
  const baseProgram = readonlyProgram(solana);

  const houseAcct = await (baseProgram.account as any).house.fetchNullable(
    house,
  );
  if (!houseAcct) {
    return { nextVaultId: 0, activeVault: null, lots: [] };
  }

  const nextVaultId = Number(houseAcct.nextVaultId);
  const activePk = houseAcct.activeVault as PublicKey;
  const activeVault =
    activePk && !activePk.equals(ZERO) ? activePk.toBase58() : null;

  if (nextVaultId <= 1) {
    return { nextVaultId, activeVault, lots: [] };
  }

  const allIds = Array.from({ length: nextVaultId - 1 }, (_, i) => i + 1);
  const ids = allIds.slice(Math.max(0, allIds.length - limit));
  const pdas = ids.map((id) => vaultPda(house, id));

  async function fetchMany(connection: Connection) {
    const program = readonlyProgram(connection);
    return (await (program.account as any).vault.fetchMultiple(pdas)) as
      | Array<Record<string, unknown> | null>
      | null;
  }

  let teeRows: Array<Record<string, unknown> | null> = [];
  try {
    teeRows = (await fetchMany(tee)) ?? [];
  } catch {
    teeRows = [];
  }
  let baseRows: Array<Record<string, unknown> | null> = [];
  try {
    baseRows = (await fetchMany(solana)) ?? [];
  } catch {
    baseRows = [];
  }

  const lots: HistoryLot[] = [];
  for (let i = 0; i < ids.length; i++) {
    // A TEE clone may remain at Closed after Solana has finalized ownership.
    // Prefer the durable base record only once it is actually Settled.
    const base = baseRows[i];
    const baseStatus = base ? vaultStatusName(base.status as Record<string, unknown>) : null;
    const raw = baseStatus === "Settled" ? base : teeRows[i] ?? base;
    if (!raw) continue;

    const status = vaultStatusName(
      raw.status as number | { [k: string]: unknown } | null | undefined,
    );
    const itemCount = Number(raw.itemCount);
    const prizeRevealed = revealedItemsVisible(status);
    const revealedItems = prizeRevealed
      ? ((raw.revealedItems as (number | bigint)[]) ?? [])
          .map(Number)
          .slice(0, itemCount)
      : [];

    const winnerPk = raw.winner as PublicKey | undefined;
    const hasWinner = Boolean(
      winnerPk && !winnerPk.equals(ZERO) && Number(raw.bidCount) > 0,
    );

    const vaultKey = pdas[i]!.toBase58();
    const isHouseActive = Boolean(activeVault && vaultKey === activeVault);
    // Stale Open lots (past deadline, not house active) are not "live" —
    // they clutter History without cards. Only the active lot + in-window Open.
    const nowSec = Math.floor(Date.now() / 1000);
    const deadlineTs = Number(raw.deadlineTs);
    const inBidWindow =
      status === "Open" && deadlineTs > 0 && deadlineTs > nowSec;
    const live =
      isHouseActive ||
      inBidWindow ||
      status === "Ended" ||
      status === "Filling" ||
      status === "Delegated" ||
      status === "Created";

    lots.push({
      vaultId: ids[i]!,
      vault: vaultKey,
      status,
      size: Number(raw.size),
      itemCount,
      bidCount: Number(raw.bidCount),
      highestBid: Number(raw.highestBid),
      winner: hasWinner ? winnerPk!.toBase58() : null,
      revealedItems,
      revealedValue: Number(raw.revealedValue),
      abandoned: Boolean(raw.abandoned),
      openTs: Number(raw.openTs),
      deadlineTs,
      prizeRevealed,
      live,
    });
  }

  lots.sort((a, b) => b.vaultId - a.vaultId);
  return { nextVaultId, activeVault, lots };
}
