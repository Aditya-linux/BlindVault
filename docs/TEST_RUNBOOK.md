# Blind Vault — detailed test runbook

Devnet / TEE only. No real funds. Goal: prove privacy + auction loop without mocks.

**Addresses**
- Program: `E9UmQYi4gTHyyQ3SK5B4UCpewBnUBFrEc5NqkkAjr42h`
- House: `C7cfsQFawFQkNk6GsRk4LuCtRcUGAg1Ux7mp66EQDDFE`
- SCRIP: `5RMEdwxEqfsdqiuSr658N4M5JFyTSeMC4KcF9b41bWHx`
- TEE: `https://devnet-tee.magicblock.app`
- App: `http://localhost:3000` (or `:3001` if 3000 busy)

---

## 0. Preconditions (5 min)

1. `solana config get` → Devnet (Helius URL if set in `.env`).
2. `solana balance` → ≥ 1 SOL operator wallet.
3. `npm run typecheck` → PASS.
4. `npm run dev` in `app/` → home loads, no red overlay.

**Pass:** app boots; balance OK.

---

## 1. Warehouse (public, no wallet)

1. Open `/warehouse`.
2. Expect `40 items · N sold · live` (not a static catalog).
3. Confirm product images load (`/items/*.jpg`).
4. Sold badges match prior finalize winners (Vault 5: Cracked Die, Pocket Compass, Bead Bracelet).

**Pass:** live Item PDA data + art.  
**Fail:** empty list / “catalog” fallback / broken images.

---

## 2. Paddle onboarding

1. `/paddle` → Connect wallet (Devnet).
2. **Sign guest book** → TEE token stored (no error toast).
3. **Claim 500 SCRIP** → Explorer link; cooldown if already claimed.

**Pass:** wallet + TEE auth + SCRIP.  
**Fail:** guest book error / faucet 429 / wrong cluster.

---

## 3. Operator: open a fresh vault (script)

```bash
# optional short window for testing (e.g. 180s) then:
npx tsx scripts/open-vault.ts --size 0
npx tsx scripts/debug/_vault-status.ts
```

**Pass:** status `open`, `left > 0`, `minBid` set, vault id increments.  
**Note:** pool permission may already exist — script skips and continues to fill.

---

## 4. Live Vault UI

1. Home → **Enter lot N** (or `/vault/N`).
2. Countdown ticking; status Open.
3. Hints appear as schedule unlocks (or after `publish_hint`).
4. Without guest book: private reads fail politely.

**Pass:** live vault from `/api/vault/[id]`, not frozen Solana clone.

---

## 5. Sealed bid (script or UI)

```bash
npx tsx scripts/demo-bid.ts --amount 25
```

Or UI: set amount ≥ min → place bid → “envelope sealed”.

**Pass:** `bid_count` increments; only your TEE token can read your Bid.  
**Snoop check:** another wallet / bare TEE RPC → ACCESS DENIED on Bid PDA.

---

## 6. WOW — paid private peek (different eyes)

```bash
npx tsx scripts/debug/_buy-peek.ts
npx tsx scripts/debug/_verify-peek.ts
```

Or UI Live Vault → buy peek (fee on Solana → `buy_peek` on TEE).

**Pass criteria (judge killer):**
1. Fee tx on **Solana** (treasury SCRIP).
2. `buy_peek` on **TEE**; Peek PDA exists with slot/rarity/category for **you**.
3. Same Peek without TEE token → **ACCESS DENIED**.
4. `peeksSold` increments on vault.

---

## 7. Proof board snoop

1. `/vault/N/proof` → **Try the magnifying glass**.
2. Before reveal: VaultContents → ACCESS DENIED.
3. Exhibits list real sigs from `data/exhibits.json` (no fake “pending” placeholders as proof).

**Pass:** denied while sealed; exhibits are real explorers links.

---

## 8. Hints → end → reveal → settle → finalize

```bash
# After deadline (or short-window vault):
npx tsx scripts/debug/_finish-v8-settle.ts   # settle+close+finalize if already revealed
# Or full poller (fixed Model A settle accounts):
npx tsx scripts/debug/_e2e-finish-v8.ts
npx tsx scripts/demo-round.ts
```

**Settle account gotcha (Model A):** `escrow` = winner SCRIP ATA; `treasury` sink on TEE = **operator ATA** (house treasury ATA often unwritable / “cannot be written”).

**Expected order:**
1. `publish_hint` 0–3 as times unlock  
2. `end_auction` (after deadline; remaining = all Bid accounts)  
3. `reveal_contents`  
4. Winner: `settle_winning_bid`  
5. Losers: `refund_bid` (if multi-bidder)  
6. `close_peek` for each peek sold  
7. `close_round` (commit + undelegate)  
8. Wait vault owner = program on Solana  
9. `release_pool_items` (if needed) + `finalize`  
10. Warehouse sold flags + `/me` inventory update  

**Pass:** winner holds item SPL; house `active_vault` cleared; status Settled.  
**Abandon path:** 0 bids → `finalize_abandoned` (must `close_peek` first if peeksSold > 0).

---

## 9. Negative / honesty checks

| Check | Expected |
|-------|----------|
| Bid below min | Rejected |
| Bid after deadline | Rejected |
| Finalize while still delegated | `NotUndelegated` |
| close_round with open peeks | `UnclosedPeeks` (6028) |
| Bare TEE read of private Peek/Bid/Contents | no data / denied |
| Claim “VRF fill” | **Do not** — fill is TEE-local entropy until ER VRF verified |

---

## 10. Demo reel checklist (≤3 min)

1. Warehouse art + sold tags  
2. Guest book  
3. Live vault countdown  
4. Seal bid  
5. Paid peek + “only you see this”  
6. Snoop denied on Proof  
7. Reveal receipt / finalize Explorer  

Record Explorer tabs with **auth tokens stripped**.

---

## Quick script map

| Intent | Command |
|--------|---------|
| Status | `npx tsx scripts/debug/_vault-status.ts` |
| Open lot | `npx tsx scripts/open-vault.ts --size 0` |
| Bid | `npx tsx scripts/demo-bid.ts --amount 25` |
| Peek | `npx tsx scripts/debug/_buy-peek.ts` |
| Verify peek | `npx tsx scripts/debug/_verify-peek.ts` |
| Finish round | `npx tsx scripts/debug/_e2e-finish-v8.ts` or `demo-round.ts` |
| Keeper once | `npx tsx scripts/keeper.ts --once` |

Stamp every PASS sig into `data/exhibits.json` and `docs/BUILD_STATUS.md`.
