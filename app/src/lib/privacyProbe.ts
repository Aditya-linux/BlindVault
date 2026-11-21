import { Connection, PublicKey } from "@solana/web3.js";
import { teeConnection, teePublic, solana } from "@/lib/connections";
import { contentsPda, peekPda } from "@/lib/pdas";

/** Honest TEE read outcomes — never collapse null into ACCESS DENIED alone. */
export type ProbeOutcome =
  | "authorized"
  | "unauthorized_or_hidden"
  | "not_found"
  | "rpc_error"
  | "needs_auth";

export type AccountProbe = {
  outcome: ProbeOutcome;
  label: string;
  detail: string;
  account: string;
  bytes: number | null;
  /** Supporting fact that the public vault (or base) exists when relevant. */
  existenceHint: string | null;
};

export function outcomeCopy(o: ProbeOutcome): string {
  switch (o) {
    case "authorized":
      return "Authorized read";
    case "unauthorized_or_hidden":
      return "No data returned (likely ACL deny while private)";
    case "not_found":
      return "Account not found";
    case "rpc_error":
      return "RPC / network error";
    case "needs_auth":
      return "Sign the guest book first";
    default: {
      const _exhaustive: never = o;
      return _exhaustive;
    }
  }
}

/**
 * Probe VaultContents under the caller's TEE token.
 * Distinguishes: readable · null while vault exists · vault missing · errors.
 */
export async function probeVaultContents(opts: {
  vaultPk: PublicKey;
  token: string | null;
  vaultStatus: string | null;
}): Promise<AccountProbe> {
  const contents = contentsPda(opts.vaultPk);
  const account = contents.toBase58();

  if (!opts.token) {
    return {
      outcome: "needs_auth",
      label: outcomeCopy("needs_auth"),
      detail: "TEE guest-book token required for authenticated reads.",
      account,
      bytes: null,
      existenceHint: null,
    };
  }

  try {
    const vaultPublic = await teePublic.getAccountInfo(opts.vaultPk);
    const vaultOnBase = vaultPublic
      ? null
      : await solana.getAccountInfo(opts.vaultPk);
    const vaultExists = Boolean(vaultPublic || vaultOnBase);

    const conn = teeConnection(opts.token);
    const info = await conn.getAccountInfo(contents);

    if (info) {
      const revealed =
        opts.vaultStatus === "Revealed" ||
        opts.vaultStatus === "Closed" ||
        opts.vaultStatus === "Settled";
      return {
        outcome: "authorized",
        label: outcomeCopy("authorized"),
        detail: revealed
          ? `VaultContents readable after reveal · ${info.data.length} bytes`
          : `Unexpected readable data while status=${opts.vaultStatus ?? "?"} · ${info.data.length} bytes`,
        account,
        bytes: info.data.length,
        existenceHint: vaultExists
          ? "Public Vault account is present on TEE/base."
          : "Vault account missing on both TEE and base.",
      };
    }

    if (!vaultExists) {
      return {
        outcome: "not_found",
        label: outcomeCopy("not_found"),
        detail:
          "Neither Vault nor VaultContents returned data — lot may not exist on this network.",
        account,
        bytes: null,
        existenceHint: "Vault PDA absent on TEE public RPC and Solana Devnet.",
      };
    }

    // Honest: null alone ≠ cryptographic proof of ACL; with a live vault it is the
    // expected PER behavior for non-members while contents stay private.
    return {
      outcome: "unauthorized_or_hidden",
      label: outcomeCopy("unauthorized_or_hidden"),
      detail:
        "getAccountInfo returned null for VaultContents while the public Vault account exists. " +
        "On MagicBlock PER this is the expected response for a private account you are not permitted to read — " +
        "not proof the PDA was never created.",
      account,
      bytes: null,
      existenceHint: `Vault present · status ${opts.vaultStatus ?? "unknown"} · contents PDA derived`,
    };
  } catch (e) {
    return {
      outcome: "rpc_error",
      label: outcomeCopy("rpc_error"),
      detail: e instanceof Error ? e.message : String(e),
      account,
      bytes: null,
      existenceHint: null,
    };
  }
}

/**
 * Probe a Peek PDA: owner should read; stranger should get null while vault is live.
 */
export async function probePeekAccount(opts: {
  vaultPk: PublicKey;
  owner: PublicKey;
  token: string | null;
  caller: PublicKey | null;
}): Promise<AccountProbe> {
  const peek = peekPda(opts.vaultPk, opts.owner);
  const account = peek.toBase58();
  const isOwner =
    opts.caller !== null && opts.caller.equals(opts.owner);

  if (!opts.token) {
    return {
      outcome: "needs_auth",
      label: outcomeCopy("needs_auth"),
      detail: "Sign guest book, then probe again.",
      account,
      bytes: null,
      existenceHint: null,
    };
  }

  try {
    const conn = teeConnection(opts.token);
    const info = await conn.getAccountInfo(peek);
    if (info) {
      return {
        outcome: "authorized",
        label: outcomeCopy("authorized"),
        detail: isOwner
          ? `Your peek account is readable · ${info.data.length} bytes (ACL member).`
          : `Readable · ${info.data.length} bytes — unexpected if you are not the peek buyer.`,
        account,
        bytes: info.data.length,
        existenceHint: isOwner
          ? "Caller matches peek owner."
          : "Caller is not the peek owner — investigate.",
      };
    }

    return {
      outcome: "unauthorized_or_hidden",
      label: outcomeCopy("unauthorized_or_hidden"),
      detail: isOwner
        ? "Null for your own peek PDA — peek may not exist yet, or session token is wrong. Buy a peek first, then retry."
        : "Null for another wallet's peek PDA while authenticated. Expected PER deny for non-members (or peek never created).",
      account,
      bytes: null,
      existenceHint: isOwner
        ? "Owner probe"
        : `Stranger probe · owner ${opts.owner.toBase58().slice(0, 8)}…`,
    };
  } catch (e) {
    return {
      outcome: "rpc_error",
      label: outcomeCopy("rpc_error"),
      detail: e instanceof Error ? e.message : String(e),
      account,
      bytes: null,
      existenceHint: null,
    };
  }
}

/** Scrub any token query params before showing URLs. */
export function safeRpcLabel(conn: Connection): string {
  try {
    return conn.rpcEndpoint.replace(/([?&])token=[^&]+/g, "$1token=REDACTED");
  } catch {
    return "tee-rpc";
  }
}
