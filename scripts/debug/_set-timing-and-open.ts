/**
 * Stretch auction windows, open size-0 vault, fill, then caller runs demo-bid.
 */
import { AnchorProvider, BN, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  DELEGATION_PROGRAM_ID,
  EPHEMERAL_VAULT_ID,
  MAGIC_PROGRAM_ID,
  PERMISSION_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
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

async function main() {
  const { program, wallet, connection } = solanaProvider();
  const house = housePda();

  const timingSig = await (program.methods as any)
    .updateHouseTiming(
      [new BN(5_000_000), new BN(8_000_000), new BN(12_000_000)],
      [new BN(10_000_000), new BN(25_000_000), new BN(50_000_000)],
      [new BN(900), new BN(900), new BN(900)],
    )
    .accounts({ authority: wallet.publicKey, house })
    .rpc();
  console.log("update_house_timing", timingSig);

  const houseAcct = await (program.account as any).house.fetch(house);
  const scripMint = houseAcct.scripMint as PublicKey;
  const vaultId = Number(houseAcct.nextVaultId);
  const vault = vaultPda(house, vaultId);
  const hints = hintsPda(vault);
  const contents = contentsPda(vault);
  const poolLedger = poolPda(house);
  const escrow = associatedTokenAddress(scripMint, vault, true);
  const teeValidator = new PublicKey(
    "MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo",
  );
  const validatorRemaining = [
    { pubkey: teeValidator, isWritable: false, isSigner: false },
  ];

  console.log("creating vault", vaultId, vault.toBase58());
  await (program.methods as any)
    .createVault(0)
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
    .rpc()
    .then((s: string) => console.log("create_vault", s));

  for (const [label, fn] of [
    [
      "delegate_vault",
      () =>
        (program.methods as any)
          .delegateVault()
          .accounts({ authority: wallet.publicKey, house, vault })
          .remainingAccounts(validatorRemaining)
          .rpc(),
    ],
    [
      "delegate_hints",
      () =>
        (program.methods as any)
          .delegateHints()
          .accounts({ authority: wallet.publicKey, house, vault, hints })
          .remainingAccounts(validatorRemaining)
          .rpc(),
    ],
    [
      "delegate_contents",
      () =>
        (program.methods as any)
          .delegateContents()
          .accounts({ authority: wallet.publicKey, house, vault, contents })
          .remainingAccounts(validatorRemaining)
          .rpc(),
    ],
  ] as const) {
    const info = await connection.getAccountInfo(
      label === "delegate_vault"
        ? vault
        : label === "delegate_hints"
          ? hints
          : contents,
    );
    if (info && info.owner.equals(DELEGATION_PROGRAM_ID)) {
      console.log(label, "skipped");
      continue;
    }
    console.log(label, await fn());
  }

  const poolInfo = await connection.getAccountInfo(poolLedger);
  if (!poolInfo || !poolInfo.owner.equals(DELEGATION_PROGRAM_ID)) {
    console.log(
      "delegate_pool",
      await (program.methods as any)
        .delegatePoolLedger()
        .accounts({
          authority: wallet.publicKey,
          house,
          vault,
          poolLedger,
        })
        .remainingAccounts(validatorRemaining)
        .rpc(),
    );
  } else {
    console.log("delegate_pool skipped");
  }

  await new Promise((r) => setTimeout(r, 4000));

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

  try {
    console.log(
      "init_pool_permission",
      await (teeProgram.methods as any)
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
        .rpc(),
    );
  } catch (e: any) {
    console.log("init_pool_permission", e.message?.slice(0, 120));
  }

  try {
    console.log(
      "init_contents_permission",
      await (teeProgram.methods as any)
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
        .rpc(),
    );
  } catch (e: any) {
    console.log("init_contents_permission", e.message?.slice(0, 120));
  }

  const seed = Math.floor(Math.random() * 256);
  console.log(
    "fill_vault",
    await (teeProgram.methods as any)
      .fillVault(seed)
      .accounts({ vault, hints, contents, poolLedger })
      .rpc(),
    "seed",
    seed,
  );

  const opened = await (teeProgram.account as any).vault.fetch(vault);
  console.log("OPEN", {
    vault: vault.toBase58(),
    status: Object.keys(opened.status)[0],
    left: Number(opened.deadlineTs) - Math.floor(Date.now() / 1000),
    minBid: Number(opened.minBid) / 1e6,
    escrow: opened.escrow.toBase58(),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
