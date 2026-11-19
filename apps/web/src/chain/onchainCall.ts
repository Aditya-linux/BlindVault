import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  concatBytes,
  encodeI64LE,
  encodePubkeyBytes,
  encodeU64LE,
  u8,
} from "./bytes";
import type { PulseEnv } from "./env";
import {
  ephemeralOracleQueueForEnv,
  PROGRAM_SEEDS,
  type CallDirection,
} from "./program";

/** Injected wallet surface — never holds secrets in our code. */
export type WalletSigner = {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
};

export type TimedTxResult = {
  signature: string;
  sendMs: number;
  route: "base" | "er";
};

export type DecodedCall = {
  status: number;
  direction: number;
  openPrice: bigint;
  settlePrice: bigint;
  expiryUnix: bigint;
  payoutBps: bigint;
  pulseSeed: number;
  won: boolean;
};

const DISC = {
  initialize_pool: Uint8Array.from([95, 180, 10, 172, 84, 174, 232, 40]),
  create_call: Uint8Array.from([83, 152, 245, 217, 91, 24, 250, 65]),
  delegate: Uint8Array.from([90, 147, 75, 178, 85, 88, 4, 137]),
  place_call: Uint8Array.from([11, 8, 17, 8, 195, 166, 211, 69]),
  request_pulse: Uint8Array.from([77, 159, 171, 21, 117, 85, 43, 205]),
  settle_call: Uint8Array.from([58, 230, 6, 58, 104, 245, 154, 227]),
  reset_call: Uint8Array.from([136, 231, 8, 73, 175, 68, 112, 189]),
} as const;

const text = new TextEncoder();

export function programId(env: PulseEnv): PublicKey {
  return new PublicKey(env.programId);
}

export function poolPda(env: PulseEnv): PublicKey {
  return PublicKey.findProgramAddressSync(
    [text.encode(PROGRAM_SEEDS.pool)],
    programId(env),
  )[0];
}

export function callPda(env: PulseEnv, player: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [text.encode(PROGRAM_SEEDS.call), player.toBytes()],
    programId(env),
  )[0];
}

export function priceFeedPubkey(env: PulseEnv): PublicKey {
  return new PublicKey(env.priceFeedId);
}

export function baseConnection(env: PulseEnv): Connection {
  return new Connection(env.solanaRpcUrl, "confirmed");
}

export function erConnection(env: PulseEnv): Connection {
  return new Connection(env.magicblockErRpcUrl, {
    commitment: "confirmed",
    wsEndpoint: env.magicblockErWsUrl,
  });
}

async function sendWithWallet(
  connection: Connection,
  wallet: WalletSigner,
  ixs: TransactionInstruction[],
  route: "base" | "er",
): Promise<TimedTxResult> {
  const started = performance.now();
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: wallet.publicKey,
    blockhash,
    lastValidBlockHeight,
  }).add(...ixs);
  const signed = await wallet.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  return {
    signature,
    sendMs: performance.now() - started,
    route,
  };
}

export async function fetchProgramAccount(
  env: PulseEnv,
  address: PublicKey,
): Promise<{ exists: boolean; owner: string | null; dataLen: number }> {
  const info = await baseConnection(env).getAccountInfo(address, "confirmed");
  if (!info) return { exists: false, owner: null, dataLen: 0 };
  return {
    exists: true,
    owner: info.owner.toBase58(),
    dataLen: info.data.length,
  };
}

/** Call account layout after 8-byte discriminator (see programs/pulse_call Call). */
export function decodeCallAccount(data: Uint8Array): DecodedCall {
  if (data.length < 8 + 1 + 32 + 1 + 1 + 8 + 8 + 8 + 8 + 8 + 4 + 1 + 1) {
    throw new Error("Call account data too short");
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let o = 8;
  o += 1; // schema
  o += 32; // player
  const status = data[o];
  o += 1;
  const direction = data[o];
  o += 1;
  const openPrice = view.getBigInt64(o, true);
  o += 8;
  const settlePrice = view.getBigInt64(o, true);
  o += 8;
  o += 8; // open_slot
  const expiryUnix = view.getBigInt64(o, true);
  o += 8;
  const payoutBps = view.getBigUint64(o, true);
  o += 8;
  const pulseSeed = view.getUint32(o, true);
  o += 4;
  const won = data[o] !== 0;
  return {
    status,
    direction,
    openPrice,
    settlePrice,
    expiryUnix,
    payoutBps,
    pulseSeed,
    won,
  };
}

export async function fetchCallOnEr(
  env: PulseEnv,
  player: PublicKey,
): Promise<DecodedCall | null> {
  const info = await erConnection(env).getAccountInfo(
    callPda(env, player),
    "confirmed",
  );
  if (!info) return null;
  return decodeCallAccount(info.data);
}

export async function ensurePoolInitialized(
  env: PulseEnv,
  wallet: WalletSigner,
  payoutBps = 18_000n,
  minDuration = 5n,
  maxDuration = 15n,
): Promise<TimedTxResult | { skipped: true; reason: string }> {
  const pool = poolPda(env);
  const existing = await fetchProgramAccount(env, pool);
  if (existing.exists) {
    return { skipped: true, reason: `Pool already on-chain (${pool.toBase58()})` };
  }

  const feed = priceFeedPubkey(env);
  const data = concatBytes(
    DISC.initialize_pool,
    encodePubkeyBytes(feed.toBytes()),
    encodeU64LE(payoutBps),
    encodeI64LE(minDuration),
    encodeI64LE(maxDuration),
  );

  const ix = new TransactionInstruction({
    programId: programId(env),
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });

  return sendWithWallet(baseConnection(env), wallet, [ix], "base");
}

export async function ensureCallCreated(
  env: PulseEnv,
  wallet: WalletSigner,
): Promise<TimedTxResult | { skipped: true; reason: string }> {
  const call = callPda(env, wallet.publicKey);
  const existing = await fetchProgramAccount(env, call);
  if (existing.exists) {
    return { skipped: true, reason: `Call PDA exists (${call.toBase58()})` };
  }

  const ix = new TransactionInstruction({
    programId: programId(env),
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: call, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(DISC.create_call),
  });

  return sendWithWallet(baseConnection(env), wallet, [ix], "base");
}

export async function delegateCall(
  env: PulseEnv,
  wallet: WalletSigner,
): Promise<TimedTxResult> {
  const call = callPda(env, wallet.publicKey);
  const owner = programId(env);
  // Lazy-load SDK so the UI can boot without Buffer at module-eval time.
  const { createDelegateInstruction } = await import(
    "@magicblock-labs/ephemeral-rollups-sdk"
  );
  const ix = createDelegateInstruction(
    {
      payer: wallet.publicKey,
      delegatedAccount: call,
      ownerProgram: owner,
    },
    {
      seeds: [text.encode(PROGRAM_SEEDS.call), wallet.publicKey.toBytes()],
    },
  );
  return sendWithWallet(baseConnection(env), wallet, [ix], "base");
}

export async function placeCallOnEr(
  env: PulseEnv,
  wallet: WalletSigner,
  direction: CallDirection,
  durationSecs: number,
): Promise<TimedTxResult> {
  const dir = direction === "up" ? 0 : 1;
  const data = concatBytes(
    DISC.place_call,
    u8(dir),
    encodeI64LE(BigInt(durationSecs)),
  );
  const ix = new TransactionInstruction({
    programId: programId(env),
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: poolPda(env), isSigner: false, isWritable: false },
      { pubkey: callPda(env, wallet.publicKey), isSigner: false, isWritable: true },
      { pubkey: priceFeedPubkey(env), isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
  return sendWithWallet(erConnection(env), wallet, [ix], "er");
}

export async function requestPulseOnEr(
  env: PulseEnv,
  wallet: WalletSigner,
  clientSeed = 7,
): Promise<TimedTxResult> {
  const queue = new PublicKey(ephemeralOracleQueueForEnv(env));
  const data = concatBytes(DISC.request_pulse, u8(clientSeed));
  const ix = new TransactionInstruction({
    programId: programId(env),
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: callPda(env, wallet.publicKey), isSigner: false, isWritable: true },
      { pubkey: queue, isSigner: false, isWritable: true },
    ],
    data: Buffer.from(data),
  });
  return sendWithWallet(erConnection(env), wallet, [ix], "er");
}

export async function settleCallOnEr(
  env: PulseEnv,
  wallet: WalletSigner,
): Promise<TimedTxResult> {
  const ix = new TransactionInstruction({
    programId: programId(env),
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: callPda(env, wallet.publicKey), isSigner: false, isWritable: true },
      { pubkey: priceFeedPubkey(env), isSigner: false, isWritable: false },
    ],
    data: Buffer.from(DISC.settle_call),
  });
  return sendWithWallet(erConnection(env), wallet, [ix], "er");
}

export async function resetCallOnEr(
  env: PulseEnv,
  wallet: WalletSigner,
): Promise<TimedTxResult> {
  const ix = new TransactionInstruction({
    programId: programId(env),
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: false },
      { pubkey: callPda(env, wallet.publicKey), isSigner: false, isWritable: true },
    ],
    data: Buffer.from(DISC.reset_call),
  });
  return sendWithWallet(erConnection(env), wallet, [ix], "er");
}

export function formatRawPrice(raw: bigint, exponent = -8): string {
  const scale = Math.abs(exponent);
  if (scale === 0) return raw.toString();
  const neg = raw < 0n;
  const abs = neg ? -raw : raw;
  const denom = 10n ** BigInt(scale);
  const whole = abs / denom;
  const frac = (abs % denom).toString().padStart(scale, "0").replace(/0+$/, "");
  const body = frac ? `${whole}.${frac}` : whole.toString();
  return neg ? `-${body}` : body;
}

export function getInjectedWallet(): WalletSigner | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const provider = (window as any).solana || (window as any).phantom?.solana;
  if (!provider?.publicKey || !provider.signTransaction) return null;
  return {
    publicKey: new PublicKey(provider.publicKey.toString()),
    signTransaction: (tx: Transaction) => provider.signTransaction(tx),
  };
}
