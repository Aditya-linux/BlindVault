/**
 * Full happy-path on Devnet/TEE with the operator wallet:
 *   clear stuck → short lot → faucet/bid → end → reveal → settle → close → finalize
 *
 * Usage: npx tsx scripts/e2e-win-round.ts [--amount 15] [--duration 120]
 */
import { spawnSync } from "node:child_process";
import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { housePda, solanaProvider } from "./lib/env";

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
  // Windows/tsx sometimes yields status=null after a successful child exit.
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const softOk =
    r.status == null &&
    (out.includes("OPEN ok") ||
      out.includes("bid_count") ||
      out.includes("place_bid") ||
      out.includes("[keeper]"));
  if ((r.status ?? (softOk ? 0 : 1)) !== 0) {
    throw new Error(`${cmd} exited ${r.status}`);
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const amount = arg("amount", "15");
  const duration = Number(arg("duration", "120"));
  const { program, wallet } = solanaProvider();
  const house = housePda();

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

  // Drain stuck active with keeper passes.
  for (let i = 0; i < 8; i++) {
    const h = await (program.account as any).house.fetch(house);
    const active = h.activeVault as PublicKey;
    if (active.equals(PublicKey.default)) break;
    console.log(`drain pass ${i + 1} active=${active.toBase58().slice(0, 8)}…`);
    run("scripts/keeper.ts", ["--once"]);
    await sleep(3_000);
  }

  let h = await (program.account as any).house.fetch(house);
  if (!(h.activeVault as PublicKey).equals(PublicKey.default)) {
    console.log("force_clear_active leftover");
    try {
      await (program.methods as any)
        .forceClearActive()
        .accounts({
          authority: wallet.publicKey,
          house,
          vault: h.activeVault,
        })
        .rpc();
    } catch (e) {
      console.log("force_clear skip", String(e).slice(0, 160));
    }
  }

  run("scripts/open-vault.ts", ["--size", "0"]);
  h = await (program.account as any).house.fetch(house);
  const vaultId = Number(h.nextVaultId) - 1;
  console.log("opened vault id", vaultId);

  run("scripts/demo-bid.ts", ["--amount", amount]);

  // Wait until past deadline + 5s.
  const { getAuthToken } = await import(
    "@magicblock-labs/ephemeral-rollups-sdk"
  );
  const nacl = await import("tweetnacl");
  const { Connection } = await import("@solana/web3.js");
  const { AnchorProvider, Idl, Program, Wallet } = await import(
    "@coral-xyz/anchor"
  );
  const { TEE_RPC } = await import("./lib/env");
  const idl = (await import("../target/idl/blind_vault.json")).default;
  const { token } = await getAuthToken(
    TEE_RPC,
    wallet.publicKey,
    async (m) => nacl.default.sign.detached(m, wallet.secretKey),
  );
  const tee = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");
  const teeProgram = new Program(
    idl as Idl,
    new AnchorProvider(tee, new Wallet(wallet), { commitment: "confirmed" }),
  );
  const vaultPk = h.activeVault as PublicKey;
  let vault = await (teeProgram.account as any).vault.fetch(vaultPk);
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
    const active = (
      await (program.account as any).house.fetch(house)
    ).activeVault as PublicKey;
    console.log(
      `after keeper ${i + 1}: status=${st} winner=${(vault.winner as PublicKey).toBase58().slice(0, 8)}… activeClear=${active.equals(PublicKey.default)}`,
    );
    if (
      st === "settled" ||
      (st === "closed" && active.equals(PublicKey.default)) ||
      active.equals(PublicKey.default)
    ) {
      break;
    }
  }

  // Restore ~8m demo durations.
  await (program.methods as any)
    .updateHouseTiming(
      [new BN(5_000_000), new BN(8_000_000), new BN(12_000_000)],
      [new BN(10_000_000), new BN(25_000_000), new BN(50_000_000)],
      [new BN(480), new BN(480), new BN(600)],
    )
    .accounts({ authority: wallet.publicKey, house })
    .rpc();
  console.log("restored durationSecs [480,480,600]");

  console.log("\nE2E PASS candidate — check /api/history and Me for vault", vaultId);
  console.log(
    "winner",
    (vault.winner as PublicKey).toBase58(),
    "highest",
    Number(vault.highestBid) / 1_000_000,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
