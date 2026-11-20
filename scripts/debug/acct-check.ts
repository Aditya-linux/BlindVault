import { getAuthToken } from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import {
  contentsPda,
  housePda,
  poolPda,
  solanaProvider,
  TEE_RPC,
} from "../lib/env";

async function main() {
  const { wallet, connection, program } = solanaProvider();
  const house = housePda();
  const pool = poolPda(house);
  const vault = new PublicKey("8pDt6MpKZYgHtCBFq3ubSHiMPuF13tdD1avwVCp2VQQK");
  const contents = contentsPda(vault);

  for (const [n, p] of [
    ["pool", pool],
    ["vault", vault],
    ["contents", contents],
  ] as const) {
    const i = await connection.getAccountInfo(p);
    console.log(
      "base",
      n,
      i
        ? { owner: i.owner.toBase58(), len: i.data.length, lamports: i.lamports }
        : null,
    );
  }

  const { token } = await getAuthToken(
    TEE_RPC,
    wallet.publicKey,
    async (m) => nacl.sign.detached(m, wallet.secretKey),
  );
  const tee = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");
  for (const [n, p] of [
    ["pool", pool],
    ["vault", vault],
    ["contents", contents],
  ] as const) {
    const i = await tee.getAccountInfo(p);
    console.log(
      "tee",
      n,
      i
        ? { owner: i.owner.toBase58(), len: i.data.length, lamports: i.lamports }
        : null,
    );
  }

  try {
    const pl = await (program.account as any).poolLedger.fetch(pool);
    console.log("solana poolLedger.itemCount", pl.itemCount);
  } catch (e: any) {
    console.log("solana pool fetch fail", String(e).slice(0, 200));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
