import { NextResponse } from "next/server";
import { loadVaultHistory } from "@/lib/vaultHistory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public prize chain: every vault with winner + packed cards when revealed. */
export async function GET() {
  try {
    const data = await loadVaultHistory({ limit: 40 });
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=8, stale-while-revalidate=20",
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : String(e),
        nextVaultId: 0,
        activeVault: null,
        lots: [],
      },
      { status: 500 },
    );
  }
}
