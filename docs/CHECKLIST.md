# Blind Vault — progress checklist

Last updated: 2026-11-20 afternoon — **EVENING CHECKPOINT**. Core MVP live on Devnet/TEE.

**House wallet:** `4qwVufZVGEgY4WB1ALNGUzqd8DRQQk55SiJQL1zZAUy7`  
**Program:** `E9UmQYi4gTHyyQ3SK5B4UCpewBnUBFrEc5NqkkAjr42h`  
**House PDA:** `C7cfsQFawFQkNk6GsRk4LuCtRcUGAg1Ux7mp66EQDDFE`  
**SCRIP mint:** `5RMEdwxEqfsdqiuSr658N4M5JFyTSeMC4KcF9b41bWHx`  
**TEE validator:** `MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo` (`devnet-tee.magicblock.app`)  
**Active Vault 8:** `H7eRknqjXbhho9MKk3vfu7rV4VmqvqNrN4RiXjdjU5VD`  
**RPC:** Helius Devnet URL in gitignored `.env` / `app/.env.local` (do not commit)  
**Blitz submit:** https://build.magicblock.app/?stage=blitz#submit

---

## How to resume this evening (ordered)

1. Check `_e2e-finish-v8.ts` terminal — Vault 8 settle/finalize PASS or re-run it.
2. `npm run dev` → smoke Warehouse / Live lot 8 / Proof snoop / Paddle.
3. Record ≤3 min demo; paste links into `docs/BLITZ_FORM_DRAFT.md`.
4. Deploy public site URL if needed; submit Blitz form (not before demo+URL).
5. Optional: ER VRF fill spike; reveal polish.

Do **not** re-upgrade unless program source changed again.

---

## A. Repo / cleanup

| # | Item | Status | Notes |
|---|------|--------|-------|
| A1 | Remove Pulse Call program (`programs/pulse_call`) | DONE | |
| A2 | Remove Pulse Call Vite/web app | DONE | |
| A3 | Remove pulse-only scripts | DONE | |
| A4 | Rewrite root `package.json` / workspaces for Blind Vault | DONE | workspace: `app` |
| A5 | `AGENTS.md` Blind Vault rules | DONE | Devnet/TEE only, no fake PER/VRF |
| A6 | `README.md` Blind Vault quick start | DONE | |
| A7 | `.gitignore` for `.env`, keypairs, logs | DONE | API key not committed |
| A8 | Pin Anchor 1.0.2 + ER SDK 0.16.2 (Rust) | DONE | TS ER SDK ~0.17+ for `getAuthToken` |

---

## B. On-chain program (`programs/blind_vault`)

| # | Instruction / piece | Status | Notes |
|---|---------------------|--------|-------|
| B1 | `init_house` | DONE + LIVE | House + SCRIP mint + treasury |
| B2 | `add_item` | DONE + LIVE | 40 items minted into pool |
| B3 | `init_pool_ledger` | DONE + LIVE | Used ALT (tx too big without it) |
| B4 | `faucet` | DONE (code) | Not client-e2e proven yet |
| B5 | `create_vault` | CODE FIXED LOCALLY / OLD BINARY LIVE | Live binary still has eATA CPI crash |
| B6 | `init_vault_escrow_eata` | CODE LOCAL only | New ix; needs upgrade |
| B7 | `delegate_vault` / `delegate_hints` / `delegate_contents` / `delegate_pool_ledger` | DONE (code) | Not run end-to-end yet |
| B8 | `init_permissions` | DONE (code) | Private contents + pool |
| B9 | `fill_vault` | DONE (code) | TEE-local entropy mix (R1); **not ER VRF** |
| B10 | `callback_fill_vault` / ER VRF queue | NOT DONE | Spec F3 preferred path; spike later |
| B11 | `publish_hint` + `release_hint` util | DONE (code + unit test) | |
| B12 | `place_bid` + `init_bid_permission` | DONE (code) | Same-tx pattern in client |
| B13 | `buy_peek` / `close_peek` (S1) | DONE + LIVE | Fee on Solana + TEE peek ACL; Vault 7 PASS; UI wired |
| B14 | `end_auction` | DONE (code) | |
| B15 | `reveal_contents` | DONE (code) | |
| B16 | `settle_winning_bid` / `refund_bid` | DONE (code) | |
| B17 | `close_round` (commit+undelegate) | DONE (code) | |
| B18 | `finalize` / `finalize_abandoned` | DONE (code) | Item ATAs as remaining accounts |
| B19 | Unit tests (bitmap, hints, test_id) | PASS | `cargo test -p blind_vault` |
| B20 | `anchor build` → `.so` + IDL | PASS | Rebuild after create_vault fix also PASS |
| B21 | First Devnet deploy | PASS | Slot ~524091745 |
| B22 | Upgrade with create_vault fix | **NEXT (tomorrow)** | Wallet funded ~5.41 SOL |

---

## C. House / Devnet state (live)

| # | Item | Status | Notes |
|---|------|--------|-------|
| C1 | Fund house wallet (first time) | DONE | Then drained by deploy |
| C2 | Helius API key (gitignored) | DONE | Do not commit / paste in docs |
| C3 | Deploy program | DONE | |
| C4 | `01-init-house.ts` | PASS | |
| C5 | `02-seed-items.ts` (40 items) | PASS | |
| C6 | `03-init-pool.ts` (ALT) | PASS | |
| C7 | `open-vault.ts` full sequence | PASS | Vault 7 Open live |
| C8 | `keeper.ts` live round | NOT RUN | |
| C9 | `snoop.ts` live proof | NOT RUN | |
| C10 | Second funding (~5 SOL) | DONE | Ready for upgrade tomorrow |

---

## D. Scripts

| # | Script | Status | Notes |
|---|--------|--------|-------|
| D1 | `scripts/lib/env.ts` + `.env` loader | DONE | |
| D2 | `scripts/lib/ata.ts` | DONE | No `@solana/spl-token` required |
| D3 | `01-init-house.ts` | DONE + PASS | |
| D4 | `02-seed-items.ts` | DONE + PASS | |
| D5 | `03-init-pool.ts` + ALT | DONE + PASS | |
| D6 | `open-vault.ts` | DONE (updated for slim create_vault) | Needs new IDL after upgrade |
| D7 | `keeper.ts` | DONE (scaffold logic) | Needs live vault to prove |
| D8 | `snoop.ts` | DONE | Needs live private accounts |
| D9 | `00-airdrop.ts` | NOT DONE | Spec listed; optional with Helius |
| D10 | `demo-bots.ts` | NOT DONE | Spec optional |

---

## E. Next.js client (`app/`)

| # | Item | Status | Notes |
|---|------|--------|-------|
| E1 | App Router scaffold + tin-toy CSS | DONE | |
| E2 | Routes: Lot, Warehouse, Paddle, Me, Live Vault, Reveal, Proof | DONE | |
| E3 | Wallet adapter (Phantom / Solflare) | DONE | Mobile adapter stubbed in webpack |
| E4 | Providers (Connection, Wallet, React Query) | DONE | |
| E5 | `lib/connections`, `pdas`, `program`, `tx`, `teeAuth`, `explorer`, `evidence`, `hints`, `ata` | DONE | |
| E6 | Hooks: TeeAuth, ActiveVault, VaultLive, HintsLive, MyBid, PlaceBid, HintPublisher, Faucet | DONE | |
| E7 | `/api/public-vault` read-only proxy | DONE (code) | Not proven against live vault |
| E8 | Warehouse from `data/items.json` | DONE | Not yet reading sold flags from chain |
| E9 | Paddle: connect + guest book + faucet UI | DONE (wired) | Needs live faucet after wallet SOL |
| E10 | Live Vault: hints + countdown + place_bid | DONE (wired) | Needs Open vault |
| E11 | Reveal page binds `revealed_items` | DONE (wired) | Needs reveal |
| E12 | Proof board + snoop widget | PARTIAL | Evidence list + snoop UI; few live exhibits |
| E13 | Me: my bid + inventory | PARTIAL | Bid wired; inventory tokens not listed from chain |
| E14 | SCRIP → eATA deposit (F8 deposit step) | NOT DONE | Critical for ER bids |
| E15 | Gas-tank API (`/api/gas-tank`) | NOT DONE | Spec F8 |
| E16 | Rive vault door / Howler SFX | NOT DONE | Spec polish |
| E17 | shadcn primitives restyle | NOT DONE | Spec 9.1; using custom toy CSS |
| E18 | `npm run typecheck` | PASS | |
| E19 | `npm run build` | PASS | |

---

## F. Spec features (acceptance mapping)

### MVP

| ID | Feature | Status | Gap |
|----|---------|--------|-----|
| F1 | Warehouse | PARTIAL | Static JSON catalog; missing on-chain sold/owner + EV by size |
| F2 | Create + delegate vault | BLOCKED | Upgrade + open-vault not green |
| F3 | VRF fill | PARTIAL | Entropy `fill_vault` only; no ER VRF / callback |
| F4 | Timed hints | CODE READY | Needs Open vault + publish path proven |
| F5 | Sealed bid | CODE READY | Needs Open vault + eATA deposit |
| F6 | End / reveal / open UI | CODE READY | Needs keeper + live status |
| F7 | Settlement / refunds / finalize | LIVE PASS | Vault 5 full loop; V8 finisher running |
| F8 | Faucet + onboarding | LIVE | Paddle faucet + guest book + eATA deposit via demo-bid |
| F9 | Proof board | LIVE | exhibits.json stamped; snoop widget; hint math post-reveal |
| F10 | My Bids + Inventory | LIVE | on-chain sold Item PDAs + art thumbs |

### Stretch

| ID | Feature | Status |
|----|---------|--------|
| S1 | Paid peeks | LIVE | TEE buy_peek + Solana fee; UI hook + Vault 7/8 evidence |
| S2–S6 | Other stretch | NOT STARTED | crank / session keys / VRF / etc. |

---

## G. Honest limits / risks (do not paper over)

| # | Issue | Status |
|---|-------|--------|
| G1 | Fill uses TEE-local entropy, not ER VRF | Documented (R1) |
| G2 | eATA inside `create_vault` crashed on Devnet | Fixed locally; must upgrade |
| G3 | Public Devnet RPC 429s — use Helius | Mitigated |
| G4 | Never commit Helius key / `.env` | Enforced via gitignore |
| G5 | OneDrive corrupted some `node_modules` binaries earlier | Reinstalled; watch if rebuilds break |
| G6 | Program upgrade needs ~4.5 SOL temporary buffer | Funded now |

---

## H. Evening — ship surface (do in order)

- [x] **H1–H8** Core loop + peeks + warehouse art (see BUILD_STATUS)
- [ ] **H9** Confirm Vault 8 finalize PASS; stamp settle/finalize exhibits
- [ ] **H10** Record demo ≤3 min + public site URL
- [ ] **H11** Submit Blitz form from `docs/BLITZ_FORM_DRAFT.md`
- [ ] **H12** Update BUILD_STATUS with submit confirmation

Optional after submit:

- [ ] Spike ER VRF on TEE; replace entropy if green
- [ ] Reveal sequence polish / mobile pass
