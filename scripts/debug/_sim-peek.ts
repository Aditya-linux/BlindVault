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
import idl from "../../target/idl/blind_vault.json";
import { associatedTokenAddress } from "../lib/ata";
import {
  contentsPda,
  housePda,
  poolPda,
  solanaProvider,
  TEE_RPC,
} from "../lib/env";

async function main() {
  const { program, wallet, connection } = solanaProvider();
  const house = housePda();
  const h = await (program.account as any).house.fetch(house);
  const vaultPk = h.activeVault as PublicKey;
  const scripMint = h.scripMint as PublicKey;
  const treasury = h.treasury as PublicKey;
  const contents = contentsPda(vaultPk);
  const poolLedger = poolPda(house);
  const buyerScrip = associatedTokenAddress(scripMint, wallet.publicKey);
  const peek = PublicKey.findProgramAddressSync(
    [Buffer.from("peek"), vaultPk.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId,
  )[0];

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

  for (const [n, pk] of [
    ["lot", vaultPk],
    ["contents", contents],
    ["pool", poolLedger],
    ["peek", peek],
    ["buyerScrip", buyerScrip],
    ["treasury", treasury],
    ["perm", permissionPdaFromAccount(peek)],
  ] as const) {
    const teeInfo = await tee.getAccountInfo(pk);
    const solInfo = await connection.getAccountInfo(pk);
    console.log(
      n,
      pk.toBase58().slice(0, 10),
      "tee=",
      teeInfo
        ? `owner=${teeInfo.owner.toBase58().slice(0, 8)} len=${teeInfo.data.length}`
        : "MISS",
      "sol=",
      solInfo
        ? `owner=${solInfo.owner.toBase58().slice(0, 8)} len=${solInfo.data.length}`
        : "MISS",
    );
  }

  try {
    const ix = await (teeProgram.methods as any)
      .buyPeek()
      .accounts({
        buyer: wallet.publicKey,
        lot: vaultPk,
        contents,
        poolLedger,
        peek,
        peekPermission: permissionPdaFromAccount(peek),
        buyerScrip,
        treasury,
        ephemeralVault: EPHEMERAL_VAULT_ID,
        magicProgram: MAGIC_PROGRAM_ID,
        permissionProgram: PERMISSION_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction();
    const keys = ix.keys.map(
      (k: { pubkey: PublicKey; isWritable: boolean; isSigner: boolean }) =>
        `${k.pubkey.toBase58().slice(0, 10)} w=${k.isWritable} s=${k.isSigner}`,
    );
    console.log("keys\n" + keys.join("\n"));
    await (teeProgram.methods as any)
      .buyPeek()
      .accounts({
        buyer: wallet.publicKey,
        lot: vaultPk,
        contents,
        poolLedger,
        peek,
        peekPermission: permissionPdaFromAccount(peek),
        buyerScrip,
        treasury,
        ephemeralVault: EPHEMERAL_VAULT_ID,
        magicProgram: MAGIC_PROGRAM_ID,
        permissionProgram: PERMISSION_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .simulate();
    console.log("simulate OK");
  } catch (e: any) {
    console.log("SIM FAIL", e.message?.slice?.(0, 400));
    const logs =
      e.simulationResponse?.logs ??
      (e.getLogs ? await e.getLogs() : e.logs);
    if (logs) console.log(logs.slice(-30).join("\n"));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
