/**
 * Never-stop wrapper for Blitz judges: restarts auto-round if it exits.
 *
 * Usage:  npx tsx scripts/keep-auto-round.ts
 * npm:    npm run auto-round:keep
 *
 * Leave this running on the operator machine. Ctrl+C stops the watchdog
 * (and the child). Devnet/TEE only.
 */
import { spawn } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const CHILD = path.join("scripts", "auto-round.ts");
const RESTART_MS = 5_000;

let child: ReturnType<typeof spawn> | null = null;
let stopping = false;

function stamp() {
  return new Date().toISOString();
}

function start() {
  if (stopping) return;
  console.log(`[${stamp()}] keep-auto-round · spawning ${CHILD}`);
  child = spawn("npx", ["tsx", CHILD], {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
    shell: true,
  });
  child.on("exit", (code, signal) => {
    child = null;
    if (stopping) return;
    console.error(
      `[${stamp()}] auto-round exited code=${code} signal=${signal} → restart in ${RESTART_MS / 1000}s`,
    );
    setTimeout(start, RESTART_MS);
  });
  child.on("error", (err) => {
    console.error(`[${stamp()}] spawn error`, err.message);
    child = null;
    if (!stopping) setTimeout(start, RESTART_MS);
  });
}

function shutdown() {
  stopping = true;
  console.log(`[${stamp()}] keep-auto-round · shutting down`);
  if (child && !child.killed) {
    child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(0), 1500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`[${stamp()}] keep-auto-round · watching (restart on exit)`);
console.log("Leave this terminal open for Blitz — Open ~8m lots keep cycling.");
start();
