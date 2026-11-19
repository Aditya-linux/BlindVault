export type PulseEnv = {
  network: string;
  solanaRpcUrl: string;
  magicblockErRpcUrl: string;
  magicblockErWsUrl: string;
  programId: string;
  priceFeedId: string;
};

export type EnvValidation =
  | { ok: true; env: PulseEnv }
  | { ok: false; errors: string[] };

function read(name: keyof ImportMetaEnv, fallback = ""): string {
  const value = import.meta.env[name];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return fallback;
}

export function validateEnv(): EnvValidation {
  const env: PulseEnv = {
    network: read("VITE_SOLANA_NETWORK", "devnet"),
    solanaRpcUrl: read(
      "VITE_SOLANA_RPC_URL",
      "https://rpc.magicblock.app/devnet",
    ),
    magicblockErRpcUrl: read(
      "VITE_MAGICBLOCK_ER_RPC_URL",
      "https://devnet-as.magicblock.app",
    ),
    magicblockErWsUrl: read(
      "VITE_MAGICBLOCK_ER_WS_URL",
      "wss://devnet-as.magicblock.app",
    ),
    programId: read(
      "VITE_PROGRAM_ID",
      "BZ6PBwRABDTDsifdLoBKGbzXbxX5bGxStGyvbzneM9H1",
    ),
    priceFeedId: read(
      "VITE_PRICE_FEED_ID",
      "ENYwebBThHzmzwPLAQvCucUTsjyfBSZdD9ViXksS4jPu",
    ),
  };

  const errors: string[] = [];

  if (env.network !== "devnet" && env.network !== "localnet") {
    errors.push(`Unsupported network "${env.network}" (devnet/localnet only).`);
  }

  if (!env.solanaRpcUrl.startsWith("http")) {
    errors.push("VITE_SOLANA_RPC_URL must be an http(s) URL.");
  }

  if (!env.magicblockErRpcUrl.startsWith("http")) {
    errors.push("VITE_MAGICBLOCK_ER_RPC_URL must be an http(s) URL.");
  }

  if (!env.magicblockErWsUrl.startsWith("ws")) {
    errors.push("VITE_MAGICBLOCK_ER_WS_URL must be a ws(s) URL.");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, env };
}
