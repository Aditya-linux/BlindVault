import { Connection } from "@solana/web3.js";

export const SOLANA_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";
export const TEE_RPC =
  process.env.NEXT_PUBLIC_TEE_RPC ?? "https://devnet-tee.magicblock.app";
export const TEE_WS =
  process.env.NEXT_PUBLIC_TEE_WS ?? "wss://devnet-tee.magicblock.app";
export const PROGRAM_ID =
  process.env.NEXT_PUBLIC_PROGRAM_ID ??
  "E9UmQYi4gTHyyQ3SK5B4UCpewBnUBFrEc5NqkkAjr42h";

export const solana = new Connection(SOLANA_RPC, "confirmed");

/** Public TEE RPC — enough for non-permissioned accounts (Vault, Hints). */
export const teePublic = new Connection(TEE_RPC, {
  commitment: "confirmed",
  wsEndpoint: TEE_WS,
});

export function teeConnection(token: string) {
  return new Connection(`${TEE_RPC}?token=${token}`, {
    commitment: "confirmed",
    wsEndpoint: `${TEE_WS}?token=${token}`,
  });
}
