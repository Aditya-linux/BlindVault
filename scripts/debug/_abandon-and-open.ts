/**
 * End active vault (0 bids → Abandoned) → finalize_abandoned → stretch timing → open next.
 */
import { AnchorProvider, BN, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  DELEGATION_PROGRAM_ID,
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAuthToken,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../../target/idl/blind_vault.json";
import { associatedTokenAddress } from "../lib/ata";
import {
  contentsPda,
  hintsPda,
  housePda,
  poolPda,
  solanaProvider,
  TEE_RPC,
  vaultPda,
} from "../lib/env";

function statusName(status: unknown): string {
  if (status && typeof status === "object") {
    return Object.keys(status as object)[0] ?? "unknown";
  }
  return String(status);
}

async function main() {
  const { program, wallet, connection } = solanaProvider();
  const house = housePda();
  let houseAcct = await (program.account as any).house.fetch(house);
  const vaultPk = houseAcct.activeVault as PublicKey;

  if (!vaultPk.equals(PublicKey.default)) {
    const { token } = await getAuthToken(
      TEE_RPC,
      wallet.publicKey,
      async (msg) => nacl.sign.detached(msg, wallet.secretKey),
    );
    const tee = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");
    const teeProgram = new Program(
      idl as Idl,
      new AnchorProvider(tee, new Wallet(wallet), { commitment: "confirmed" }),
    );
    let vault = await (teeProgram.account as any).vault.fetch(vaultPk);
    let st = statusName(vault.status);
    const left = Number(vault.deadlineTs) - Math.floor(Date.now() / 1000);
    console.log("active", vaultPk.toBase58(), st, "left", left);

    if (st === "open") {
      if (left > 0) {
        console.log(`waiting ${left + 2}s for deadline…`);
        await new Promise((r) => setTimeout(r, (left + 2) * 1000));
      }
      const remaining = [];
      for (let i = 0; i < vault.bidCount; i++) {
        /* none expected */
      }
      const endSig = await (teeProgram.methods as any)
        .endAuction()
        .accounts({ vault: vaultPk })
        .remainingAccounts(remaining)
        .rpc();
      console.log("end_auction", endSig);
      vault = await (teeProgram.account as any).vault.fetch(vaultPk);
      st = statusName(vault.status);
      console.log("after end", st);
    }

    if (st === "abandoned" || st === "ended") {
      if (st === "ended") {
        const contents = contentsPda(vaultPk);
        const poolLedger = poolPda(house);
        const rev = await (teeProgram.methods as any)
          .revealContents()
          .accounts({
            vault: vaultPk,
            contents,
            poolLedger,
            contentsPermission: permissionPdaFromAccount(contents),
            ephemeralVault: EPHEMERAL_VAULT_ID,
            magicProgram: MAGIC_PROGRAM_ID,
            permissionProgram: PERMISSION_PROGRAM_ID,
          })
          .rpc();
        console.log("reveal", rev);
      }
      try {
        const fin = await (program.methods as any)
          .finalizeAbandoned()
          .accounts({
            authority: wallet.publicKey,
            house,
            vault: vaultPk,
          })
          .rpc();
        console.log("finalize_abandoned", fin);
      } catch (e: any) {
        console.log("finalize_abandoned", e.message?.slice?.(0, 200));
        const fin2 = await (program.methods as any)
          .finalize()
          .accounts({
            authority: wallet.publicKey,
            house,
            vault: vaultPk,
            poolLedger: poolPda(house),
          })
          .rpc();
        console.log("finalize", fin2);
      }
    }
  }

  const timingSig = await (program.methods as any)
    .updateHouseTiming(
      [new BN(5_000_000), new BN(8_000_000), new BN(12_000_000)],
      [new BN(10_000_000), new BN(25_000_000), new BN(50_000_000)],
      [new BN(1200), new BN(1200), new BN(1200)],
    )
    .accounts({ authority: wallet.publicKey, house })
    .rpc();
  console.log("update_house_timing", timingSig);

  // Open next vault via open-vault flow (inline minimal)
  houseAcct = await (program.account as any).house.fetch(house);
  if (!(houseAcct.activeVault as PublicKey).equals(PublicKey.default)) {
    throw new Error("active vault still set after finalize");
  }
  console.log("ready for open-vault — next id", Number(houseAcct.nextVaultId));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
