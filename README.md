# Blind Vault

**Storage Wars on Solana — for MagicBlock Solana Blitz v10.**

Sealed lots. Private peeks. Contents stay inside a MagicBlock Private Ephemeral Rollup (TEE) until the gavel falls. Highest sealed bid wins real SPL warehouse collectibles.

> **Entertainment Finance:** trade, collect, compete, and win assets you actually own — with game mechanics on top.

**Submit:** [build.magicblock.app/?stage=blitz#submit](https://build.magicblock.app/?stage=blitz#submit)  
**Hackathon:** Solana Blitz v10 · 20–27 Nov 2026 · [Luma](https://luma.com/hedv5sgh)

---

## Why this exists

Mystery boxes and sealed auctions usually fail trust in two ways:

1. The **house can stack** what’s inside.
2. On a **public chain**, RPC snoops can read contents and bids — so there’s no real mystery.

Blind Vault fixes both with MagicBlock:

| Problem | Blind Vault |
|--------|-------------|
| House picks the lot | Fill happens inside the TEE (entropy mix; ER VRF when verified on `devnet-tee`) |
| Public chain leaks state | Contents, sealed bids, and paid peeks live under **PER ACLs** |
| Hints can lie | Program derives hints from private state on-chain |
| “Win” is just a DB row | Winner receives **real SPL item tokens** after finalize |

### WOW for judges (15 seconds)

Other MagicBlock sealed auctions hide **bids**. Blind Vault also hides the **lot**. Different eyes see different truths. Proof board → magnifying glass → **ACCESS DENIED**. Winner walks with warehouse items.

That’s why MagicBlock is essential — not a sticker.

---

## Live Devnet addresses

| Account | Address |
|--------|---------|
| Program | [`E9UmQYi4gTHyyQ3SK5B4UCpewBnUBFrEc5NqkkAjr42h`](https://explorer.solana.com/address/E9UmQYi4gTHyyQ3SK5B4UCpewBnUBFrEc5NqkkAjr42h?cluster=devnet) |
| House PDA | `C7cfsQFawFQkNk6GsRk4LuCtRcUGAg1Ux7mp66EQDDFE` |
| SCRIP mint | `5RMEdwxEqfsdqiuSr658N4M5JFyTSeMC4KcF9b41bWHx` |
| TEE validator | `MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo` (`devnet-tee.magicblock.app`) |
| Operator | `4qwVufZVGEgY4WB1ALNGUzqd8DRQQk55SiJQL1zZAUy7` |

**Evidence (examples):**

- Vault 5 finalize (full settle loop): [`5Nun4q…`](https://explorer.solana.com/tx/5Nun4qFDYFgv2EQ3Cca7kLz9KRfpFEF96dUTxV8oPMSdUTpHvUcWKLNVVLNzLYtrickVKofjCBuQTHHQWGZFQL8C?cluster=devnet)
- Vault 8 buy_peek (TEE): [`5DnHvB…`](https://explorer.solana.com/tx/5DnHvBaZT3dy71TM47vNch9Zx69cc8bfS8GtNMNA1ySf84HFAgwsgRXPQj1GraV4zgR4F4dKpFNMTUbfzxjZvkKV?cluster=devnet)
- Vault 8 finalize: [`5uobPA…`](https://explorer.solana.com/tx/5uobPAb1N35TujTVvpthMJq3uShP1DJdnGCYUCgujNart5Lg6DQBN8GFkWisrf859t4mW43gvXzreuPQRt753yvP?cluster=devnet)

More signatures: [`data/exhibits.json`](data/exhibits.json) · status: [`docs/BUILD_STATUS.md`](docs/BUILD_STATUS.md)

---

## Stack

- **Base Solana (Devnet):** House, Items, SCRIP mint, faucet, create/delegate vault, finalize
- **MagicBlock PER (`devnet-tee`):** private contents, pool ledger, sealed bids, peeks, hints
- **Client:** Next.js “Rocco’s Lock-Up Auctions” (Warehouse, Live Vault, Reveal, Proof, Me, Paddle)
- **Pinned:** Anchor **1.0.2** · Ephemeral Rollups SDK **0.16.2** (Rust) / TS client for `getAuthToken`

---

## Quick start

```bash
git clone https://github.com/Aditya-linux/BlindVault.git
cd BlindVault
cp .env.example app/.env.local   # set SOLANA_RPC / Helius Devnet if you have one
npm install --legacy-peer-deps
npm run anchor:build             # optional if you already have target/
npm run typecheck
npm run dev                      # http://localhost:3000
```

### Operator scripts (funded Devnet wallet)

```bash
# House already live on the addresses above — only needed for a fresh deploy:
# npm run init:house && npm run seed:items && npm run init:pool

npx tsx scripts/open-vault.ts --size 0
npx tsx scripts/demo-bid.ts --amount 25
npx tsx scripts/debug/_buy-peek.ts
npx tsx scripts/debug/_verify-peek.ts
# after deadline:
npx tsx scripts/debug/_finish-v8-settle.ts
```

Full test path: **[`docs/TEST_RUNBOOK.md`](docs/TEST_RUNBOOK.md)**

---

## Player loop

1. **Warehouse** — browse 40 on-chain items (public, no wallet)
2. **Paddle** — connect wallet → sign TEE guest book → claim SCRIP faucet
3. **Live vault** — read timed hints → seal a bid → optional paid peek
4. **Proof** — snoop VaultContents / others’ peeks → ACCESS DENIED until reveal
5. **Reveal / finalize** — lot opens; winner receives SPL items in wallet

---

## Architecture (short)

```
Solana Devnet                          MagicBlock TEE (devnet-tee)
─────────────────                      ───────────────────────────
House · Items · SCRIP · treasury       Vault · Contents · Hints
create / delegate / finalize           place_bid · buy_peek · publish_hint
item SPL custody                       end → reveal → settle → close_round
                                       commit + undelegate → back to Solana
```

Warehouse / public views work **without** a wallet. Bidding and private reads need wallet + TEE auth.

---

## Honest limits

- **Fill** uses TEE-local entropy (`fill_vault`) until ER VRF on `devnet-tee` is verified (spec §7.5).
- **Devnet / TEE only** — no mainnet, no real funds. SCRIP and items have no real value.
- We do **not** fake PER privacy or VRF success with mocks counted as proof.

---

## Repo map

| Path | Role |
|------|------|
| `programs/blind_vault` | Anchor program |
| `app/` | Next.js UI |
| `data/items.json` | 40 collectibles (+ `app/public/items/*.jpg` art) |
| `data/exhibits.json` | Stamped live tx evidence for Proof board |
| `scripts/` | open-vault, demo-bid, peek, settle, keeper |
| `docs/` | BUILD_STATUS, TEST_RUNBOOK, BLITZ_FORM_DRAFT, CHECKLIST |
| `BLIND_VAULT_SPEC.md` | Full build spec |

---

## Blitz form draft

See [`docs/BLITZ_FORM_DRAFT.md`](docs/BLITZ_FORM_DRAFT.md) for copy-paste fields (name, description, categories, explorer links). Paste public site + demo reel URLs before submit.

---

## License / safety

Built during Solana Blitz v10. Devnet playground. Never commit private keys or `.env` files.
