import {
  EPHEMERAL_SPL_TOKEN_PROGRAM_ID,
  getAuthToken,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import { associatedTokenAddress } from "../lib/ata";
import { housePda, solanaProvider, TEE_RPC } from "../lib/env";

async function main() {
  const { wallet, connection, program } = solanaProvider();
  const house = housePda();
  const h = await (program.account as any).house.fetch(house);
  const mint = h.scripMint as PublicKey;
  const vault = h.activeVault as PublicKey;
  const userAta = associatedTokenAddress(mint, wallet.publicKey);
  const vaultAta = associatedTokenAddress(mint, vault, true);
  const userEata = PublicKey.findProgramAddressSync(
    [wallet.publicKey.toBuffer(), mint.toBuffer()],
    EPHEMERAL_SPL_TOKEN_PROGRAM_ID,
  )[0];
  const vaultEata = PublicKey.findProgramAddressSync(
    [vault.toBuffer(), mint.toBuffer()],
    EPHEMERAL_SPL_TOKEN_PROGRAM_ID,
  )[0];
  console.log(
    JSON.stringify(
      {
        vault: vault.toBase58(),
        userAta: userAta.toBase58(),
        vaultAta: vaultAta.toBase58(),
        userEata: userEata.toBase58(),
        vaultEata: vaultEata.toBase58(),
      },
      null,
      2,
    ),
  );
  for (const [n, p] of [
    ["userAta", userAta],
    ["vaultAta", vaultAta],
    ["userEata", userEata],
    ["vaultEata", vaultEata],
  ] as const) {
    const i = await connection.getAccountInfo(p);
    console.log(
      "base",
      n,
      i ? { owner: i.owner.toBase58().slice(0, 12), len: i.data.length } : null,
    );
  }
  const { token } = await getAuthToken(
    TEE_RPC,
    wallet.publicKey,
    async (m) => nacl.sign.detached(m, wallet.secretKey),
  );
  const tee = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");
  for (const [n, p] of [
    ["userAta", userAta],
    ["vaultAta", vaultAta],
    ["userEata", userEata],
    ["vaultEata", vaultEata],
  ] as const) {
    const i = await tee.getAccountInfo(p);
    console.log(
      "tee",
      n,
      i
        ? {
            owner: i.owner.toBase58().slice(0, 12),
            len: i.data.length,
            data0: Buffer.from(i.data).subarray(0, 16).toString("hex"),
          }
        : null,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
