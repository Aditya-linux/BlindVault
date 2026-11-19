/**
 * Localnet smoke: init_profile → create/join battle → submit moves → settle.
 * Does NOT fake VRF/mint success. Capture path needs MagicBlock VRF queue.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { createHash } from "node:crypto";

const RPC = process.env.SOLANA_RPC_URL ?? "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey(
  process.env.VITE_PROGRAM_ID ?? "6ArbPTyE8Qa1hZNrMb7JLaC6UZ8iKH3ic8i3xn6ApeMD",
);

function loadKeypair() {
  const path = join(homedir(), ".config", "solana", "id.json");
  const secret = JSON.parse(readFileSync(path, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function discriminator(name) {
  const preimage = `global:${name}`;
  return createHash("sha256").update(preimage).digest().subarray(0, 8);
}

function u64le(n) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(n));
  return buf;
}

function u8(n) {
  return Buffer.from([n]);
}

function u32le(n) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(n);
  return buf;
}

function pda(seeds) {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID);
}

async function sendIx(connection, payer, keys, name, data) {
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: Buffer.concat([discriminator(name), data]),
  });
  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: "confirmed",
  });
  return sig;
}

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const payer = loadKeypair();
  const playerB = Keypair.generate();

  const airdrop = await connection.requestAirdrop(playerB.publicKey, 2e9);
  await connection.confirmTransaction(airdrop, "confirmed");

  console.log("RPC", RPC);
  console.log("PROGRAM", PROGRAM_ID.toBase58());
  console.log("PLAYER_A", payer.publicKey.toBase58());
  console.log("PLAYER_B", playerB.publicKey.toBase58());

  const [profileA] = pda([Buffer.from("profile"), payer.publicKey.toBuffer()]);
  const [profileB] = pda([Buffer.from("profile"), playerB.publicKey.toBuffer()]);

  const initA = await sendIx(
    connection,
    payer,
    [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: profileA, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    "init_profile",
    Buffer.alloc(0),
  );
  console.log("PASS init_profile A", initA);

  const initBTx = new Transaction().add(
    new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: playerB.publicKey, isSigner: true, isWritable: true },
        { pubkey: profileB, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([discriminator("init_profile")]),
    }),
  );
  const initB = await sendAndConfirmTransaction(connection, initBTx, [playerB], {
    commitment: "confirmed",
  });
  console.log("PASS init_profile B", initB);

  const matchId = BigInt(Date.now() % 1_000_000_000);
  const [battle] = pda([Buffer.from("battle"), u64le(matchId)]);

  const createSig = await sendIx(
    connection,
    payer,
    [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: battle, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    "create_battle",
    Buffer.concat([u64le(matchId), u8(0)]),
  );
  console.log("PASS create_battle", createSig);

  const joinTx = new Transaction().add(
    new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: playerB.publicKey, isSigner: true, isWritable: false },
        { pubkey: battle, isSigner: false, isWritable: true },
      ],
      data: Buffer.concat([discriminator("join_battle"), u64le(matchId), u8(1)]),
    }),
  );
  const joinSig = await sendAndConfirmTransaction(connection, joinTx, [playerB], {
    commitment: "confirmed",
  });
  console.log("PASS join_battle", joinSig);

  // After join, sequence starts at 1; higher speed goes first (species 1 spd 14 > 0 spd 10 → B first).
  let sequence = 1;
  const actors = [
    { kp: playerB, label: "B" },
    { kp: payer, label: "A" },
    { kp: playerB, label: "B" },
    { kp: payer, label: "A" },
    { kp: playerB, label: "B" },
    { kp: payer, label: "A" },
  ];

  for (const actor of actors) {
    const moveTx = new Transaction().add(
      new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: actor.kp.publicKey, isSigner: true, isWritable: false },
          { pubkey: battle, isSigner: false, isWritable: true },
        ],
        data: Buffer.concat([
          discriminator("submit_move"),
          u64le(matchId),
          u8(0),
          u32le(sequence),
        ]),
      }),
    );
    const sig = await sendAndConfirmTransaction(connection, moveTx, [actor.kp], {
      commitment: "confirmed",
    });
    console.log(`PASS submit_move ${actor.label} seq=${sequence}`, sig);
    sequence += 1;
  }

  const battleInfo = await connection.getAccountInfo(battle);
  if (!battleInfo) throw new Error("battle account missing");
  // status byte roughly after fixed fields — settle if finished; otherwise keep swinging.
  // Safer: keep submitting until settle succeeds.
  let settled = false;
  for (let i = 0; i < 20 && !settled; i++) {
    try {
      const settleTx = new Transaction().add(
        new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            { pubkey: payer.publicKey, isSigner: true, isWritable: false },
            { pubkey: battle, isSigner: false, isWritable: true },
            { pubkey: profileA, isSigner: false, isWritable: true },
            { pubkey: profileB, isSigner: false, isWritable: true },
          ],
          data: Buffer.concat([discriminator("settle_battle"), u64le(matchId)]),
        }),
      );
      const settleSig = await sendAndConfirmTransaction(connection, settleTx, [payer], {
        commitment: "confirmed",
      });
      console.log("PASS settle_battle", settleSig);
      settled = true;
    } catch {
      const moveTx = new Transaction().add(
        new TransactionInstruction({
          programId: PROGRAM_ID,
          keys: [
            {
              pubkey: sequence % 2 === 1 ? playerB.publicKey : payer.publicKey,
              isSigner: true,
              isWritable: false,
            },
            { pubkey: battle, isSigner: false, isWritable: true },
          ],
          data: Buffer.concat([
            discriminator("submit_move"),
            u64le(matchId),
            u8(0),
            u32le(sequence),
          ]),
        }),
      );
      const signer = sequence % 2 === 1 ? playerB : payer;
      await sendAndConfirmTransaction(connection, moveTx, [signer], {
        commitment: "confirmed",
      });
      console.log(`PASS submit_move continue seq=${sequence}`);
      sequence += 1;
    }
  }

  if (!settled) throw new Error("settle_battle did not succeed");
  console.log("SMOKE_PASS localnet battle path");
}

main().catch((err) => {
  console.error("SMOKE_FAIL", err);
  process.exit(1);
});
