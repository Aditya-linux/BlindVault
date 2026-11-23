import { NextRequest, NextResponse } from "next/server";
import { serverSolanaRpc } from "@/lib/serverSolanaRpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_METHODS = new Set([
  "getAccountInfo",
  "getBalance",
  "getBlockHeight",
  "getEpochInfo",
  "getFeeForMessage",
  "getGenesisHash",
  "getLatestBlockhash",
  "getMinimumBalanceForRentExemption",
  "getMultipleAccounts",
  "getProgramAccounts",
  "getSignatureStatuses",
  "getSlot",
  "getTokenAccountBalance",
  "getTokenAccountsByOwner",
  "getTransaction",
  "sendTransaction",
  "simulateTransaction",
]);

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Cross-origin RPC denied" }, { status: 403 });
  }
  if (Number(request.headers.get("content-length") || 0) > 1_000_000) {
    return NextResponse.json({ error: "RPC request too large" }, { status: 413 });
  }
  let body: string;
  let payload: unknown;
  try {
    body = await request.text();
    if (body.length > 1_000_000) throw new Error("too large");
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid RPC request" }, { status: 400 });
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    !ALLOWED_METHODS.has((payload as { method?: string }).method || "") ||
    !Array.isArray((payload as { params?: unknown }).params)
  ) {
    return NextResponse.json({ error: "RPC method denied" }, { status: 400 });
  }
  try {
    const upstream = await fetch(serverSolanaRpc(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const response = await upstream.text();
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "cache-control": "no-store",
    };
    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter) headers["retry-after"] = retryAfter;
    return new NextResponse(response, { status: upstream.status, headers });
  } catch {
    return NextResponse.json({ error: "Devnet RPC unavailable; try again shortly" }, { status: 502 });
  }
}
