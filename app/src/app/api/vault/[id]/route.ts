import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Idl, Program } from "@coral-xyz/anchor";
import idl from "@/idl/blind_vault.json";
import { PROGRAM_ID, SOLANA_RPC, TEE_RPC } from "@/lib/connections";
import { housePda, hintsPda, vaultPda } from "@/lib/pdas";
import { revealedItemsVisible, vaultStatusName } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idRaw } = await ctx.params;
    const id = Number(idRaw);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "bad_id" }, { status: 400 });
    }

    const programId = new PublicKey(PROGRAM_ID);
    const house = housePda();
    const vault = vaultPda(house, id);
    const hints = hintsPda(vault);

    const tee = new Connection(TEE_RPC, "confirmed");
    const teeProgram = readonlyProgram(tee);

    let vaultRaw: any = null;
    let hintsRaw: any = null;
    let source: "tee" | "solana" = "tee";

    try {
      vaultRaw = await (teeProgram.account as any).vault.fetch(vault);
      try {
        hintsRaw = await (teeProgram.account as any).vaultHints.fetch(hints);
      } catch {
        hintsRaw = null;
      }
    } catch {
      const solana = new Connection(SOLANA_RPC, "confirmed");
      const info = await solana.getAccountInfo(vault);
      if (!info || !info.owner.equals(programId)) {
        return NextResponse.json(
          { error: "vault_unavailable", vault: vault.toBase58() },
          { status: 404 },
        );
      }
      const solProgram = readonlyProgram(solana);
      vaultRaw = await (solProgram.account as any).vault.fetch(vault);
      try {
        hintsRaw = await (solProgram.account as any).vaultHints.fetch(hints);
      } catch {
        hintsRaw = null;
      }
      source = "solana";
    }

    // Finalized Solana state outranks an older TEE clone stuck at Closed.
    if (source === "tee") {
      try {
        const base = readonlyProgram(new Connection(SOLANA_RPC, "confirmed"));
        const finalized = await (base.account as any).vault.fetch(vault);
        if (vaultStatusName(finalized.status) === "Settled") {
          vaultRaw = finalized;
          source = "solana";
        }
      } catch {
        // Delegated vaults are not readable as program accounts on base.
      }
    }

    return NextResponse.json({
      source,
      vault: {
        publicKey: vault.toBase58(),
        house: (vaultRaw.house as PublicKey).toBase58(),
        id: Number(vaultRaw.id),
        size: Number(vaultRaw.size),
        itemCount: Number(vaultRaw.itemCount),
        minBid: Number(vaultRaw.minBid),
        peekFee: Number(vaultRaw.peekFee),
        durationSecs: Number(vaultRaw.durationSecs),
        openTs: Number(vaultRaw.openTs),
        deadlineTs: Number(vaultRaw.deadlineTs),
        hintTimes: (vaultRaw.hintTimes as (bigint | number)[]).map(Number),
        status: vaultStatusName(vaultRaw.status),
        bidCount: Number(vaultRaw.bidCount),
        peeksSold: Number(vaultRaw.peeksSold),
        highestBid: Number(vaultRaw.highestBid),
        winner: (vaultRaw.winner as PublicKey).toBase58(),
        revealedItems: (() => {
          const status = vaultStatusName(vaultRaw.status);
          if (!revealedItemsVisible(status)) return [] as number[];
          return (vaultRaw.revealedItems as (number | bigint)[])
            .map(Number)
            .slice(0, Number(vaultRaw.itemCount));
        })(),
        revealedValue: Number(vaultRaw.revealedValue),
        escrow: (vaultRaw.escrow as PublicKey).toBase58(),
        abandoned: Boolean(vaultRaw.abandoned),
      },
      hints: hintsRaw
        ? {
            publicKey: hints.toBase58(),
            vault: vault.toBase58(),
            hints: (hintsRaw.hints as any[]).map((h) => ({
              kind: Number(h.kind),
              released: Boolean(h.released),
              a: Number(h.a),
              b: Number(h.b),
              releasedTs: Number(h.releasedTs),
            })),
          }
        : null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
