/**
 * Backup crank: publish due hints → end_auction → reveal → settle →
 * close_round → wait undelegate → finalize.
 *
 * Notes:
 * - Settle uses Model A (winner SCRIP ATA escrow + operator ATA sink).
 * - Loser `refund_bid` requires the losing bidder to sign — keeper cannot
 *   refund strangers; UI / bidder wallet must close those.
 * - Operator `close_peek` only for peeks owned by this wallet.
 *
 * Usage: npx tsx scripts/keeper.ts [--vault <pubkey>] [--once]
 */
import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAuthToken,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../target/idl/blind_vault.json";
import { associatedTokenAddress } from "./lib/ata";
import {
  contentsPda,
  hintsPda,
  housePda,
  itemPda,
  poolPda,
  solanaProvider,
  TEE_RPC,
} from "./lib/env";

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return null;
}

function statusKey(vault: { status: Record<string, unknown> }): string {
  return Object.keys(vault.status)[0] ?? "unknown";
}

async function main() {
  const { program, wallet, connection } = solanaProvider();
  const house = housePda();
  const houseAcct = await (program.account as any).house.fetch(house);
  const mint = houseAcct.scripMint as PublicKey;
  const vaultPk = new PublicKey(
    arg("vault") ?? (houseAcct.activeVault as PublicKey).toBase58(),
  );
  if (vaultPk.equals(PublicKey.default)) {
    console.log("No active vault");
    return;
  }

  const { token } = await Promise.race([
    getAuthToken(
      TEE_RPC,
      wallet.publicKey,
      async (msg) => nacl.sign.detached(msg, wallet.secretKey),
    ),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("getAuthToken timeout (45s)")),
        45_000,
      ),
    ),
  ]);
  const teeConn = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");
  const teeProgram = new Program(
    idl as Idl,
    new AnchorProvider(teeConn, new Wallet(wallet), {
      commitment: "confirmed",
    }),
  );

  const hints = hintsPda(vaultPk);
  const contents = contentsPda(vaultPk);
  const poolLedger = poolPda(house);
  const operatorTreasury = associatedTokenAddress(mint, wallet.publicKey);

  const tick = async () => {
    let vault: any;
    try {
      vault = await Promise.race([
        (teeProgram.account as any).vault.fetch(vaultPk),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("TEE vault fetch timeout")), 20_000),
        ),
      ]);
    } catch (e) {
      console.log("TEE fetch fail, trying Solana", String(e).slice(0, 120));
      vault = await (program.account as any).vault.fetch(vaultPk);
    }
    let status = statusKey(vault);
    const now = Math.floor(Date.now() / 1000);
    console.log(
      `[keeper] vault=${vaultPk.toBase58().slice(0, 8)}… status=${status} bids=${vault.bidCount} closedBids=${vault.closedBidCount} peeks=${vault.peeksSold}/${vault.closedPeekCount}`,
    );

    if (status === "open") {
      const hintsAcct = await (teeProgram.account as any).vaultHints.fetch(
        hints,
      );
      for (let i = 0; i < 4; i++) {
        const h = hintsAcct.hints[i];
        if (h.released) continue;
        if (now < Number(vault.hintTimes[i])) continue;
        try {
          const sig = await (teeProgram.methods as any)
            .publishHint(i)
            .accounts({ vault: vaultPk, hints, contents, poolLedger })
            .rpc();
          console.log("publish_hint", i, sig);
        } catch (e) {
          console.log("publish_hint skip", i, String(e).slice(0, 120));
        }
      }

      if (now >= Number(vault.deadlineTs)) {
        const bidCount = Number(vault.bidCount);
        // Empty lots: abandon quickly. Lots with bids: NEVER force-abandon on a
        // short timer — that stole winners. Wait for bidder End lot / BIDDERS,
        // or operator's own bid PDA when they are the only bidder.
        const emptyGrace = 45;
        // After this, unblock the house even if the human bidder never taps
        // Claim — otherwise Open windows freeze forever (Blitz demo).
        // Default 3 min; set BID_END_WAIT_SECS / FORCE_ABANDON_BIDS to override.
        const bidWaitSecs = Number(process.env.BID_END_WAIT_SECS ?? 180);
        const pastEmptyGrace = now >= Number(vault.deadlineTs) + emptyGrace;
        const pastBidWait = now >= Number(vault.deadlineTs) + bidWaitSecs;
        const forceAbandon =
          process.env.FORCE_ABANDON === "1" ||
          (bidCount === 0 && pastEmptyGrace) ||
          (bidCount > 0 &&
            pastBidWait &&
            process.env.FORCE_ABANDON_BIDS !== "0");

        const envBidders = (process.env.BIDDERS ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => new PublicKey(s));

        // Auto-include operator when their bid PDA exists (demo-bid / house tests).
        // Use getAccountInfo — typed fetch can fail on PER ACL edge cases.
        const candidateBidders = [...envBidders];
        if (bidCount > 0) {
          const opBid = PublicKey.findProgramAddressSync(
            [
              Buffer.from("bid"),
              vaultPk.toBuffer(),
              wallet.publicKey.toBuffer(),
            ],
            program.programId,
          )[0];
          const opInfo = await teeConn.getAccountInfo(opBid);
          if (opInfo && opInfo.data.length > 8) {
            if (!candidateBidders.some((k) => k.equals(wallet.publicKey))) {
              candidateBidders.push(wallet.publicKey);
              console.log("end_auction: found operator bid PDA");
            }
          }
        }

        if (bidCount === 0) {
          try {
            const sig = await (teeProgram.methods as any)
              .endAuction()
              .accounts({ vault: vaultPk })
              .remainingAccounts([])
              .rpc();
            console.log("end_auction (no bids)", sig);
            return;
          } catch (e) {
            console.log("end_auction fail", String(e).slice(0, 160));
          }
        } else if (candidateBidders.length === bidCount) {
          const remaining = candidateBidders.map((bidder) => {
            const bid = PublicKey.findProgramAddressSync(
              [Buffer.from("bid"), vaultPk.toBuffer(), bidder.toBuffer()],
              program.programId,
            )[0];
            return { pubkey: bid, isWritable: false, isSigner: false };
          });
          try {
            const sig = await (teeProgram.methods as any)
              .endAuction()
              .accounts({ vault: vaultPk })
              .remainingAccounts(remaining)
              .rpc();
            console.log("end_auction", sig);
            return;
          } catch (e) {
            console.log("end_auction fail", String(e).slice(0, 160));
          }
        } else {
          console.log(
            `end_auction wait — need BIDDERS=… or each bidder taps End lot (have ${candidateBidders.length}/${bidCount} keys); wait ${bidWaitSecs}s before optional FORCE_ABANDON_BIDS`,
          );
        }

        // Escape hatch: empty lots after short grace, or explicit FORCE_ABANDON*.
        if (forceAbandon) {
          try {
            const sig = await (teeProgram.methods as any)
              .forceAbandonStale()
              .accounts({
                authority: wallet.publicKey,
                house,
                vault: vaultPk,
              })
              .rpc();
            console.log("force_abandon_stale", sig);
          } catch (e) {
            console.log("force_abandon_stale fail", String(e).slice(0, 200));
          }
        }
      }
      return;
    }

    if (status === "ended" || status === "abandoned") {
      const sig = await (teeProgram.methods as any)
        .revealContents()
        .accounts({
          vault: vaultPk,
          contents,
          poolLedger,
          contentsPermission: permissionPdaFromAccount(contents),
          ephemeralVault: EPHEMERAL_VAULT_ID,
          magicProgram: MAGIC_PROGRAM_ID,
          permissionProgram: PERMISSION_PROGRAM_ID,
        })
        .rpc();
      console.log("reveal_contents", sig);
      return;
    }

    if (status === "revealed") {
      const bidCount = Number(vault.bidCount);
      const closedBids = Number(vault.closedBidCount);
      const peeksSold = Number(vault.peeksSold);
      const closedPeeks = Number(vault.closedPeekCount);
      const winner = vault.winner as PublicKey;
      const hasWinner =
        bidCount > 0 && winner && !winner.equals(PublicKey.default);

      // Empty abandoned lots: close + clear active immediately so auto-round
      // can open the next Open lot. Skip undelegate wait (abandoned path
      // never undelegates on TEE — that hung the crank for minutes).
      if (Boolean(vault.abandoned) && bidCount === 0 && peeksSold === 0) {
        try {
          const closeSig = await (teeProgram.methods as any)
            .closeRound()
            .accounts({
              payer: wallet.publicKey,
              vault: vaultPk,
              hints,
              contents,
              poolLedger,
              contentsPermission: permissionPdaFromAccount(contents),
              poolPermission: permissionPdaFromAccount(poolLedger),
              ephemeralVault: EPHEMERAL_VAULT_ID,
              magicProgram: MAGIC_PROGRAM_ID,
              permissionProgram: PERMISSION_PROGRAM_ID,
            })
            .rpc();
          console.log("close_round (abandoned empty)", closeSig);
        } catch (e) {
          console.log("close_round abandoned skip", String(e).slice(0, 200));
        }
        try {
          const clearSig = await (program.methods as any)
            .forceClearActive()
            .accounts({
              authority: wallet.publicKey,
              house,
              vault: vaultPk,
            })
            .rpc();
          console.log("force_clear_active", clearSig);
        } catch (e) {
          console.log("force_clear_active fail", String(e).slice(0, 200));
        }
        console.log("abandoned empty cleared — next lot can open");
        return;
      }

      // Model A settle — winner ATA as escrow, operator ATA as TEE sink
      if (hasWinner && closedBids < bidCount) {
        try {
          const bid = PublicKey.findProgramAddressSync(
            [Buffer.from("bid"), vaultPk.toBuffer(), winner.toBuffer()],
            program.programId,
          )[0];
          const winnerAta = associatedTokenAddress(mint, winner);
          if (!winner.equals(wallet.publicKey)) {
            console.log(
              "settle wait — winner must sign closer (keeper ≠ winner)",
              winner.toBase58(),
            );
          } else {
            const sig = await (teeProgram.methods as any)
              .settleWinningBid()
              .accounts({
                closer: wallet.publicKey,
                lot: vaultPk,
                bid,
                bidPermission: permissionPdaFromAccount(bid),
                escrow: winnerAta,
                treasury: operatorTreasury,
                permissionProgram: PERMISSION_PROGRAM_ID,
                tokenProgram: TOKEN_PROGRAM_ID,
              })
              .rpc();
            console.log("settle_winning_bid", sig);
          }
        } catch (e) {
          console.log("settle skip", String(e).slice(0, 200));
        }
      }

      // Close operator peek; foreign peeks → close_peek_keeper (vault is ACL AUTHORITY)
      if (closedPeeks < peeksSold) {
        try {
          const peek = PublicKey.findProgramAddressSync(
            [
              Buffer.from("peek"),
              vaultPk.toBuffer(),
              wallet.publicKey.toBuffer(),
            ],
            program.programId,
          )[0];
          const info = await teeConn.getAccountInfo(peek);
          if (info) {
            const sig = await (teeProgram.methods as any)
              .closePeek()
              .accounts({
                buyer: wallet.publicKey,
                lot: vaultPk,
                peek,
                peekPermission: permissionPdaFromAccount(peek),
                ephemeralVault: EPHEMERAL_VAULT_ID,
                magicProgram: MAGIC_PROGRAM_ID,
                permissionProgram: PERMISSION_PROGRAM_ID,
              })
              .rpc();
            console.log("close_peek", sig);
          } else if (process.env.PEEK_BUYER) {
            const buyer = new PublicKey(process.env.PEEK_BUYER);
            const foreignPeek = PublicKey.findProgramAddressSync(
              [Buffer.from("peek"), vaultPk.toBuffer(), buyer.toBuffer()],
              program.programId,
            )[0];
            const sig = await (teeProgram.methods as any)
              .closePeekKeeper()
              .accounts({
                authority: wallet.publicKey,
                house: housePda(),
                lot: vaultPk,
                buyer,
                peek: foreignPeek,
                peekPermission: permissionPdaFromAccount(foreignPeek),
                ephemeralVault: EPHEMERAL_VAULT_ID,
                magicProgram: MAGIC_PROGRAM_ID,
                permissionProgram: PERMISSION_PROGRAM_ID,
              })
              .rpc();
            console.log("close_peek_keeper", sig);
          } else {
            console.log(
              "close_peek wait — set PEEK_BUYER=… or buyer hits Release my peek",
            );
          }
        } catch (e) {
          console.log("close_peek skip", String(e).slice(0, 160));
        }
      }

      vault = await (teeProgram.account as any).vault.fetch(vaultPk);
      const readyClose =
        Number(vault.closedBidCount) === Number(vault.bidCount) &&
        Number(vault.closedPeekCount) === Number(vault.peeksSold);

      if (!readyClose) {
        console.log(
          `close_round wait closedBids=${vault.closedBidCount}/${vault.bidCount} peeks=${vault.closedPeekCount}/${vault.peeksSold}`,
        );
        if (Number(vault.bidCount) > Number(vault.closedBidCount) + (hasWinner ? 1 : 0)) {
          console.log(
            "note: remaining closedBid gap is usually loser refunds (bidder must sign)",
          );
        }
        return;
      }

      let closedOk = false;
      try {
        const closeSig = await (teeProgram.methods as any)
          .closeRound()
          .accounts({
            payer: wallet.publicKey,
            vault: vaultPk,
            hints,
            contents,
            poolLedger,
            contentsPermission: permissionPdaFromAccount(contents),
            poolPermission: permissionPdaFromAccount(poolLedger),
            ephemeralVault: EPHEMERAL_VAULT_ID,
            magicProgram: MAGIC_PROGRAM_ID,
            permissionProgram: PERMISSION_PROGRAM_ID,
          })
          .rpc();
        console.log("close_round", closeSig);
        closedOk = true;
      } catch (e) {
        console.log("close_round skip", String(e).slice(0, 200));
      }

      // Abandoned rounds skip undelegate. Also clear active if MagicIntent
      // close_round flakes (0xa0000000) after settle so the next Open lot
      // can start — winner already settled SCRIP; finalize retries later.
      if (Boolean(vault.abandoned) || (!closedOk && hasWinner && closedBids >= bidCount)) {
        try {
          const clearSig = await (program.methods as any)
            .forceClearActive()
            .accounts({
              authority: wallet.publicKey,
              house,
              vault: vaultPk,
            })
            .rpc();
          console.log(
            closedOk
              ? "force_clear_active"
              : "force_clear_active (close_round blocked — next lot unblocked)",
            clearSig,
          );
        } catch (clearErr) {
          console.log(
            "force_clear_active fail",
            String(clearErr).slice(0, 200),
          );
        }
      }
      return;
    }

    if (status === "closed" || status === "settled") {
      await finalizeIfReady({
        connection,
        program,
        teeProgram,
        wallet,
        house,
        vaultPk,
        contents,
        poolLedger,
        abandoned: Boolean(vault.abandoned) || Number(vault.bidCount) === 0,
      });
    }
  };

  await tick();
  if (hasFlag("once")) {
    // TEE WS keeps Node alive — exit so auto-round’s spawnSync returns.
    process.exit(0);
  }

  console.log("keeper polling every 3s…");
  setInterval(() => {
    void tick().catch((e) => console.error(e));
  }, 3_000);
}

async function finalizeIfReady(opts: {
  connection: Connection;
  program: Program;
  teeProgram: Program;
  wallet: { publicKey: PublicKey };
  house: PublicKey;
  vaultPk: PublicKey;
  contents: PublicKey;
  poolLedger: PublicKey;
  abandoned: boolean;
}) {
  const {
    connection,
    program,
    teeProgram,
    wallet,
    house,
    vaultPk,
    contents,
    poolLedger,
    abandoned,
  } = opts;

  // Abandoned TEE rounds never undelegate — don't block the crank for 90s.
  if (abandoned) {
    const info = await connection.getAccountInfo(vaultPk);
    if (!info || !info.owner.equals(program.programId)) {
      console.log(
        "abandoned vault still delegated — active already clear; skip finalize wait",
      );
      return;
    }
    try {
      const fin = await (program.methods as any)
        .finalizeAbandoned()
        .accounts({
          house,
          vault: vaultPk,
          contents,
          poolLedger,
        })
        .rpc();
      console.log("finalize_abandoned", fin);
    } catch (e) {
      console.log("finalize_abandoned skip", String(e).slice(0, 200));
    }
    return;
  }

  // Winning path: wait until vault is back on base program (undelegated).
  let undelegated = false;
  for (let i = 0; i < 45; i++) {
    const info = await connection.getAccountInfo(vaultPk);
    if (info && info.owner.equals(program.programId)) {
      undelegated = true;
      if (i > 0) console.log("undelegated after", i * 2, "s");
      break;
    }
    if (i === 0) console.log("waiting undelegate…");
    await new Promise((r) => setTimeout(r, 2_000));
  }
  if (!undelegated) {
    console.log(
      "still delegated — retry next tick. vault=",
      vaultPk.toBase58(),
    );
    return;
  }

  const vaultSol = await (program.account as any).vault.fetch(vaultPk);
  const contentsSol = await (program.account as any).vaultContents.fetch(
    contents,
  );
  const indices: number[] = [];
  for (let i = 0; i < contentsSol.len; i++) {
    indices.push(Number(contentsSol.items[i]));
  }
  console.log(
    "finalize items",
    indices,
    "winner",
    (vaultSol.winner as PublicKey).toBase58(),
  );

  if (indices.length > 0) {
    try {
      const rel = await (teeProgram.methods as any)
        .releasePoolItems(indices)
        .accounts({
          authority: wallet.publicKey,
          house,
          poolLedger,
        })
        .rpc();
      console.log("release_pool_items", rel);
    } catch (e) {
      console.log("release_pool_items skip", String(e).slice(0, 160));
    }
  }

  const remaining: {
    pubkey: PublicKey;
    isWritable: boolean;
    isSigner: boolean;
  }[] = [];
  for (const idx of indices) {
    const item = itemPda(idx);
    const itemAcct = await (program.account as any).item.fetch(item);
    const itemMint = itemAcct.mint as PublicKey;
    const poolAta = associatedTokenAddress(itemMint, house, true);
    const winnerItemAta = associatedTokenAddress(
      itemMint,
      vaultSol.winner as PublicKey,
    );
    if (!(await connection.getAccountInfo(winnerItemAta))) {
      const ix = {
        programId: ASSOCIATED_TOKEN_PROGRAM_ID,
        keys: [
          { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
          { pubkey: winnerItemAta, isSigner: false, isWritable: true },
          {
            pubkey: vaultSol.winner as PublicKey,
            isSigner: false,
            isWritable: false,
          },
          { pubkey: itemMint, isSigner: false, isWritable: false },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.alloc(0),
      };
      await (program.provider as AnchorProvider).sendAndConfirm(
        new Transaction().add(ix as never),
      );
      console.log("create ATA", itemMint.toBase58().slice(0, 8));
    }
    remaining.push(
      { pubkey: item, isWritable: true, isSigner: false },
      { pubkey: poolAta, isWritable: true, isSigner: false },
      { pubkey: winnerItemAta, isWritable: true, isSigner: false },
    );
  }

  try {
    const fin = await (program.methods as any)
      .finalize()
      .accounts({
        house,
        vault: vaultPk,
        contents,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts(remaining)
      .rpc();
    console.log("finalize", fin);
  } catch (e) {
    console.log("finalize skip", String(e).slice(0, 240));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
