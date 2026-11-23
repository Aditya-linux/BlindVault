# Build Status

## Current rollover gate — 2026-11-23

**PASS: live winning lot 65 finalized and lot 66 opened.** Winner `3i1YQqPua8Nuzjpm3aQ5Aa34yfooDuXni3Y4Mm5rFn74` signed 10 SCRIP payment and TEE settlement. Watchdog closed the round (`4diSmNUwXMFQn1F4Unhop29rMdkT9j3eTTDvHTHKctqgab9mn3iUxw3prQgvbjYTHFUg2XcuPrkDKDj2Q7eQVg3b`), closed both permissions, committed and undelegated (`2SCFWAWrC4RAToaCQ3jN7nZr9297JyV2KejGVvjHqiTxBZ22iDqikigF15dDk87ope1wi5kvdZNRVJKwuwnJUupn`), and finalized on Solana (`3sA2kzYMF3mLergZT7y5sSV1yxTYhwqA1FpSpFvFQ73fmCJfNsrU71tApk8br95Y3PKppy9EWcmj99HQb5aAdnuV`). Independent read-only `npx tsx scripts/verify-settled-vault.ts 65` exited 0: base Settled, matching 10 SCRIP receipt, winner owns items 28/16/4, and each winner SPL ATA holds exactly one token.

The public `/api/public-vault` then returned `id=66`, `status=Open`, `bidCount=0`, vault `ABjWVNU2nbA3iFjiFp9tGXu5yMRzeFbPVnU6BVsbMqEm`; the watchdog log also reported `lot 66 OPEN`. Its first open attempt met a concurrent creation seed race, and a retry treated private `VaultContents` RPC denial as a missing clone. The active lot nonetheless opened. `open-vault.ts` now treats private contents like the private pool: it checks visible vault/hints clones, then uses permission/fill instructions to prove the private accounts are usable. Running the updated script on active lot 66 exited 0 with `OPEN ok (already)` and no new lot creation.

The historical lot 65 verifier assumed the shared pool must remain undelegated; that assumption fails once lot 66 redelegates it. The verifier now checks the old vault's durable base owner, receipt, Item owners, and SPL balances and reports the pool's *current* owner as information only. The first failed verification and corrected PASS are both recorded above. This gate proves a live claimed winning round can roll to the next Open lot; future winning rounds still need the winner's wallet signature.

## Earlier live auction gate — 2026-11-23 (superseded above)

**PASS: lot 65 opened for bidding.** `npx tsx scripts/open-vault.ts --size 0` exited 0; Devnet vault `Cm4r63yDJTVz4pM6bGTnTFBAgbedJa7dWTpX3zKz5LFC` is Open with a 10 SCRIP minimum and three sealed cards. The public app `/api/public-vault` returned `active=true`, `id=65`, `status=Open`, and the same vault address. The local `keep-auto-round` watchdog is running as process 22836; its log confirmed `lot 65 OPEN` with time remaining.

The unattended runner now retries a failed open or stuck keeper step without force-clearing the active vault. This protects bids and inventory during temporary RPC or TEE errors. The runner can cycle empty lots and completed claims; winning human bids still need the winner's wallet to pay/settle before the round can finalize. See [AUCTION_OPERATIONS.md](AUCTION_OPERATIONS.md) for manual and watchdog commands.

**Rollover gate pending winner settlement:** lot 65 reached its deadline with one real bid. The bidder ended the lot through the app; it is Revealed with winner `3i1YQqPua8Nuzjpm3aQ5Aa34yfooDuXni3Y4Mm5rFn74`. The watchdog is alive and reports `settle wait — winner must sign closer`; it has not force-cleared the bid. The winning wallet has 9.95595584 Devnet SOL and 349 SCRIP on base, so the Claim flow has enough public balance. Payment and TEE settlement still require that wallet's signature. The deployed app bundle contains `payWinningBid`. This run has not yet proved an unattended transition to lot 66.

**Follow-up FAIL / still pending:** after the winner reported claiming lot 65, the public app API still returned `Revealed` and the watchdog still reported `closedBids=0/1`. Read-only base RPC showed payment receipt `FhqPZUX3YyuJTf8nE771i6PmLVkbSMQmb2QTU7bEMmyq` does not exist. No lot 66 was opened because the winning bid must not be discarded. The exact app/wallet result is being requested from the winner.

**UI finding:** the winner's screenshot showed lot 65 under “Packs you won” with cards even though its base payment receipt is absent. `/api/winnings` admitted any selected winner before `Settled`, and `/me` also trusted local pack memory as a won row. This hid the Me-page Claim prompt. The local fix restricts winnings to `Settled`, removes local-only pack rows, and exposes Claim for the recorded winner of a Revealed lot even if the private bid read is delayed. Build and live deployment checks follow.

**UI fix deployed PASS:** `npm run build` exited 0. The built app's localhost `/api/winnings?owner=3i1Y…Fn74` returned HTTP 200 with no lot 65, while the prior public deployment returned lot 65 with `status=Revealed` and `settled=false`. Commit `d03d603` reached Vercel Production, and the public alias now also returns no lot 65. History copy calls this a selected winner with settlement pending. The winner has been asked to refresh and complete Claim so on-chain settlement and lot 66 can proceed.

## Canonical Devnet settlement gate — 2026-11-23

**PASS: two consecutive winning rounds on `pool_v9`.** Vaults 63 and 64 both completed the full bidder privacy → winner → base SCRIP payment → TEE settlement → reveal → permission closure → commit and undelegate → Solana finalize → SPL ownership path. The production claim supported by this gate is that a winning bidder receives real Devnet SPL cards after finalization. This is Devnet/TEE evidence; it is not mainnet readiness or ER VRF proof. Fill still uses TEE-local entropy.

- Canonical program: `E9UmQYi4gTHyyQ3SK5B4UCpewBnUBFrEc5NqkkAjr42h`, upgraded at slot `525384044`, signature `5KxuL8cc3ZEQGATdu9ZCiqreFx2ynQoMzCJ6oqJqE8idvVzjB5mYpsKprXvEWjCcNaiLNuU5eqyMEznAUHiNf7bQ`. Local SBF SHA-256 `FB914C76950CE6BA65740F72A2C05A55C8F18C28F3F6F3CA238110A2C7422FDE`; live program data prefix matched byte for byte and remaining allocated bytes were zero. Generated and app IDL SHA-256 `3A13ECB68A7294D79AF6A94BD8B5B1EC0435897D499439534F8621E286A53020`.
- Canonical pool seed: `pool_v9`; PDA `7oeNVJdvBa9NPixEBNNhiYg172eEgHSkBPFZxZ9jxPzJ`; initialized by `5YajhfzHF7QvQ1j8nBrR8kpvVT4fwXBLzbLWJkCUswvY1uU5JHyGnzrQY6MPMiamz3Ao6EmyES9wa8GAz6FLwn7w`.
- Vault 63: E2E exited 0; private bidder read succeeded, anonymous and authenticated stranger reads failed; 15 SCRIP base payment, TEE settlement, commit/undelegate, and finalize succeeded. Independent `npx tsx scripts/verify-settled-vault.ts 63` exited 0: Settled, pool undelegated, items 31/9/27 owned by the winner with exactly one SPL token each.
- Vault 64: E2E exited 0; the same privacy and settlement checks passed. Base payment `HGnGVN2eYxeKLygkfEupCe2pWuVQKGpAPw6GFbzUb2KqxN3umkHME9dm1EB2FHfY2wNNgK83LnC6mHjBZX4jSTS`; TEE settlement `2aUkstnxo2tzFtCDTUfL8TG7yDq7pJVwapuY7tjT8N9MsK3KLnA5PUCqVaCuSPRcCcyskKFmy86iZWTpakzdg5Aw`; commit/undelegate `2N68M56oQCmbFCvBdDGG2VhZBpRgkCL2zGs9B9eDz1mvw7G85DGgHUmaVJPShxbABAjdQx8fN6xvC3HfnFmR6xRS`; finalize `H7J8JB6FpqsL21gxCM4nVm1Uzwc83aCLHbDBe3YZXpADa1NJWJzWzJ5D8cuBTLcuEv9LK3tSjpwSnoovosdYn6s`. Independent `npx tsx scripts/verify-settled-vault.ts 64` exited 0: Settled, pool undelegated, 15 SCRIP receipt, items 14/30/26 owned by winner `3Ubt1gPdiQ4byM1bpxKLEZJHz1EFFiVXE963xkJoTv3J`, one SPL token each. House durations restored to `[480,480,600]`.
- The vault 64 open gate initially failed because private pool RPC reads returned null even though the ledger clone was usable. `open-vault.ts` now checks public vault/hints/contents clone availability, then lets permission initialization and `fill_vault` prove pool usability. `fill_vault` passed and the full round completed.
- Local checks PASS: `npm run typecheck` exit 0; `npm run build` exit 0 (all 10 static pages generated); `cargo test -p blind_vault --locked` exit 0 (4 tests); `git diff --check` exit 0. The first sandboxed build compiled but failed on a Windows Next worker `spawn EPERM`; the permitted rerun completed successfully.
- Publication gate PASS: code commit `594885d39c9c5d7537eaf16abc4881e0fa529fbb` pushed to GitHub `main`; `git ls-remote origin refs/heads/main` returned the same commit after the push. The demo video artifact or link is absent from this repository, so a frame-by-frame match with the video cannot be verified here.

## Historical log below

The entries below document prior gates and may describe older pools, vaults, and product states. Use the canonical gate above for the current status.

## Historical settlement gate — 2026-11-23 (superseded above)

**Current repeatability gate: FAIL / in progress.** The pool_v9 program binary is live, but pool_v9 has not yet initialized. Vault 63 is delegated with zero bids. The first pool_v9 init attempt was blocked before execution by automatic approval review's usage limit; the approved retry reached preflight and failed because `03-init-pool.ts` used a finalized slot too old for AddressLookupTable creation. The script now requests a recent processed slot. Do not open another vault or claim repeatability until pool_v9 is initialized and two rounds finalize on that same pool.

**PASS for one live Devnet winning round (vault 62).** The block below is a historical build log; its earlier lot numbers and pool versions are not current.

- GitHub `main` was fast-forwarded through `1dce0cc` (the nine earlier local commits). The current tested changes still need to be committed and pushed.
- Current source uses `pool_v8`. Program `E9UmQYi4gTHyyQ3SK5B4UCpewBnUBFrEc5NqkkAjr42h` last upgraded at slot `525382758`, signature `5MG8X7zGssY8XyZU63XWUnxxvYiv8RBrSRAQ4xipghMDBQVF6Cst7u3nzvcyyhrHxes7sWigG3CJtoz3RbiVXew5`. Local SBF is 836,944 bytes, SHA-256 `A9FACF279AA7A9722D2DB2DEB7661E154187168C93A48FF5AB3620AF8652716C`. Live dump prefix matches exactly; remaining allocated bytes are zero. Generated/app IDL SHA-256 is `A5B7BC6E4AD928C3DC872F1879FD1319494830F3B31B2564853666517BA33B24`.
- Pool_v8 PDA `9zbFnfcerg6jX7Kcs4JiUFgKhH1oHWDeqKrunUSp2Pgc` initialized, signature `egfDHuPYte8c3jwVQtwzbXhpjMZ5vUzfuAC9g6V1eV7vn7vU4iEQCoyE1HaBVtHPHesFPuPEeKeyW1bDHpLNzPt`.
- PASS: `cargo test -p blind_vault --locked` (4 tests), Anchor SBF build, app and script typechecks, final Next production build. Read-only vault 62 verifier exited 0 again after the final deployment.
- Live vault 61: isolated bidder placed a bid; bidder-authenticated TEE read succeeded and anonymous read was denied; end and reveal succeeded. Winner settlement FAILed preflight because TEE cannot write the base house treasury ATA. No settlement transaction was sent. The generated test key did not persist after failure, so `clear_reserved_items([31,9,8])` and `force_clear_active` recovered the Devnet inventory/active pointer; this round is not ownership proof.
- Vault 62 **PASS**: isolated bidder `3Ubt1gPdiQ4byM1bpxKLEZJHz1EFFiVXE963xkJoTv3J` placed a private bid; authenticated bidder read passed and anonymous read was denied. `end_auction` chose that bidder (`3FiHmgz...`), `reveal_contents` succeeded (`4EPBXk...`). Base `pay_winning_bid` transferred 15 SCRIP to the house treasury (`3qsUuBE...`), TEE `settle_winning_bid` verified its receipt (`gEetuZw...`), `close_round` (`5NYJ7T8...`), `close_contents_permission` (`4dJyaCJ...`), `commit_closed_round` (`3Lri3gF...`), and Solana `finalize` (`2YHepJs...`) succeeded. The house active pointer cleared. Independent read-only `npx tsx scripts/verify-settled-vault.ts 62` exited 0: base vault Settled, payment receipt exactly 15 SCRIP, Items 18/32/3 sold with `owner=winner`, and each winner SPL ATA balance exactly 1. The E2E runner also asserted a 15 SCRIP base treasury delta.
- The E2E runner printed PASS but its TEE websocket kept the process open; it was manually interrupted after assertions. The script now exits 0 after successful verification. Run another round to verify that exit behavior if needed.
- Still limited: this is one Devnet/TEE proof, not a repeatability claim. A forced cleanup can orphan a delegated pool clone (vault 61 led to pool_v8); do not force clear winning rounds. Losing bidders still need to sign their refund path. The E2E test wallet has SCRIP deposited to TEE after payment; withdrawal was not part of this gate.

```text
PHASE: WIND-UP · see docs/SUBMIT_NOW.md (recording + form)
HACK: Solana Blitz v10 · Entertainment Finance · submit build.magicblock.app/?stage=blitz#submit

GATE: lot 57 OPEN · pool_v6 · auto-round:keep started — ready to record/submit
PACK: docs/SUBMIT_NOW.md · form draft docs/BLITZ_FORM_DRAFT.md

DONE (live Devnet/TEE):
  - Program E9UmQYi4gTHyyQ3SK5B4UCpewBnUBFrEc5NqkkAjr42h
  - House durationSecs [480, 480, 600] (~8m) so humans can wallet+TEE+bid
  - auto-round resilient (RPC timeouts retry — no silent die on Abandoned)
  - Home Join only when Open AND clock remaining (“bid now”)
  - abandon grace 45s · force_clear_active
  - UI plain-language pass + first-time guided tour
  - /history prize chain (vault → winner → packed cards) synced with house clock
  - /api/history + /api/winnings share loadVaultHistory (same source of truth)
  - Home Recent prizes + My bids refreshes with nextVaultId / active vault
  - Whispers: “Total value about X–Y SCRIP” (no Appraised)
  - Post-claim pack score: invested vs sticker value × bid (popup / reveal / Me)
  - UI: https://blind-vault-amber.vercel.app

DONE (wallet):
  - TEE session clears on disconnect / account switch (no cross-wallet reuse)
  - TEE token bound to pubkey in zustand + sessionStorage (mismatch → wipe)
  - Guest-book signMessage only uses injected Phantom when its active key matches
  - Devnet wallet banner + faucet link when SOL/signing/network looks wrong
  - Solflare forced to Devnet · clearer tx reject / insufficient-SOL errors
  - placeBid / buyPeek require connected + signer

DONE (brand + repo hygiene):
  - Blindfolded red octopus = project logo (nav, hero, favicon, OG, README)
  - Favicon / apple-icon regenerated from logo-mark (navy disc, no letterbox)
  - Judge-facing root README tightened (demo path + MagicBlock table)
  - Removed Next boilerplate SVGs, local logs/mp4/tmp-video-edit, address dump
  - Deleted scripts/debug/_wallet-b.json (secret) · gitignore keypairs + _*.ts scratch
  - Repo map updated · app/README trimmed
  - Card rarity hover (normal / gold / legendary) via Motion + .is-hot
  - `next build` PASS (clean .next)

BLITZ DEADLINE: Fri Nov 27, 2026 · 14:00 UTC (21:00 ICT / 19:30 IST)
  Build week Nov 20–27 · Submit: https://build.magicblock.app/?stage=blitz#submit
  Source: MagicBlock @magicblock + Solana Stream (21:00 ICT)

NEXT (tomorrow only):
  - Follow docs/TOMORROW_CHECKLIST.md end-to-end
  - Unblock Open (clear lot 56) → auto-round:keep → human bid/claim → ≤3m video → submit
  OUT: ER VRF · more features · UI redesign

OPS (judges):
  - Keep Open windows: `npm run auto-round:keep` (restarts forever + heartbeat)
  - Stuck Revealed (>90s past deadline or 3m same status) → force_clear → next Open
  - Leave that terminal open on the operator machine

DONE (wind-up):
  - Keeper never force-abandons lots with bids on a 45s timer (was stealing wins)
  - Operator bid PDA auto-detected for end_auction when house is the sole bidder
  - Loser/abandoned “Reclaim my SCRIP” (refund_bid) on Live + Reveal (bidder must sign)
  - Second-bid blocked before Phantom + friendly copy; TEE simulation note
  - e2e-win-round.ts happy path (soft-ok for Windows null child exit)
  - Live proof lot 43: bid→end→reveal→settle → History/Me items [8,0,7]
    (close_round MagicIntent 0xa0000000 → force_clear; next Open unblocked)
  - Lot 44 Open ~8m; house durationSecs restored [480,480,600]; auto-round running

DONE (Me / SCRIP / peek UX):
  - /me decongested: no stacked cards; SCRIP = free Devnet play token (not cash)
  - Current bid reads TEE bid; falls back to device memory + “Recent bids”
  - Peek errors humanized (invalid account data → plain copy)
  - Claim strip hides after settle (bid PDA closed) — no sticky “Claim lot N”
  - Live: https://blind-vault-amber.vercel.app

DONE (rarity-weighted fill):
  - fill_vault: TEE entropy + rarity weights (Gold+Legendary scarce ~4%/slot)
  - Warehouse no longer shows odds %; cards don’t show chance labels
  - Program upgraded on Devnet (same id E9UmQYi…) — next Open lots use new mix

HONEST LIMITS: fill = TEE-local entropy · Devnet/TEE only · loser refund needs bidder online while Revealed · close_round TEE flake mitigated by force_clear

WALLET: 4qwVuf…AUy7 · House C7cfsQ… · SCRIP 5RMEdwx…
```
