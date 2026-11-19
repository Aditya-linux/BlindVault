import type { PulseEnv } from "./env";
import { oracleQueueForEnv, PROGRAM_SEEDS } from "./program";

/** Base-chain client. Methods stay explicit — no fake onchain success. */
export class BaseChainClient {
  private readonly env: PulseEnv;

  constructor(env: PulseEnv) {
    this.env = env;
  }

  get rpcUrl(): string {
    return this.env.solanaRpcUrl;
  }

  get network(): string {
    return this.env.network;
  }

  get programId(): string {
    return this.env.programId;
  }

  get oracleQueue(): string {
    return oracleQueueForEnv(this.env);
  }

  get seeds(): typeof PROGRAM_SEEDS {
    return PROGRAM_SEEDS;
  }
}

/** Ephemeral Rollup client. Separate from base RPC by design. */
export class ErChainClient {
  private readonly env: PulseEnv;

  constructor(env: PulseEnv) {
    this.env = env;
  }

  get rpcUrl(): string {
    return this.env.magicblockErRpcUrl;
  }

  get wsUrl(): string {
    return this.env.magicblockErWsUrl;
  }

  get priceFeedId(): string {
    return this.env.priceFeedId;
  }

  /** Live place/settle after delegate should route here, not base RPC. */
  describeCallRoute(): string {
    return `ER calls via ${this.env.magicblockErRpcUrl}; settle/undelegate returns to base.`;
  }
}

export function createChainClients(env: PulseEnv): {
  base: BaseChainClient;
  er: ErChainClient;
} {
  return {
    base: new BaseChainClient(env),
    er: new ErChainClient(env),
  };
}
