/**
 * Drive the live Open vault through hints → end → reveal → close → finalize.
 * Usage: npx tsx scripts/demo-round.ts [--vault <pubkey>]
 */
import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  getAuthToken,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
// close_round needs permission PDAs + ephemeral vault (see keeper)
import { Connection, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../target/idl/blind_vault.json";
import {
  contentsPda,
  hintsPda,
  housePda,
  poolPda,
  solanaProvider,
  TEE_RPC,
} from "./lib/env";

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return null;
}

function statusName(status: unknown): string {
  if (status && typeof status === "object") {
    return Object.keys(status as object)[0] ?? "?";
  }
  return String(status);
}

async function main() {
  const { program, wallet, connection } = solanaProvider();
  const house = housePda();
  const houseAcct = await (program.account as any).house.fetch(house);
  const vaultPk = new PublicKey(
    arg("vault") ?? (houseAcct.activeVault as PublicKey).toBase58(),
  );
  const hints = hintsPda(vaultPk);
  const contents = contentsPda(vaultPk);
  const poolLedger = poolPda(house);

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

  const tick = async () => {
    const vault = await (teeProgram.account as any).vault.fetch(vaultPk);
    const st = statusName(vault.status);
    const now = Math.floor(Date.now() / 1000);
    console.log(`[demo] status=${st} bids=${vault.bidCount} left=${Number(vault.deadlineTs) - now}s`);

    if (st === "open") {
      const hintsAcct = await (teeProgram.account as any).vaultHints.fetch(hints);
      for (let i = 0; i < 4; i++) {
        if (hintsAcct.hints[i].released) continue;
        if (now < Number(vault.hintTimes[i])) continue;
        try {
          const sig = await (teeProgram.methods as any)
            .publishHint(i)
            .accounts({ vault: vaultPk, hints, contents, poolLedger })
            .rpc();
          console.log("publish_hint", i, sig);
        } catch (e) {
          console.log("publish_hint skip", i, String(e).slice(0, 100));
        }
      }
      if (now >= Number(vault.deadlineTs)) {
        const sig = await (teeProgram.methods as any)
          .endAuction()
          .accounts({ vault: vaultPk })
          .rpc();
        console.log("end_auction", sig);
      }
      return false;
    }

    if (st === "ended" || st === "abandoned") {
      const sig = await (teeProgram.methods as any)
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
      console.log("reveal_contents", sig);
      return false;
    }

    if (st === "revealed") {
      // No bids → closed_bid_count already 0 == bid_count
      const closeSig = await (teeProgram.methods as any)
        .closeRound()
        .accounts({
          payer: wallet.publicKey,
          vault: vaultPk,
          hints,
          contents,
          poolLedger,
          contentsPermission: permissionPdaFromAccount(contents),
          poolPermission: permissionPdaFromAccount(poolLedger),
          ephemeralVault: EPHEMERAL_VAULT_ID,
          permissionProgram: PERMISSION_PROGRAM_ID,
        })
        .rpc();
      console.log("close_round", closeSig);
      return false;
    }

    if (st === "closed") {
      // Wait for undelegation back to Solana
      for (let i = 0; i < 30; i++) {
        const info = await connection.getAccountInfo(vaultPk);
        if (info && info.owner.equals(program.programId)) {
          console.log("vault undelegated on Solana");
          break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      try {
        const sig = await (program.methods as any)
          .finalizeAbandoned()
          .accounts({ house, vault: vaultPk })
          .rpc();
        console.log("finalize_abandoned", sig);
      } catch (e) {
        console.log("finalize_abandoned", String(e).slice(0, 200));
      }
      return true;
    }

    if (st === "settled") {
      console.log("ROUND COMPLETE");
      return true;
    }
    return false;
  };

  for (;;) {
    const done = await tick();
    if (done) break;
    await new Promise((r) => setTimeout(r, 3000));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
