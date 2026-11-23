/**
 * Never-stop wrapper for Blitz judges: restarts auto-round if it exits.
 *
 * - Restarts on crash / null exit / spawn error
 * - Heartbeat log so you know the watchdog is alive
 * - Child gets a hard kill if it hangs past CHILD_MAX_MS (optional safety)
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
const HEARTBEAT_MS = 60_000;
/** Soft ceiling — auto-round is infinite; only used if env set. */
const CHILD_MAX_MS = Number(process.env.AUTO_ROUND_CHILD_MAX_MS ?? 0);

let child: ReturnType<typeof spawn> | null = null;
let stopping = false;
let starts = 0;
let childStartedAt = 0;
let killTimer: ReturnType<typeof setTimeout> | null = null;

function stamp() {
  return new Date().toISOString();
}

function clearKillTimer() {
  if (killTimer) {
    clearTimeout(killTimer);
    killTimer = null;
  }
}

function start() {
  if (stopping) return;
  starts += 1;
  childStartedAt = Date.now();
  console.log(
    `[${stamp()}] keep-auto-round · spawn #${starts} ${CHILD}`,
  );
  child = spawn("npx", ["tsx", CHILD], {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
    shell: true,
  });

  if (CHILD_MAX_MS > 0) {
    killTimer = setTimeout(() => {
      if (!child || child.killed) return;
      console.error(
        `[${stamp()}] keep-auto-round · child exceeded ${CHILD_MAX_MS}ms → SIGTERM`,
      );
      child.kill("SIGTERM");
    }, CHILD_MAX_MS);
  }

  child.on("exit", (code, signal) => {
    clearKillTimer();
    child = null;
    if (stopping) return;
    console.error(
      `[${stamp()}] auto-round exited code=${code} signal=${signal} after ${Math.round((Date.now() - childStartedAt) / 1000)}s → restart in ${RESTART_MS / 1000}s`,
    );
    setTimeout(start, RESTART_MS);
  });
  child.on("error", (err) => {
    clearKillTimer();
    console.error(`[${stamp()}] spawn error`, err.message);
    child = null;
    if (!stopping) setTimeout(start, RESTART_MS);
  });
}

function shutdown() {
  stopping = true;
  clearKillTimer();
  console.log(`[${stamp()}] keep-auto-round · shutting down`);
  if (child && !child.killed) {
    child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(0), 1500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("uncaughtException", (err) => {
  console.error(`[${stamp()}] keep-auto-round uncaught`, err.message);
  if (!stopping) setTimeout(start, RESTART_MS);
});
process.on("unhandledRejection", (err) => {
  console.error(
    `[${stamp()}] keep-auto-round rejection`,
    err instanceof Error ? err.message : String(err),
  );
});

setInterval(() => {
  if (stopping) return;
  console.log(
    `[${stamp()}] keep-auto-round · heartbeat starts=${starts} child=${child ? "up" : "down"}`,
  );
}, HEARTBEAT_MS);

console.log(`[${stamp()}] keep-auto-round · watching (restart forever)`);
console.log(
  "Leave this terminal open for Blitz — completed lots finalize, then the next lot opens.",
);
start();
