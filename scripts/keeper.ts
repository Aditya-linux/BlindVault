/**
 * Backup crank: publish due hints → end_auction → reveal → settle/refund →
 * close peeks → close_round → wait commit → finalize.
 * Usage: npx tsx scripts/keeper.ts [--vault <pubkey>] [--once]
 */
import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAuthToken,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
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

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return null;
}

async function main() {
  const { program, wallet, connection } = solanaProvider();
  const house = housePda();
  const houseAcct = await (program.account as any).house.fetch(house);
  const vaultPk = new PublicKey(
    arg("vault") ?? (houseAcct.activeVault as PublicKey).toBase58(),
  );
  if (vaultPk.equals(PublicKey.default)) {
    console.log("No active vault");
    return;
  }

  const { token } = await getAuthToken(
    TEE_RPC,
    wallet.publicKey,
    async (msg) => nacl.sign.detached(msg, wallet.secretKey),
  );
  const teeConn = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");
  const teeProgram = new Program(
    idl as Idl,
    new AnchorProvider(teeConn, new Wallet(wallet), {
      commitment: "confirmed",
    }),
  );

  const hints = hintsPda(vaultPk);
  const contents = contentsPda(vaultPk);
  const poolLedger = poolPda(house);

  const tick = async () => {
    const vault = await (teeProgram.account as any).vault.fetch(vaultPk);
    const status = Object.keys(vault.status)[0];
    const now = Math.floor(Date.now() / 1000);
    console.log(
      `[keeper] vault=${vaultPk.toBase58().slice(0, 8)}… status=${status} bids=${vault.bidCount}`,
    );

    if (status === "open") {
      const hintsAcct = await (teeProgram.account as any).vaultHints.fetch(
        hints,
      );
      for (let i = 0; i < 4; i++) {
        const h = hintsAcct.hints[i];
        if (h.released) continue;
        if (now < Number(vault.hintTimes[i])) continue;
        try {
          const sig = await (teeProgram.methods as any)
            .publishHint(i)
            .accounts({ vault: vaultPk, hints, contents, poolLedger })
            .rpc();
          console.log("publish_hint", i, sig);
        } catch (e) {
          console.log("publish_hint skip", i, String(e).slice(0, 120));
        }
      }

      if (now >= Number(vault.deadlineTs)) {
        const sig = await (teeProgram.methods as any)
          .endAuction()
          .accounts({ vault: vaultPk })
          .rpc();
        console.log("end_auction", sig);
      }
      return;
    }

    if (status === "ended" || status === "abandoned") {
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
      return;
    }

    if (status === "revealed") {
      // settle / refund require per-bid accounts; house wallet can settle winner if known
      if (
        vault.bidCount > 0 &&
        !(vault.winner as PublicKey).equals(PublicKey.default)
      ) {
        try {
          const bid = PublicKey.findProgramAddressSync(
            [
              Buffer.from("bid"),
              vaultPk.toBuffer(),
              (vault.winner as PublicKey).toBuffer(),
            ],
            program.programId,
          )[0];
          const sig = await (teeProgram.methods as any)
            .settleWinningBid()
            .accounts({
              closer: vault.winner,
              lot: vaultPk,
              bid,
              bidPermission: permissionPdaFromAccount(bid),
              escrow: vault.escrow,
              treasury: houseAcct.treasury,
              ephemeralVault: EPHEMERAL_VAULT_ID,
              magicProgram: MAGIC_PROGRAM_ID,
              permissionProgram: PERMISSION_PROGRAM_ID,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();
          console.log("settle_winning_bid", sig);
        } catch (e) {
          console.log("settle skip", String(e).slice(0, 160));
        }
      }

      try {
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
      } catch (e) {
        console.log("close_round skip", String(e).slice(0, 160));
      }
      return;
    }

    if (status === "closed" || status === "settled") {
      // finalize on Solana after undelegation commit — remaining accounts = item ATAs
      console.log(
        "Vault closed/settled on TEE. Run finalize manually once undelegated:",
        vaultPk.toBase58(),
      );
      console.log("Solana RPC", connection.rpcEndpoint);
    }
  };

  await tick();
  if (hasFlag("once")) return;

  console.log("keeper polling every 3s…");
  setInterval(() => {
    void tick().catch((e) => console.error(e));
  }, 3_000);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
