/**
 * Automated round loop for demo:
 *   Open bidding → deadline → settle/abandon → finalize → open next lot
 *
 * Usage: npx tsx scripts/auto-round.ts
 * Stops with Ctrl+C. Devnet/TEE only.
 */
import { spawnSync } from "node:child_process";
import { PublicKey } from "@solana/web3.js";
import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { getAuthToken } from "@magicblock-labs/ephemeral-rollups-sdk";
import nacl from "tweetnacl";
import idl from "../target/idl/blind_vault.json";
import { housePda, solanaProvider, TEE_RPC } from "./lib/env";

function run(cmd: string, args: string[], timeoutMs = 75_000) {
  console.log(`[auto-round] spawn ${cmd} ${args.join(" ")}`);
  const r = spawnSync("npx", ["tsx", cmd, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: true,
    env: process.env,
    timeout: timeoutMs,
    killSignal: "SIGTERM",
  });
  if (r.error) {
    console.log(`[auto-round] spawn error: ${r.error.message}`);
  }
  if (r.signal) {
    console.log(`[auto-round] killed by ${r.signal} (timeout?)`);
  }
  if (r.stdout) process.stdout.write(r.stdout.slice(-1600));
  if (r.stderr) process.stderr.write(r.stderr.slice(0, 600));
  // Windows/tsx sometimes yields status=null after a successful child.
  const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
  const softOk =
    r.status == null &&
    (out.includes("OPEN ok") ||
      out.includes("[keeper]") ||
      out.includes("No active vault") ||
      out.includes("force_clear"));
  const code = r.status ?? (softOk ? 0 : 1);
  console.log(`[auto-round] exit ${r.status ?? "null"}${softOk ? " (soft-ok)" : ""}`);
  return code;
}

function statusKey(v: { status: Record<string, unknown> }) {
  return Object.keys(v.status)[0] ?? "unknown";
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { program, wallet } = solanaProvider();
  const housePk = housePda();
  console.log("auto-round · house", housePk.toBase58());
  console.log("operator", wallet.publicKey.toBase58());
  console.log("auto-round · resilient loop (RPC errors retry, do not exit)");

  for (;;) {
    try {
      const house = await (program.account as any).house.fetch(housePk);
      const active = house.activeVault as PublicKey;
      const nextId = Number(house.nextVaultId);

      if (active.equals(PublicKey.default)) {
        console.log(
          `[${new Date().toISOString()}] no active vault → open next (${nextId})`,
        );
        run("scripts/open-vault.ts", ["--size", "0"], 120_000);
        await sleep(8_000);
        continue;
      }

      const { token } = await getAuthToken(
        TEE_RPC,
        wallet.publicKey,
        async (m) => nacl.sign.detached(m, wallet.secretKey),
      );
      const tee = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");
      const teeProgram = new Program(
        idl as Idl,
        new AnchorProvider(tee, new Wallet(wallet), {
          commitment: "confirmed",
        }),
      );

      let vault: any;
      try {
        vault = await (teeProgram.account as any).vault.fetch(active);
      } catch {
        try {
          vault = await (program.account as any).vault.fetch(active);
        } catch (e) {
          console.log("vault fetch fail", String(e).slice(0, 120));
          await sleep(5_000);
          continue;
        }
      }

      const status = statusKey(vault);
      const now = Math.floor(Date.now() / 1000);
      const deadline = Number(vault.deadlineTs);
      const left = deadline - now;
      const id = Number(vault.id);

      // Actual bidding window — keep logging so operators know Join is live.
      if (status === "open" && left > 0) {
        console.log(
          `[${new Date().toISOString()}] lot ${id} OPEN · bidding ends in ${left}s`,
        );
        await sleep(Math.min(15_000, Math.max(3_000, left * 1000)));
        continue;
      }

      console.log(
        `[${new Date().toISOString()}] lot ${id} status=${status} left=${left} → keeper`,
      );
      run("scripts/keeper.ts", ["--once"], 120_000);
      await sleep(6_000);
    } catch (e) {
      // Never die on Helius/TEE timeouts — that left lots Abandoned with
      // endless “next bid” UI and no Open window for users.
      console.error(
        `[${new Date().toISOString()}] auto-round tick error (retry):`,
        e instanceof Error ? e.message : String(e).slice(0, 200),
      );
      await sleep(10_000);
    }
  }
}

main().catch((e) => {
  console.error("auto-round fatal", e);
  process.exit(1);
});
