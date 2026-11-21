# Blind Vault — 4-day ship checklist

**Start:** tomorrow (locked scope)  
**Deadline:** 4 days max — no scope creep  
**Live:** https://blind-vault-amber.vercel.app  
**Submit:** https://build.magicblock.app/?stage=blitz#submit

---

## North star — three judge moments

Technical foundation is ahead of a typical concept-stage entry. That alone is not enough.  
A strong **overall** submission needs the judge to feel these three beats, in order:

| # | Moment | What must be true |
|---|--------|-------------------|
| 1 | **“I understand the game.”** | Onboarding + rules make the loop obvious without the README. |
| 2 | **“I genuinely cannot see what the other player sees.”** | Live two-wallet privacy proof with real RPC outcomes — not UI theater. |
| 3 | **“That reveal was worth waiting for.”** | Reveal feels earned; cards are real on-chain results; settlement status is clear. |

**Ship bar:** hit all three with evidence. No prize promises — compete by making those moments undeniable.

Map every task to a moment. If a task doesn’t serve 1, 2, or 3 → cut it.

---

## What we are building (short)

**Blind Vault** is a sealed collectible auction on Solana Devnet with MagicBlock PER/TEE privacy.

Players bid **SCRIP** (free in-game credits) on a mystery vault of creature cards. Vault contents and bid amounts stay private until reveal. Paid peeks are wallet-ACL’d. The highest sealed bid wins real Devnet SPL cards.

**Judge journey:**  
Connect → free SCRIP → live vault → sealed bid → paid peek → other wallet denied → vault opens → cards in wallet → honest evidence.

---

## Features already working (as of 2026-11-21)

| Area | Status | Serves moment |
|------|--------|---------------|
| Program on Devnet + TEE (`E9UmQYi…`) | DONE | 2, 3 |
| House / SCRIP faucet / item SPL | DONE | 1 |
| Create → fill → delegate vault | DONE | 2, 3 |
| Sealed bids + paid peeks (ACL) | DONE | 2 |
| Hints drip from private state | DONE | 2 |
| Reveal → settle → close → finalize (Vault 8 evidenced) | DONE | 3 |
| Warehouse creature cards + rarity tiers | DONE | 1, 3 |
| Live site on Vercel | DONE | — |
| Soft cream landing restored | DONE | 1 |
| Live no longer auto-redirects to Reveal | DONE | 1, 3 |
| CI typecheck/build green | DONE | — |
| Honest docs: fill = TEE-local entropy (not VRF) | DONE (docs) | honesty |

### Gaps vs the three moments

| Moment | Gap |
|--------|-----|
| 1 Understand | Paddle still rough; no mini tutorial; Live still form-like |
| 2 Cannot see | Proof can mislabel null as ACCESS DENIED; two-wallet demo not judge-ready |
| 3 Reveal worth it | Reveal is informative, not memorable; settlement vs ownership unclear |

---

## Explicitly OUT (do not start)

- ER VRF integration  
- Full X-ray scanner spectacle  
- Collection quests / badges  
- Themed vaults · leaderboards · marketplace / PvP / staking  
- Heavy cinematic particle rarity system  

---

## Day checklist (mark as you go)

### Day 1 — Moment 1 foundation + reliability → **“I understand”**

- [x] Guided paddle: steps, Devnet/SOL/SCRIP checks, actionable errors  
- [x] Skip completed steps for returning users (fresh TEE token + existing SCRIP balance)  
- [x] Non-wallet “watch / demo” path (never fake on-chain)  
- [x] Keeper minimal resume: Model A settle → close gates → undelegate wait → finalize  
      (loser refunds still bidder-signed — called out in keeper logs)  
- [ ] One real 2-wallet round; stamp evidence  

### Day 2 — Moment 2 → **“I cannot see what they see”**

- [x] Two-wallet proof UI: A probes own peek, B probes saved peek PDA  
- [x] Outcome classes: authorized / unauthorized_or_hidden / not_found / rpc_error / needs_auth  
- [x] Null ≠ ACCESS DENIED — existence check on public Vault  
- [x] No auth tokens in explorer links (stripToken) · session only stores peek owner pubkey  
- [ ] Live 2-wallet stamp on an open lot (manual with two Phantoms)  

### Day 3 — Moments 1 + 3 → **understand + reveal worth it**

- [x] Live arena: sealed/peek chips, privacy-safe activity feed, close-clock banner  
- [x] Mini tutorial / rules strip on Paddle  
- [x] Thin reveal sequence from on-chain items; skip/replay; reduced-motion  
- [x] Pending settlement vs owned cards clearly separated  

### Day 4 — Prove all three + ship

- [ ] UI + README fairness copy (TEE entropy, not VRF)  
- [ ] Full E2E: 2 wallets, peek privacy, settle to wallet  
- [ ] Mobile smoke + empty/error/refresh paths  
- [ ] CI green  
- [ ] ≤3 min demo video that hits moments **1 → 2 → 3** in order  
- [ ] Blitz form submitted  

---

## Acceptance — all three must pass

| Moment | Pass test |
|--------|-----------|
| 1 Understand | Fresh judge/player finishes paddle and can say what they bid on, what they win, what happens if they lose, and that bids are sealed — without reading README. |
| 2 Cannot see | Wallet A peek succeeds; Wallet B same read fails as **unauthorized** (not “missing”); both are live authenticated TEE reads. |
| 3 Reveal worth it | After deadline, reveal shows real items with a short earned beat; winner path to ownership is clear; not a dry data dump. |

---

## Resume command (tomorrow)

1. Read this file + `docs/BUILD_STATUS.md`  
2. Start **Day 1 → Guided paddle** (Moment 1)  
3. After each item: update this checklist + `BUILD_STATUS.md` with PASS/FAIL evidence  
4. Reject any new idea that doesn’t strengthen moment 1, 2, or 3  
