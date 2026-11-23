import "server-only";

/** A dedicated Devnet endpoint; never serialize its URL into browser code. */
export function serverSolanaRpc(): string {
  const raw = process.env.SOLANA_RPC || process.env.NEXT_PUBLIC_SOLANA_RPC;
  const url = (raw || "https://api.devnet.solana.com")
    .replace(/^["']|["']$/g, "")
    .replace(/\\r\\n$/g, "")
    .trim();
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !parsed.hostname.includes("devnet")) {
    throw new Error("Server Solana RPC must be an HTTPS Devnet endpoint");
  }
  return url;
}
