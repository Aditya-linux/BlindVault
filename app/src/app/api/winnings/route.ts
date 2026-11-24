import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { loadVaultHistory } from "@/lib/vaultHistory";
import type { WinningLot } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Past lots where `owner` is the recorded winner (same source as /api/history). */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ownerRaw = url.searchParams.get("owner")?.trim();
    if (!ownerRaw) {
      return NextResponse.json({ error: "missing_owner" }, { status: 400 });
    }

    let owner: PublicKey;
    try {
      owner = new PublicKey(ownerRaw);
    } catch {
      return NextResponse.json({ error: "bad_owner" }, { status: 400 });
    }

    const { lots } = await loadVaultHistory({ limit: Number.MAX_SAFE_INTEGER });
    const winnings: WinningLot[] = lots
      .filter(
        (lot) =>
          lot.winner === owner.toBase58() &&
          !lot.abandoned &&
          lot.status === "Settled" &&
          lot.bidCount > 0,
      )
      .map((lot) => ({
        vaultId: lot.vaultId,
        vault: lot.vault,
        status: lot.status,
        highestBid: lot.highestBid,
        itemCount: lot.itemCount,
        revealedItems: lot.revealedItems,
        revealedValue: lot.revealedValue,
        abandoned: lot.abandoned,
        settled: lot.status === "Settled",
      }));

    return NextResponse.json(
      { winnings },
      {
        headers: {
          "Cache-Control": "public, s-maxage=8, stale-while-revalidate=20",
        },
      },
    );
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : String(e),
        winnings: [] as WinningLot[],
      },
      { status: 500 },
    );
  }
}
