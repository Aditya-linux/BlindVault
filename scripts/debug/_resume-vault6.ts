import { AnchorProvider, Idl, Program, Wallet } from "@coral-xyz/anchor";
import {
  getAuthToken,
  permissionPdaFromAccount,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import idl from "../../target/idl/blind_vault.json";
import {
  contentsPda,
  hintsPda,
  housePda,
  poolPda,
  solanaProvider,
  TEE_RPC,
} from "../lib/env";

async function main() {
  const { program, wallet } = solanaProvider();
  const house = housePda();
  const h = await (program.account as any).house.fetch(house);
  const vault = h.activeVault as PublicKey;
  const hints = hintsPda(vault);
  const contents = contentsPda(vault);
  const poolLedger = poolPda(house);

  const { token } = await getAuthToken(
    TEE_RPC,
    wallet.publicKey,
    async (m) => nacl.sign.detached(m, wallet.secretKey),
  );
  const tee = new Connection(`${TEE_RPC}?token=${token}`, "confirmed");
  const teeProgram = new Program(
    idl as Idl,
    new AnchorProvider(tee, new Wallet(wallet), { commitment: "confirmed" }),
  );

  for (const [n, p] of [
    ["vault", vault],
    ["hints", hints],
    ["contents", contents],
    ["pool", poolLedger],
    ["poolPerm", permissionPdaFromAccount(poolLedger)],
    ["contentsPerm", permissionPdaFromAccount(contents)],
  ] as const) {
    const i = await tee.getAccountInfo(p);
    console.log(
      n,
      i
        ? {
            owner: i.owner.toBase58().slice(0, 12),
            len: i.data.length,
            lamports: i.lamports,
          }
        : null,
    );
  }

  let v = await (teeProgram.account as any).vault.fetch(vault);
  console.log("status", Object.keys(v.status)[0]);

  if (Object.keys(v.status)[0] === "delegated") {
    const seed = 42;
    try {
      const fillSig = await (teeProgram.methods as any)
        .fillVault(seed)
        .accounts({ vault, hints, contents, poolLedger })
        .rpc();
      console.log("fill_vault", fillSig);
    } catch (e: any) {
      console.log("fill ERR", e.message?.slice(0, 400));
      if (e.getLogs) console.log((await e.getLogs()).slice(-15));
      process.exit(1);
    }
  }

  v = await (teeProgram.account as any).vault.fetch(vault);
  console.log("DONE", {
    status: Object.keys(v.status)[0],
    items: v.itemCount,
    deadline: Number(v.deadlineTs),
    minBid: Number(v.minBid) / 1e6,
    left: Number(v.deadlineTs) - Math.floor(Date.now() / 1000),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
