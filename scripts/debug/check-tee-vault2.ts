import { getAuthToken, permissionPdaFromAccount } from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import {
  contentsPda,
  hintsPda,
  housePda,
  poolPda,
  solanaProvider,
  TEE_RPC,
} from "../lib/env";

async function main() {
  const { wallet, program, connection } = solanaProvider();
  const house = housePda();
  const houseAcct = await (program.account as any).house.fetch(house);
  const vault = houseAcct.activeVault as PublicKey;
  const contents = contentsPda(vault);
  const hints = hintsPda(vault);
  const pool = poolPda(house);
  const contentsPerm = permissionPdaFromAccount(contents);
  const poolPerm = permissionPdaFromAccount(pool);

  console.log({ vault: vault.toBase58(), contents: contents.toBase58(), pool: pool.toBase58() });

  for (const [n, p] of [
    ["vault", vault],
    ["hints", hints],
    ["contents", contents],
    ["pool", pool],
    ["contentsPerm", contentsPerm],
    ["poolPerm", poolPerm],
  ] as const) {
    const b = await connection.getAccountInfo(p);
    console.log(
      "base",
      n,
      b ? { owner: b.owner.toBase58().slice(0, 12), len: b.data.length } : null,
    );
  }

  const { token } = await getAuthToken(
    TEE_RPC,
    wallet.publicKey,
    async (m) => nacl.sign.detached(m, wallet.secretKey),
  );
  const tee = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");
  for (const [n, p] of [
    ["vault", vault],
    ["hints", hints],
    ["contents", contents],
    ["pool", pool],
    ["contentsPerm", contentsPerm],
    ["poolPerm", poolPerm],
  ] as const) {
    const b = await tee.getAccountInfo(p);
    console.log(
      "tee",
      n,
      b ? { owner: b.owner.toBase58().slice(0, 12), len: b.data.length, lamports: b.lamports } : null,
    );
  }
}

main().catch(console.error);
