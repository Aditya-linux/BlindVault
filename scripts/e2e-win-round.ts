/**
 * Full happy-path on Devnet/TEE with the operator wallet:
 *   clear stuck → short lot → faucet/bid → end → reveal → settle → close → finalize
 *
 * Usage: npx tsx scripts/e2e-win-round.ts [--amount 15] [--duration 120]
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { BN, type Idl } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { housePda, itemPda, paymentReceiptPda, solanaProvider } from "./lib/env";
import { associatedTokenAddress } from "./lib/ata";
import { demoBid } from "./demo-bid";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]!;
  return fallback;
}

function run(cmd: string, args: string[], timeoutMs = 180_000) {
  console.log(`\n>>> ${cmd} ${args.join(" ")}`);
  const r = spawnSync("npx", ["tsx", cmd, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
    env: process.env,
    timeout: timeoutMs,
    killSignal: "SIGTERM",
  });
  if (r.stdout) process.stdout.write(r.stdout.slice(-2500));
  if (r.stderr) process.stderr.write(r.stderr.slice(0, 800));
  if (r.status !== 0) {
    throw new Error(`${cmd} exited ${r.status}: ${r.error?.message ?? "no exit status"}`);
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const amount = arg("amount", "15");
  const duration = Number(arg("duration", "120"));
  const resume = process.argv.includes("--resume");
  const { program, wallet, connection } = solanaProvider();
  const house = housePda();
  // Stable, isolated test identity. The operator key derives it in memory,
  // but never signs bidder operations or writes the test key to disk.
  const bidderSeed = createHash("sha256")
    .update("blind-vault-devnet-e2e-bidder-v1")
    .update(wallet.secretKey)
    .digest();
  const bidder = Keypair.fromSeed(bidderSeed);
  if ((await connection.getBalance(bidder.publicKey)) < 50_000_000) {
    const fundSig = await sendAndConfirmTransaction(
      connection,
      new Transaction().add(SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: bidder.publicKey,
        lamports: 100_000_000,
      })),
      [wallet],
      { commitment: "confirmed" },
    );
    console.log("funded isolated test bidder", bidder.publicKey.toBase58(), fundSig);
  }

  console.log("e2e-win-round · operator", wallet.publicKey.toBase58());
  console.log(`duration=${duration}s amount=${amount} SCRIP`);

  // Short lot for the test (restore happens at end).
  const timingSig = await (program.methods as any)
    .updateHouseTiming(
      [new BN(5_000_000), new BN(8_000_000), new BN(12_000_000)],
      [new BN(10_000_000), new BN(25_000_000), new BN(50_000_000)],
      [new BN(duration), new BN(duration), new BN(duration + 60)],
    )
    .accounts({ authority: wallet.publicKey, house })
    .rpc();
  console.log("timing", timingSig, `→ ${duration}s`);

  try {
  // Drain only for a fresh round; --resume keeps the active test vault.
  if (!resume) {
  for (let i = 0; i < 8; i++) {
    const h = await (program.account as any).house.fetch(house);
    const active = h.activeVault as PublicKey;
    if (active.equals(PublicKey.default)) break;
    console.log(`drain pass ${i + 1} active=${active.toBase58().slice(0, 8)}…`);
    run("scripts/keeper.ts", ["--once"]);
    await sleep(3_000);
  }
  }

  let h = await (program.account as any).house.fetch(house);
  if (!resume && !(h.activeVault as PublicKey).equals(PublicKey.default)) {
    throw new Error(`E2E FAIL: previous active vault ${h.activeVault.toBase58()} did not finalize`);
  }
  if (resume && (h.activeVault as PublicKey).equals(PublicKey.default)) {
    throw new Error("E2E FAIL: no active vault to resume");
  }

  if (!resume) run("scripts/open-vault.ts", ["--size", "0"]);
  h = await (program.account as any).house.fetch(house);
  const vaultId = Number(h.nextVaultId) - 1;
  console.log("opened vault id", vaultId);

  // Use an isolated Devnet bidder; the house authority must not sign user bids.
  await demoBid(bidder, Number(amount));
  process.env.BIDDERS = bidder.publicKey.toBase58();

  // Wait until past deadline + 5s.
  const { getAuthToken, permissionPdaFromAccount, PERMISSION_PROGRAM_ID, TOKEN_PROGRAM_ID } = await import(
    "@magicblock-labs/ephemeral-rollups-sdk"
  );
  const nacl = await import("tweetnacl");
  const { Connection } = await import("@solana/web3.js");
  const { AnchorProvider, Program, Wallet } = await import(
    "@coral-xyz/anchor"
  );
  const { TEE_RPC } = await import("./lib/env");
  const idl = (await import("../target/idl/blind_vault.json")).default;
  const { token } = await getAuthToken(
    TEE_RPC,
    bidder.publicKey,
    async (m) => nacl.default.sign.detached(m, bidder.secretKey),
  );
  const tee = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");
  const teeProgram = new Program(
    idl as Idl,
    new AnchorProvider(tee, new Wallet(bidder), { commitment: "confirmed" }),
  );
  const bidderBaseProgram = new Program(
    idl as Idl,
    new AnchorProvider(connection, new Wallet(bidder), { commitment: "confirmed" }),
  );
  const vaultPk = h.activeVault as PublicKey;
  let vault = await (teeProgram.account as any).vault.fetch(vaultPk);
  const houseTreasury = (await (program.account as any).house.fetch(house)).treasury as PublicKey;
  const treasuryBefore = BigInt((await connection.getTokenAccountBalance(houseTreasury)).value.amount);
  const bidPk = PublicKey.findProgramAddressSync(
    [Buffer.from("bid"), vaultPk.toBuffer(), bidder.publicKey.toBuffer()],
    program.programId,
  )[0];
  const paymentReceipt = paymentReceiptPda(vaultPk, bidder.publicKey);
  const privateBid = await tee.getAccountInfo(bidPk);
  if (!privateBid || !privateBid.owner.equals(program.programId)) {
    throw new Error("E2E FAIL: bidder could not read their private bid");
  }
  let anonymousDenied = false;
  try {
    const publicBid = await new Connection(TEE_RPC, "confirmed").getAccountInfo(bidPk);
    anonymousDenied = publicBid === null;
  } catch (e) {
    anonymousDenied = /401|403|unauthor|permission|forbidden|access|private/i.test(String(e));
    if (!anonymousDenied) throw e;
  }
  if (!anonymousDenied) {
    throw new Error("E2E FAIL: private bid was readable without TEE authorization");
  }
  const strangerSeed = createHash("sha256")
    .update("blind-vault-devnet-e2e-stranger-v1")
    .update(wallet.secretKey)
    .digest();
  const stranger = Keypair.fromSeed(strangerSeed);
  const { token: strangerToken } = await getAuthToken(
    TEE_RPC,
    stranger.publicKey,
    async (m) => nacl.default.sign.detached(m, stranger.secretKey),
  );
  let strangerDenied = false;
  try {
    const strangerBid = await new Connection(`${TEE_RPC}?token=${strangerToken}`, "confirmed").getAccountInfo(bidPk);
    strangerDenied = strangerBid === null;
  } catch (e) {
    strangerDenied = /401|403|unauthor|permission|forbidden|access|private/i.test(String(e));
    if (!strangerDenied) throw e;
  }
  if (!strangerDenied) {
    throw new Error("E2E FAIL: private bid was readable by another authenticated wallet");
  }
  console.log("bid privacy PASS: bidder read; anonymous and authenticated stranger denied");
  const deadline = Number(vault.deadlineTs);
  const waitMs = Math.max(0, (deadline - Math.floor(Date.now() / 1000) + 6) * 1000);
  console.log(`waiting ${Math.round(waitMs / 1000)}s for deadline…`);
  await sleep(waitMs);

  // End → reveal → settle → close → finalize (operator bid auto-detected).
  for (let i = 0; i < 12; i++) {
    run("scripts/keeper.ts", ["--once"]);
    await sleep(4_000);
    try {
      vault = await (teeProgram.account as any).vault.fetch(vaultPk);
    } catch {
      try {
        vault = await (program.account as any).vault.fetch(vaultPk);
      } catch {
        break;
      }
    }
    const st = Object.keys(vault.status)[0];
    if (st === "revealed" && Number(vault.closedBidCount) === 0) {
      if (!(vault.winner as PublicKey).equals(bidder.publicKey)) {
        throw new Error("E2E FAIL: isolated test bidder was not selected as winner");
      }
      if (!(await connection.getAccountInfo(paymentReceipt))) {
        const paySig = await (bidderBaseProgram.methods as any)
          .payWinningBid(new BN(vault.highestBid.toString()))
          .accounts({
            payer: bidder.publicKey,
            house,
            vault: vaultPk,
            paymentReceipt,
            payerScrip: associatedTokenAddress((await (program.account as any).house.fetch(house)).scripMint as PublicKey, bidder.publicKey),
            treasury: houseTreasury,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        console.log("base SCRIP payment", paySig);
      }
      let receiptVisible = false;
      for (let j = 0; j < 15; j++) {
        if (await tee.getAccountInfo(paymentReceipt)) {
          receiptVisible = true;
          break;
        }
        await sleep(2_000);
      }
      if (!receiptVisible) throw new Error("E2E FAIL: base payment receipt did not appear on TEE");
      const settleSig = await (teeProgram.methods as any)
        .settleWinningBid()
        .accounts({
          closer: bidder.publicKey,
          lot: vaultPk,
          bid: bidPk,
          bidPermission: permissionPdaFromAccount(bidPk),
          paymentReceipt,
          escrow: associatedTokenAddress((await (program.account as any).house.fetch(house)).scripMint as PublicKey, bidder.publicKey),
          treasury: houseTreasury,
          permissionProgram: PERMISSION_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      console.log("winner SCRIP settlement", settleSig);
    }
    const active = (
      await (program.account as any).house.fetch(house)
    ).activeVault as PublicKey;
    console.log(
      `after keeper ${i + 1}: status=${st} winner=${(vault.winner as PublicKey).toBase58().slice(0, 8)}… activeClear=${active.equals(PublicKey.default)}`,
    );
    if (st === "settled") {
      break;
    }
  }

  const finalVault = await (program.account as any).vault.fetch(vaultPk);
  if (Object.keys(finalVault.status)[0] !== "settled") {
    throw new Error(`E2E FAIL: vault ${vaultId} never finalized on Solana`);
  }
  const treasuryAfter = BigInt((await connection.getTokenAccountBalance(houseTreasury)).value.amount);
  const paid = BigInt(finalVault.highestBid.toString());
  if (treasuryAfter - treasuryBefore !== paid) {
    throw new Error(`E2E FAIL: house treasury SCRIP delta ${treasuryAfter - treasuryBefore} != winning bid ${paid}`);
  }
  const winner = finalVault.winner as PublicKey;
  const contents = await (program.account as any).vaultContents.fetch(
    PublicKey.findProgramAddressSync([Buffer.from("contents"), vaultPk.toBuffer()], program.programId)[0],
  );
  for (let i = 0; i < Number(contents.len); i++) {
    const index = Number(contents.items[i]);
    const item = await (program.account as any).item.fetch(itemPda(index));
    if (!item.sold || !(item.owner as PublicKey).equals(winner)) {
      throw new Error(`E2E FAIL: item ${index} is not recorded as owned by winner`);
    }
    const ata = associatedTokenAddress(item.mint as PublicKey, winner);
    const balance = await connection.getTokenAccountBalance(ata);
    if (balance.value.amount !== "1") {
      throw new Error(`E2E FAIL: winner SPL balance for item ${index} is ${balance.value.amount}`);
    }
  }
  console.log("\nE2E PASS: base vault Settled; each Item.owner and SPL balance verified", vaultId);
  console.log(
    "winner",
    (vault.winner as PublicKey).toBase58(),
    "highest",
    Number(vault.highestBid) / 1_000_000,
  );
  } finally {
    await (program.methods as any)
      .updateHouseTiming(
        [new BN(5_000_000), new BN(8_000_000), new BN(12_000_000)],
        [new BN(10_000_000), new BN(25_000_000), new BN(50_000_000)],
        [new BN(480), new BN(480), new BN(600)],
      )
      .accounts({ authority: wallet.publicKey, house })
      .rpc();
    console.log("restored durationSecs [480,480,600]");
  }
}

main()
  .then(() => process.exit(0)) // TEE websocket otherwise keeps the one-shot gate alive.
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
