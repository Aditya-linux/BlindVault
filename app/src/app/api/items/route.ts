import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Idl, Program } from "@coral-xyz/anchor";
import idl from "@/idl/blind_vault.json";
import { serverSolanaRpc } from "@/lib/serverSolanaRpc";
import { housePda, itemPda } from "@/lib/pdas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function decodeName(raw: number[] | Uint8Array): string {
  const bytes = Array.from(raw);
  const end = bytes.findIndex((b) => b === 0);
  const slice = bytes.slice(0, end < 0 ? bytes.length : end);
  return Buffer.from(Uint8Array.from(slice)).toString("utf8");
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("429") || i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw last;
}

export async function GET() {
  try {
    const connection = new Connection(serverSolanaRpc(), {
      commitment: "confirmed",
      disableRetryOnRateLimit: false,
    });
    const wallet = {
      publicKey: PublicKey.default,
      signTransaction: async <T>(tx: T) => tx,
      signAllTransactions: async <T>(txs: T[]) => txs,
    };
    const program = new Program(
      idl as Idl,
      new AnchorProvider(connection, wallet as never, {
        commitment: "confirmed",
      }),
    );
    const accountsApi = program.account as any;

    const house = (await withRetry(() =>
      accountsApi.house.fetchNullable(housePda()),
    )) as { itemCount: number | bigint } | null;
    if (!house) {
      return NextResponse.json({ items: [] });
    }

    const count = Number(house.itemCount);
    const pdas = Array.from({ length: count }, (_, index) => itemPda(index));

    // One batched RPC instead of N parallel fetchNullable calls (avoids 429s)
    const accounts: Array<{
      index: number | bigint;
      mint: PublicKey;
      rarity: number;
      category: number;
      value: number | bigint;
      name: number[] | Uint8Array;
      sold: boolean;
      owner: PublicKey;
    } | null> = await withRetry(() => accountsApi.item.fetchMultiple(pdas));

    const items = [];
    for (const acct of accounts) {
      if (!acct) continue;
      const owner = acct.owner.toBase58();
      items.push({
        index: Number(acct.index),
        mint: acct.mint.toBase58(),
        rarity: Number(acct.rarity),
        category: Number(acct.category),
        value: Number(acct.value),
        name: decodeName(acct.name),
        sold: Boolean(acct.sold),
        owner,
        ownerShort: `${owner.slice(0, 4)}…${owner.slice(-4)}`,
      });
    }

    return NextResponse.json(
      { items: items.sort((a, b) => a.index - b.index) },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("429") ? 503 : 500;
    return NextResponse.json({ error: msg, items: [] }, { status });
  }
}
