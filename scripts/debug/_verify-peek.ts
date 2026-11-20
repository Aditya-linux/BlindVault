import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import { getAuthToken } from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../../target/idl/blind_vault.json";
import { housePda, itemPda, solanaProvider, TEE_RPC } from "../lib/env";

async function main() {
  const { program, wallet } = solanaProvider();
  const h = await (program.account as any).house.fetch(housePda());
  const vaultPk = h.activeVault as PublicKey;
  const peek = PublicKey.findProgramAddressSync(
    [Buffer.from("peek"), vaultPk.toBuffer(), wallet.publicKey.toBuffer()],
    program.programId,
  )[0];
  const { token } = await getAuthToken(
    TEE_RPC,
    wallet.publicKey,
    async (m) => nacl.sign.detached(m, wallet.secretKey),
  );
  const tee = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");
  const bare = new Connection(TEE_RPC, "confirmed");
  const withTok = await tee.getAccountInfo(peek);
  const noTok = await bare.getAccountInfo(peek);
  console.log("peek", peek.toBase58());
  console.log("with TEE token", withTok ? `len=${withTok.data.length}` : "MISS");
  console.log(
    "snoop no token",
    noTok ? `LEAK len=${noTok.data.length}` : "ACCESS DENIED",
  );
  const teeProgram = new Program(
    idl as Idl,
    new AnchorProvider(tee, new Wallet(wallet), { commitment: "confirmed" }),
  );
  const v = await (teeProgram.account as any).vault.fetch(vaultPk);
  console.log("peeksSold", v.peeksSold, "status", Object.keys(v.status)[0]);
  if (withTok) {
    const d = withTok.data;
    const off = 8 + 32 + 32;
    console.log("slot", d[off], "rarity", d[off + 1], "category", d[off + 2]);
  }

  const count = Number(h.itemCount);
  const sold: { i: number; owner: string; name: string }[] = [];
  for (let i = 0; i < count; i++) {
    const a = await (program.account as any).item.fetchNullable(itemPda(i));
    if (a?.sold) {
      sold.push({
        i,
        owner: (a.owner as PublicKey).toBase58().slice(0, 8),
        name: Buffer.from(a.name as number[])
          .toString("utf8")
          .replace(/\0/g, ""),
      });
    }
  }
  console.log("warehouse sold", sold.length, sold);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
