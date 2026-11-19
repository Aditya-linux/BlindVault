import { Connection, PublicKey } from "@solana/web3.js";
import type { PulseEnv } from "./env";

export type OraclePrice = {
  raw: string;
  display: string;
  exponent: number;
  publishTime: number;
  slot: string;
};

export const ORACLE_SYMBOL = "SOL/USD";

/** Accepted 8-byte discriminators for ephemeral oracle / Pyth PriceUpdateV2. */
const PRICE_UPDATE_DISCRIMINATORS = [
  [234, 161, 14, 36, 172, 239, 15, 232],
  [34, 241, 35, 99, 157, 126, 244, 205],
] as const;

function formatOraclePrice(raw: bigint, exponent: number): string {
  const scale = Math.abs(exponent);
  if (scale === 0) return raw.toString();
  const denominator = 10n ** BigInt(scale);
  const whole = raw / denominator;
  const fraction = (raw % denominator).toString().padStart(scale, "0");
  return `${whole}.${fraction}`.replace(/\.?0+$/, "") || "0";
}

export function decodeOraclePrice(data: Uint8Array): OraclePrice {
  if (data.length < 133) {
    throw new Error("Oracle price account has invalid data");
  }
  const discriminator = Array.from(data.subarray(0, 8));
  const matched = PRICE_UPDATE_DISCRIMINATORS.some((d) =>
    d.every((byte, i) => byte === discriminator[i]),
  );
  if (!matched) {
    throw new Error("Oracle account is not a recognized price-update account");
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const raw = view.getBigInt64(73, true);
  const exponent = view.getInt32(89, true);
  const publishTime = Number(view.getBigInt64(93, true));
  const slot = view.getBigUint64(125, true).toString();

  return {
    raw: raw.toString(),
    display: formatOraclePrice(raw, exponent),
    exponent,
    publishTime,
    slot,
  };
}

export function erConnection(env: PulseEnv): Connection {
  return new Connection(env.magicblockErRpcUrl, {
    commitment: "confirmed",
    wsEndpoint: env.magicblockErWsUrl,
  });
}

export async function fetchOraclePrice(
  env: PulseEnv,
  feedAddress = env.priceFeedId,
): Promise<OraclePrice> {
  const connection = erConnection(env);
  const feed = new PublicKey(feedAddress);
  const account = await connection.getAccountInfo(feed, "confirmed");
  if (!account) {
    throw new Error(`Oracle account not found on ER (${feedAddress.slice(0, 8)}…)`);
  }
  return decodeOraclePrice(account.data);
}

export function subscribeOraclePrice(
  env: PulseEnv,
  onPrice: (price: OraclePrice) => void,
  onError: (error: unknown) => void,
  feedAddress = env.priceFeedId,
): () => void {
  const connection = erConnection(env);
  const feed = new PublicKey(feedAddress);
  let subscriptionId: number | null = null;
  let disposed = false;

  void fetchOraclePrice(env, feedAddress).then(onPrice).catch(onError);

  try {
    const id = connection.onAccountChange(
      feed,
      (account) => {
        try {
          onPrice(decodeOraclePrice(account.data));
        } catch (error) {
          onError(error);
        }
      },
      "confirmed",
    );
    if (disposed) {
      void connection.removeAccountChangeListener(id);
    } else {
      subscriptionId = id;
    }
  } catch (error) {
    onError(error);
  }

  return () => {
    disposed = true;
    if (subscriptionId !== null) {
      void connection.removeAccountChangeListener(subscriptionId);
    }
  };
}
