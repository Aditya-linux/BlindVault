# Build Status

## Timed hints, Peek, and personal history gate — 2026-11-24

**Hint failure reproduced; keeper recovery PASS:** lot 73 was Open with one bid and all four hint deadlines passed, but `/api/public-vault` showed only the first clue released. The old watchdog PID 22836 was absent. A manual `keeper.ts --once` released overdue clues; the public API then returned all four released. The watchdog was restarted as hidden PID 6724. `auto-round.ts` now cranks the keeper every 30 seconds while hints are due during Open, rather than waiting until the auction deadline. The keeper continues to protect the human bid; it cannot sign Claim for the bidder.

**Peek/UI repair pending live gate:** the buyer reported “Buying…” for over 120 seconds. The client now reports its current phase, checks for an existing private peek before charging, records the submitted base fee transaction by wallet and lot, and reuses a confirmed fee on retry. TEE peek submission has a 90-second timeout with a retry message. The exact stage of the earlier stalled attempt was not observed, so a live wallet check remains required.

**Lot 73 follow-up:** the keeper selected the previously confirmed bidder with `end_auction` signature `CHJvidnkdtrBSVvKFeMWpnVxdfvEVVcmbxPrHfhp1Lw6etW24YMxyMu8FGVEUTULKk3qc8QWoGibnYouGzYyYjM`; public state advanced to Revealed. `peeksSold=0`, and a read-only scan of that wallet's recent base signatures found no lot-73-window transaction, so there is no evidence that the stalled Peek charged its 5 SCRIP fee. Claim still needs the winner's wallet signature.

**History change pending live gate:** My bids now separates Current bid, Bid history, and verified Won packs; it shows every bid saved on this device, labels claimed wins, and scans all existing vaults for on-chain winning packs. Bid records from other devices cannot be reconstructed after private bid accounts close, so the page states that limit.

**Production gate PASS:** commit `2458308` reached Vercel Production deployment `dpl_3RfN5wnEuNwgS47PS1XLW3SBdA3v`, aliased to `blind-vault-amber.vercel.app`. The deployed `/api/winnings` returned this wallet's settled lots 65, 66, and 67. Public lot 73 remained Revealed with all four hints visible; the restarted watchdog PID 6724 was alive and correctly waited for the winner's Claim. Peek wallet interaction and the new My bids layout still need user-visible confirmation.

**Restart gate PASS:** Windows Scheduled Task `BlindVaultDevnetKeeper` was registered for this user's logon with process restart settings; it invokes `scripts/scheduled-keeper.ps1`. Registration returned `Ready`. The task has not been reboot-tested; the currently running hidden watchdog remains PID 6724. The machine must stay powered on and logged in for live rounds.

## Bid retry gate — 2026-11-24

**Reported FAIL / live bid retry pending:** a bidder saw a generic simulation error while trying to place 23 SCRIP during an Open lot. The public lot had zero bids; a read-only unsigned 23 SCRIP `delegateSpl` simulation on the current Devnet state succeeded. The exact failed simulation stage was hidden by the UI, so the root cause is not yet proven. The client now checks the private SCRIP balance first, deposits only the missing amount, waits up to one minute for the TEE token clone before `place_bid`, and records a confirmed deposit by wallet/lot on this device so a retry does not deposit it again. Simulation errors now show their actual message. `npm run typecheck` and `npm run build` passed; a live wallet bid is the remaining gate.

## Lot 67 ownership and rollover gate — 2026-11-23

**PASS:** after the winner `3i1YQqPua8Nuzjpm3aQ5Aa34yfooDuXni3Y4Mm5rFn74` signed Claim, `npx tsx scripts/verify-settled-vault.ts 67` exited 0. It verified the base vault is Settled, payment receipt `HdQGSr9RfWVq52Z2XhD3QGLEzFiyRfRzNYNVpcHNNn1r` records 10 SCRIP, Items 11/33/20 have `owner=winner`, and each corresponding winner SPL ATA balance equals one. The shared pool is currently delegated to the next round, as expected. The manually triggered keeper closed the peek; the watchdog completed the round and opened lot 68 (`HPTHcNvA6eUn2CZQdVdwd38Lt2YRLwxqMxvMFtKYg1As`). Public `/api/public-vault` returned `active=true`, `id=68`, `status=Open`, `bidCount=0`. The keeper log contains transient commit/permission errors during rollover, but the final ownership verifier and next-lot public gate passed.

## Lot 67 claim RPC gate — 2026-11-23

**FAIL / repair in progress:** the winner's Claim screen failed while reading payment receipt `HdQGSr9RfWVq52Z2XhD3QGLEzFiyRfRzNYNVpcHNNn1r` from the shared Solana Devnet RPC with HTTP 429. A separate read using the configured Devnet provider found the receipt absent, so this attempt did not submit the 10 SCRIP payment. The deployed browser bundle uses `api.devnet.solana.com`. Lot 67 remains Revealed; one peek is also open and must be closed before finalization. No winning bid will be force-cleared.

**Local RPC repair gate PASS:** the Next production build completed after the Windows worker permission rerun; `npm run typecheck` and `git diff --check` passed. A local `/api/solana-rpc` call through the dedicated Devnet provider returned the real Devnet genesis and a fresh blockhash; a disallowed `requestAirdrop` call returned HTTP 400. The app's incorrect genesis constant was corrected to the value in Solana's source. Production now has a sensitive, server-only `SOLANA_RPC` variable, added after explicit user approval. Public deployment and wallet Claim remain pending.

**Peek close PASS:** the buyer confirmed the peek belongs to `3i1Y…Fn74`. Devnet `close_peek_keeper` succeeded (`3NCVKd2jt7egDKTvKnAE83uaYqtKotkSW2HNmVsXcqHbupiG46PPuyHFUbmGwhqVb79a9mNSdbxq5utRhQRVR4LA`); the keeper observed `peeks=1/1`, `closedBids=0/1`. The winner's wallet must still sign Claim before the lot can close.

**Production RPC gate PASS:** commit `8816b46` was pushed to GitHub `main`; Vercel Production deployment `dpl_9m4VL67VyCPUdSvRMLSY9CeZBWu2` reached Ready and aliased `blind-vault-amber.vercel.app`. Public `/api/solana-rpc` returned the exact Devnet genesis and a successful `getAccountInfo` response for the lot 67 receipt (`null`, not HTTP 429). The local browser bundle did not contain the Helius host or credential. The public `/api/public-vault` still reports lot 67 Revealed with one bid and one peek; final settlement/ownership is pending the winning wallet's Claim signature.

## Bid button gate — 2026-11-23

**Local build PASS; live interaction check pending.** The active lot page now combines the authenticated private bid with the bidder's wallet-scoped bid saved on this device. Once either confirms a placed bid, it shows the amount when known and replaces “Place sealed bid” with a disabled, dim “Bid placed” button. The bid handler also checks saved bid state before any Phantom prompt, while the existing TEE account check still protects a fresh device. `npm run build` exited 0 with `/vault/[id]` generated; `git diff --check` exited 0. A live bidder screenshot after deployment remains the user-visible confirmation gate.

**Deployment PASS:** commit `4a2bf6f` reached Vercel Production; the public `/vault/66` JavaScript bundle contains `Bid placed`. The connected wallet's rendered disabled state has not yet been independently observed, so the visual gate remains pending a post-bid check on a live lot.

## Current rollover gate — 2026-11-23

**PASS: live winning lot 65 finalized and lot 66 opened.** Winner `3i1YQqPua8Nuzjpm3aQ5Aa34yfooDuXni3Y4Mm5rFn74` signed 10 SCRIP payment and TEE settlement. Watchdog closed the round (`4diSmNUwXMFQn1F4Unhop29rMdkT9j3eTTDvHTHKctqgab9mn3iUxw3prQgvbjYTHFUg2XcuPrkDKDj2Q7eQVg3b`), closed both permissions, committed and undelegated (`2SCFWAWrC4RAToaCQ3jN7nZr9297JyV2KejGVvjHqiTxBZ22iDqikigF15dDk87ope1wi5kvdZNRVJKwuwnJUupn`), and finalized on Solana (`3sA2kzYMF3mLergZT7y5sSV1yxTYhwqA1FpSpFvFQ73fmCJfNsrU71tApk8br95Y3PKppy9EWcmj99HQb5aAdnuV`). Independent read-only `npx tsx scripts/verify-settled-vault.ts 65` exited 0: base Settled, matching 10 SCRIP receipt, winner owns items 28/16/4, and each winner SPL ATA holds exactly one token.

**PASS: lot 66 finalized and lot 67 opened.** The watchdog finalized lot 66 (`4S9fpqqnWesNeRcGpXZs2DDfG5Dj8PsdWV5sFcRNnoxLYkpqmYi9kJjv4czVXm2qVj9abzm2KkjD6TsNXswTnegG`) and opened lot 67 (`H5F7RmLrg4masZFPwMiYqMAGbyMGFgdwk4D7UdSjs9GF`). Independent `npx tsx scripts/verify-settled-vault.ts 66` exited 0: winner `3i1Y…Fn74`, matching 10 SCRIP receipt, and items 24/36/0 owned with one SPL token each. The public `/api/public-vault` returned `id=67`, `status=Open`, `bidCount=0`. The shared pool was redelegated for lot 67, as expected.

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
