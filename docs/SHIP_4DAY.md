# Blind Vault — 4-day ship checklist

**Start:** tomorrow (locked scope)  
**Deadline:** 4 days max — no scope creep  
**Live:** https://blind-vault-amber.vercel.app  
**Submit:** https://build.magicblock.app/?stage=blitz#submit

---

## What we are building (short)

**Blind Vault** is a sealed collectible auction on Solana Devnet with MagicBlock PER/TEE privacy.

Players bid **SCRIP** (free in-game credits) on a mystery vault of creature cards. Vault contents and bid amounts stay private until reveal. Paid peeks are wallet-ACL’d. The highest sealed bid wins real Devnet SPL cards.

**Judge journey (target):**  
Connect → free SCRIP → live vault → sealed bid → paid peek → other wallet denied → vault opens → cards in wallet → honest evidence.

---

## Features already working (as of 2026-11-21)

| Area | Status |
|------|--------|
| Program on Devnet + TEE (`E9UmQYi…`) | DONE |
| House / SCRIP faucet / item SPL | DONE |
| Create → fill → delegate vault | DONE |
| Sealed bids + paid peeks (ACL) | DONE |
| Hints drip from private state | DONE |
| Reveal → settle → close → finalize (Vault 8 evidenced) | DONE |
| Warehouse creature cards + rarity tiers | DONE |
| Live site on Vercel | DONE |
| Soft cream landing (post-hero rollback) | DONE |
| Live no longer auto-redirects to Reveal | DONE |
| CI typecheck/build green | DONE |
| Honest docs: fill = TEE-local entropy (not VRF) | DONE (docs) |

### Gaps we still own in this sprint

- Demo video + Blitz submit not done  
- Keeper loser-refund still needs losing bidder online  

### Cleared this session

- Vault 10 foreign-peek stick → `close_peek_keeper` + finalize_abandoned  
- Fresh Open lot (Vault 11)  
- 2-wallet bid + peek + Wallet B denied evidence  
- Wallet “Change Wallet” ink-on-ink contrast  

---

## Explicitly OUT (do not start)

- ER VRF integration (fill = TEE-local entropy until ER VRF verified on `devnet-tee`)  
- Full X-ray scanner spectacle  
- Collection quests / badges  
- Themed vaults  
- Leaderboards  
- Marketplace / PvP / staking  
- Heavy cinematic particle rarity system  

---

## Day checklist (mark as you go)

### Day 1 — Reliability + onboarding

- [ ] Guided paddle: steps, Devnet/SOL/SCRIP checks, actionable errors  
- [ ] Skip completed steps for returning users  
- [ ] Non-wallet “watch / demo” path (never fake on-chain)  
- [ ] Keeper minimal resume: settle → refund losers → finalize where safe  
- [ ] One real 2-wallet round; stamp evidence  

### Day 2 — Privacy proof that doesn’t lie

- [ ] Two-wallet proof: A reads own peek, B denied  
- [ ] Outcome classes: authorized / unauthorized / not found / RPC error  
- [ ] No auth tokens in logs, screenshots, or explorer URLs  
- [ ] Evidence board uses real txs / reads only  

### Day 3 — Live + reveal + rules

- [ ] Live arena: countdown, sealed-bid count, privacy-safe activity, bid lock  
- [ ] Thin reveal sequence from on-chain items; skip/replay; reduced-motion  
- [ ] Pending settlement vs owned cards clearly separated  
- [ ] Mini tutorial / rules strip (bid / win / lose / privacy / peek limits)  

### Day 4 — Honesty + ship

- [ ] UI + README fairness copy (TEE entropy, not VRF)  
- [ ] Full E2E: 2 wallets, peek privacy, settle to wallet  
- [ ] Mobile smoke + empty/error/refresh paths  
- [ ] CI green  
- [ ] ≤3 min demo video  
- [ ] Blitz form submitted  

---

## Done when

An independent judge can open the live site, understand the game without the README, complete (or watch) a round, and inspect privacy + settlement evidence without us debugging live.

---

## Resume command (tomorrow)

1. Read this file + `docs/BUILD_STATUS.md`  
2. Start **Day 1 → Guided paddle**  
3. After each day item: update this checklist + `BUILD_STATUS.md` with PASS/FAIL evidence  
