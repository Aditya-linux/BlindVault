import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Idl, Program } from "@coral-xyz/anchor";
import idl from "@/idl/blind_vault.json";
import { PROGRAM_ID, SOLANA_RPC } from "@/lib/connections";
import { housePda, itemPda } from "@/lib/pdas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function decodeName(raw: number[] | Uint8Array): string {
  const bytes = Array.from(raw);
  const end = bytes.findIndex((b) => b === 0);
  const slice = bytes.slice(0, end < 0 ? bytes.length : end);
  return Buffer.from(Uint8Array.from(slice)).toString("utf8");
}

export async function GET() {
  try {
    const connection = new Connection(SOLANA_RPC, "confirmed");
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
    void PROGRAM_ID;
    const house = await (program.account as any).house.fetchNullable(
      housePda(),
    );
    if (!house) {
      return NextResponse.json({ items: [] });
    }
    const count = Number(house.itemCount);
    const items = [];
    const chunk = 10;
    for (let start = 0; start < count; start += chunk) {
      const idxs = Array.from(
        { length: Math.min(chunk, count - start) },
        (_, i) => start + i,
      );
      const rows = await Promise.all(
        idxs.map(async (index) => {
          const acct = await (program.account as any).item.fetchNullable(
            itemPda(index),
          );
          if (!acct) return null;
          const owner = (acct.owner as PublicKey).toBase58();
          return {
            index: Number(acct.index),
            mint: (acct.mint as PublicKey).toBase58(),
            rarity: Number(acct.rarity),
            category: Number(acct.category),
            value: Number(acct.value),
            name: decodeName(acct.name as number[]),
            sold: Boolean(acct.sold),
            owner,
            ownerShort: `${owner.slice(0, 4)}…${owner.slice(-4)}`,
          };
        }),
      );
      for (const row of rows) {
        if (row) items.push(row);
      }
    }
    return NextResponse.json({
      items: items.sort((a, b) => a.index - b.index),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), items: [] },
      { status: 500 },
    );
  }
}
