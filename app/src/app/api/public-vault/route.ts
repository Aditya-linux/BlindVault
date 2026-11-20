import { NextResponse } from "next/server";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAuthToken } from "@magicblock-labs/ephemeral-rollups-sdk";
import { AnchorProvider, Idl, Program } from "@coral-xyz/anchor";
import nacl from "tweetnacl";
import idl from "@/idl/blind_vault.json";
import { PROGRAM_ID, SOLANA_RPC, TEE_RPC } from "@/lib/connections";
import { housePda, hintsPda, vaultPda } from "@/lib/pdas";
import { vaultStatusName } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only proxy for public Vault + Hints (server TEE token from ephemeral key). */
export async function GET() {
  try {
    const solana = new Connection(SOLANA_RPC, "confirmed");
    const programId = new PublicKey(PROGRAM_ID);
    const house = housePda();
    const readonlyWallet = {
      publicKey: PublicKey.default,
      signTransaction: async <T>(tx: T) => tx,
      signAllTransactions: async <T>(txs: T[]) => txs,
    };
    const solProgram = new Program(
      idl as Idl,
      new AnchorProvider(solana, readonlyWallet as never, {
        commitment: "confirmed",
      }),
    );
    const houseAcct = await (solProgram.account as any).house.fetchNullable(
      house,
    );
    if (!houseAcct) {
      return NextResponse.json({ active: false, reason: "house_missing" });
    }
    const active = houseAcct.activeVault as PublicKey;
    if (active.equals(PublicKey.default)) {
      return NextResponse.json({ active: false });
    }

    const reader = Keypair.generate();
    const { token } = await getAuthToken(
      TEE_RPC,
      reader.publicKey,
      async (msg) => nacl.sign.detached(msg, reader.secretKey),
    );
    const tee = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");
    const teeProgram = new Program(
      idl as Idl,
      new AnchorProvider(tee, readonlyWallet as never, {
        commitment: "confirmed",
      }),
    );

    const vault = await (teeProgram.account as any).vault.fetch(active);
    const hints = await (teeProgram.account as any).vaultHints.fetch(
      hintsPda(active),
    );

    return NextResponse.json({
      active: true,
      programId: programId.toBase58(),
      vault: {
        publicKey: active.toBase58(),
        id: Number(vault.id),
        size: Number(vault.size),
        status: vaultStatusName(vault.status),
        bidCount: Number(vault.bidCount),
        peeksSold: Number(vault.peeksSold),
        minBid: Number(vault.minBid),
        deadlineTs: Number(vault.deadlineTs),
        openTs: Number(vault.openTs),
        hintTimes: (vault.hintTimes as (bigint | number)[]).map(Number),
        derivedCheck: vaultPda(house, Number(vault.id)).equals(active),
      },
      hints: (hints.hints as any[]).map((h) => ({
        kind: Number(h.kind),
        released: Boolean(h.released),
        a: Number(h.a),
        b: Number(h.b),
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { active: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
