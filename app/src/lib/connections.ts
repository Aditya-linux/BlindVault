import { Connection } from "@solana/web3.js";

function env(name: string, fallback: string): string {
  const raw = process.env[name];
  if (!raw) return fallback;
  // Strip accidental CRLF / quotes from `vercel env add` pipes on Windows
  return raw.replace(/^["']|["']$/g, "").replace(/\\r\\n$/g, "").trim();
}

// Browser traffic uses our same-origin Devnet proxy; the provider credential
// stays on the server. SSR never opens this connection during page rendering.
export const SOLANA_RPC =
  typeof window === "undefined"
    ? "https://api.devnet.solana.com"
    : `${window.location.origin}/api/solana-rpc`;
export const TEE_RPC = env(
  "NEXT_PUBLIC_TEE_RPC",
  "https://devnet-tee.magicblock.app",
);
export const TEE_WS = env(
  "NEXT_PUBLIC_TEE_WS",
  "wss://devnet-tee.magicblock.app",
);
export const PROGRAM_ID = env(
  "NEXT_PUBLIC_PROGRAM_ID",
  "E9UmQYi4gTHyyQ3SK5B4UCpewBnUBFrEc5NqkkAjr42h",
);

/** Lazy so Next build / page-data collection doesn’t open RPC sockets at import. */
let _solana: Connection | null = null;
let _teePublic: Connection | null = null;

export const solana: Connection = new Proxy({} as Connection, {
  get(_t, prop, receiver) {
    if (!_solana) {
      _solana = new Connection(SOLANA_RPC, "confirmed");
    }
    const value = Reflect.get(_solana, prop, receiver);
    return typeof value === "function" ? value.bind(_solana) : value;
  },
});

/** Public TEE RPC — enough for non-permissioned accounts (Vault, Hints). */
export const teePublic: Connection = new Proxy({} as Connection, {
  get(_t, prop, receiver) {
    if (!_teePublic) {
      _teePublic = new Connection(TEE_RPC, {
        commitment: "confirmed",
        wsEndpoint: TEE_WS,
      });
    }
    const value = Reflect.get(_teePublic, prop, receiver);
    return typeof value === "function" ? value.bind(_teePublic) : value;
  },
});

export function teeConnection(token: string) {
  return new Connection(`${TEE_RPC}?token=${token}`, {
    commitment: "confirmed",
    wsEndpoint: `${TEE_WS}?token=${token}`,
  });
}
