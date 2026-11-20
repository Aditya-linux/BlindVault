import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Idl, Program } from "@coral-xyz/anchor";
import idl from "@/idl/blind_vault.json";
import { SOLANA_RPC } from "@/lib/connections";
import { housePda } from "@/lib/pdas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Server-side House fetch — avoids browser→RPC CORS / flakes. */
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
    const house = housePda();
    const acct = await (program.account as any).house.fetchNullable(house);
    if (!acct) {
      return NextResponse.json({ house: null });
    }
    const active = acct.activeVault as PublicKey;
    const hasActive = !active.equals(PublicKey.default);
    return NextResponse.json({
      house: house.toBase58(),
      activeVault: hasActive ? active.toBase58() : null,
      nextVaultId: Number(acct.nextVaultId),
      scripMint: (acct.scripMint as PublicKey).toBase58(),
      treasury: (acct.treasury as PublicKey).toBase58(),
      itemCount: Number(acct.itemCount),
      minBid: (acct.minBid as (bigint | number)[]).map(Number),
      peekFee: (acct.peekFee as (bigint | number)[]).map(Number),
      durationSecs: (acct.durationSecs as (bigint | number)[]).map(Number),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), house: null },
      { status: 500 },
    );
  }
}
