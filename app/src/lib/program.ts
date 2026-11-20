import { AnchorProvider, Idl, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "@/idl/blind_vault.json";
import { PROGRAM_ID } from "./connections";

export type BlindVaultProgram = Program<Idl>;

export function programId(): PublicKey {
  return new PublicKey(PROGRAM_ID);
}

export function getProgram(
  connection: Connection,
  wallet: AnchorProvider["wallet"],
): BlindVaultProgram {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  return new Program(idl as Idl, provider);
}

export function getReadonlyProgram(connection: Connection): BlindVaultProgram {
  const wallet = {
    publicKey: PublicKey.default,
    signTransaction: async <T>(tx: T) => tx,
    signAllTransactions: async <T>(txs: T[]) => txs,
  };
  return getProgram(connection, wallet as AnchorProvider["wallet"]);
}
