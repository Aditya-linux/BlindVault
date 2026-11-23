/**
 * House operator: create → delegate → permissions → fill.
 * Resumes mid-sequence if a vault is already active.
 * Usage: npx tsx scripts/open-vault.ts --size 1
 */
import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  DELEGATION_PROGRAM_ID,
  EPHEMERAL_SPL_TOKEN_PROGRAM_ID,
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAuthToken,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../target/idl/blind_vault.json";
import { associatedTokenAddress } from "./lib/ata";
import {
  contentsPda,
  housePda,
  hintsPda,
  poolPda,
  solanaProvider,
  TEE_RPC,
  vaultPda,
} from "./lib/env";
import { releaseAllReserved } from "./lib/releaseReserved";

function arg(name: string, fallback?: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback ?? null;
}

function eataPdas(owner: PublicKey, mint: PublicKey) {
  const eata = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), mint.toBuffer()],
    EPHEMERAL_SPL_TOKEN_PROGRAM_ID,
  )[0];
  const buffer = PublicKey.findProgramAddressSync(
    [Buffer.from("buffer"), eata.toBuffer()],
    EPHEMERAL_SPL_TOKEN_PROGRAM_ID,
  )[0];
  const record = PublicKey.findProgramAddressSync(
    [Buffer.from("delegation"), eata.toBuffer()],
    DELEGATION_PROGRAM_ID,
  )[0];
  const metadata = PublicKey.findProgramAddressSync(
    [Buffer.from("delegation-metadata"), eata.toBuffer()],
    DELEGATION_PROGRAM_ID,
  )[0];
  return { eata, buffer, record, metadata };
}

function statusName(status: unknown): string {
  if (status && typeof status === "object") {
    return Object.keys(status as object)[0] ?? "unknown";
  }
  return String(status);
}

async function main() {
  const size = Number(arg("size", "1"));
  const { program, wallet, connection } = solanaProvider();
  const house = housePda();
  const houseAcct = await (program.account as any).house.fetch(house);
  const scripMint = houseAcct.scripMint as PublicKey;
  const poolLedger = poolPda(house);
  const teeValidator = new PublicKey(
    "MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo",
  );
  const validatorRemaining = [
    { pubkey: teeValidator, isWritable: false, isSigner: false },
  ];

  let vault: PublicKey;
  let vaultId: number;
  const active = houseAcct.activeVault as PublicKey;

  if (!active.equals(PublicKey.default)) {
    vault = active;
    // Prefer on-chain vault.id when still owned by program; else derive from next-1
    try {
      const v = await (program.account as any).vault.fetch(vault);
      vaultId = Number(v.id);
      console.log("Resuming active vault", vault.toBase58(), "id", vaultId, "status", statusName(v.status));
    } catch {
      vaultId = Number(houseAcct.nextVaultId) - 1;
      console.log("Resuming active vault (delegated/unreadable on base)", vault.toBase58(), "id", vaultId);
    }
  } else {
    vaultId = Number(houseAcct.nextVaultId);
    vault = vaultPda(house, vaultId);
  }

  const hints = hintsPda(vault);
  const contents = contentsPda(vault);
  const escrow = associatedTokenAddress(scripMint, vault, true);
  const eata = eataPdas(vault, scripMint);

  console.log({ size, vaultId, vault: vault.toBase58(), escrow: escrow.toBase58() });

  // 1) create if needed
  const vaultInfo = await connection.getAccountInfo(vault);
  if (!vaultInfo) {
    const createSig = await (program.methods as any)
      .createVault(size)
      .accounts({
        authority: wallet.publicKey,
        house,
        vault,
        hints,
        contents,
        scripMint,
        escrow,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .rpc();
    console.log("create_vault", createSig);
  } else {
    console.log("create_vault skipped (account exists)");
  }

  // 2) Skip eATA overwrite — Model A keeps vault.escrow as the Solana ATA.
  // Live program's init_vault_escrow_eata still rewrites escrow → eATA; don't call it.
  console.log("init_vault_escrow_eata skipped (Model A: escrow stays ATA", escrow.toBase58(), ")");

  // 3) delegate accounts (idempotent-ish: skip if owner already delegation program)
  const DELEG = DELEGATION_PROGRAM_ID;
  async function needsDelegate(pk: PublicKey): Promise<boolean> {
    const info = await connection.getAccountInfo(pk);
    if (!info) return true;
    return !info.owner.equals(DELEG);
  }

  if (await needsDelegate(vault)) {
    const sig = await (program.methods as any)
      .delegateVault()
      .accounts({ authority: wallet.publicKey, house, vault })
      .remainingAccounts(validatorRemaining)
      .rpc();
    console.log("delegate_vault", sig);
  } else {
    console.log("delegate_vault skipped");
  }

  if (await needsDelegate(hints)) {
    const sig = await (program.methods as any)
      .delegateHints()
      .accounts({ authority: wallet.publicKey, house, vault, hints })
      .remainingAccounts(validatorRemaining)
      .rpc();
    console.log("delegate_hints", sig);
  } else {
    console.log("delegate_hints skipped");
  }

  if (await needsDelegate(contents)) {
    const sig = await (program.methods as any)
      .delegateContents()
      .accounts({ authority: wallet.publicKey, house, vault, contents })
      .remainingAccounts(validatorRemaining)
      .rpc();
    console.log("delegate_contents", sig);
  } else {
    console.log("delegate_contents skipped");
  }

  if (await needsDelegate(poolLedger)) {
    const sig = await (program.methods as any)
      .delegatePoolLedger()
      .accounts({ authority: wallet.publicKey, house, vault, poolLedger })
      .remainingAccounts(validatorRemaining)
      .rpc();
    console.log("delegate_pool_ledger", sig);
  } else {
    console.log("delegate_pool_ledger skipped");
  }

  // 4) TEE: wait for clones, then permissions + fill
  const { token } = await getAuthToken(
    TEE_RPC,
    wallet.publicKey,
    async (msg) => nacl.sign.detached(msg, wallet.secretKey),
  );
  const teeConn = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");
  const teeProgram = new Program(
    idl as Idl,
    new AnchorProvider(teeConn, new Wallet(wallet), { commitment: "confirmed" }),
  );

  // Delegation clones are eventually consistent. Private contents and pool
  // accounts can return null to the operator even after they are cloned.
  // Permission initialization and fill below verify that they are usable.
  async function touch(pk: PublicKey, label: string) {
    try {
      const touchSig = await (teeProgram.methods as any)
        .touchAccount()
        .accounts({ account: pk })
        .rpc();
      console.log(`touch_account ${label}`, touchSig);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`touch ${label} skip:`, msg.slice(0, 120));
    }
  }

  for (let i = 0; i < 20; i++) {
    const [vInfo, hInfo] = await Promise.all([
      teeConn.getAccountInfo(vault),
      teeConn.getAccountInfo(hints),
    ]);
    if (vInfo && hInfo) {
      console.log("tee clones ready after", i * 2, "s");
      break;
    }
    if (i === 0) {
      console.log("waiting for TEE clones (vault/hints)…");
    }
    if (!hInfo) await touch(hints, "hints");
    if (!vInfo) await touch(vault, "vault");
    if (i === 19) {
      throw new Error(
        `TEE clone timeout — vault=${!!vInfo} hints=${!!hInfo}`,
      );
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }

  // Skip permission/fill if already Open (resume after a partial success).
  try {
    const existing = await (teeProgram.account as any).vault.fetch(vault);
    if (statusName(existing.status) === "open") {
      console.log("OPEN ok (already)", {
        vault: vault.toBase58(),
        status: "open",
        deadlineTs: Number(existing.deadlineTs),
        itemCount: Number(existing.itemCount),
        minBid: Number(existing.minBid) / 1_000_000,
      });
      process.exit(0);
    }
  } catch (e) {
    console.log("TEE vault status read retry through permission/fill", String(e).slice(0, 120));
  }

  let contentsPermSig: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      contentsPermSig = await (teeProgram.methods as any)
        .initContentsPermission()
        .accounts({
          vault,
          contents,
          contentsPermission: permissionPdaFromAccount(contents),
          ephemeralVault: EPHEMERAL_VAULT_ID,
          magicProgram: MAGIC_PROGRAM_ID,
          permissionProgram: PERMISSION_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("init_contents_permission", contentsPermSig);
      break;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`init_contents_permission retry ${attempt + 1}:`, msg.slice(0, 120));
      await new Promise((r) => setTimeout(r, 3_000));
    }
  }
  if (!contentsPermSig) {
    throw new Error("init_contents_permission failed after retries");
  }

  // Pool permission is kept across rounds (close_round does not close it).
  try {
    const poolPermSig = await (teeProgram.methods as any)
      .initPoolPermission()
      .accounts({
        vault,
        poolLedger,
        poolPermission: permissionPdaFromAccount(poolLedger),
        ephemeralVault: EPHEMERAL_VAULT_ID,
        magicProgram: MAGIC_PROGRAM_ID,
        permissionProgram: PERMISSION_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("init_pool_permission", poolPermSig);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("init_pool_permission skipped:", msg.slice(0, 160));
  }

  // Force-clear without close_round can leave reserved bits set → NotEnoughItems.
  // Sweep free those slots before fill (Devnet only).
  try {
    await releaseAllReserved({
      teeProgram,
      authority: wallet.publicKey,
      house,
      poolLedger,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log("release reserved skip:", msg.slice(0, 160));
  }

  const clientSeed = Math.floor(Math.random() * 256);
  let fillSig: string;
  try {
    fillSig = await (teeProgram.methods as any)
      .fillVault(clientSeed)
      .accounts({ vault, hints, contents, poolLedger })
      .rpc();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/Not enough|NotEnoughItems|6006/i.test(msg)) throw e;
    console.log("fill_vault NotEnoughItems → release reserved + retry");
    await releaseAllReserved({
      teeProgram,
      authority: wallet.publicKey,
      house,
      poolLedger,
    });
    fillSig = await (teeProgram.methods as any)
      .fillVault(clientSeed)
      .accounts({ vault, hints, contents, poolLedger })
      .rpc();
  }
  console.log("fill_vault", fillSig, "seed", clientSeed);

  const opened = await (teeProgram.account as any).vault.fetch(vault);
  console.log("OPEN ok", {
    vault: vault.toBase58(),
    status: statusName(opened.status),
    deadlineTs: Number(opened.deadlineTs),
    itemCount: Number(opened.itemCount),
    minBid: Number(opened.minBid) / 1_000_000,
  });
  // TEE Connection / WS keeps the event loop alive — exit so auto-round continues.
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
