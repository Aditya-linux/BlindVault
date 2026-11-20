import { PROGRAM_ID, SOLANA_RPC, TEE_RPC } from "./connections";

/** Strip auth tokens before sharing explorer URLs. */
export function stripToken(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.delete("token");
    return u.toString();
  } catch {
    return url.replace(/([?&])token=[^&]+/, "$1");
  }
}

export function solanaTxUrl(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

export function solanaAccountUrl(pubkey: string): string {
  return `https://explorer.solana.com/address/${pubkey}?cluster=devnet`;
}

export function teeTxUrl(sig: string): string {
  const custom = encodeURIComponent(stripToken(TEE_RPC));
  return `https://solscan.io/tx/${sig}?cluster=custom&customUrl=${custom}`;
}

export function teeAccountUrl(pubkey: string): string {
  const custom = encodeURIComponent(stripToken(TEE_RPC));
  return `https://solscan.io/account/${pubkey}?cluster=custom&customUrl=${custom}`;
}

export function programExplorerUrl(): string {
  return solanaAccountUrl(PROGRAM_ID);
}

export function solanaRpcLabel(): string {
  return stripToken(SOLANA_RPC);
}
