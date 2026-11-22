# Build Status

```text
PHASE: Prize history chain live · plain copy · finish-today sprint
HACK: Solana Blitz v10 · Entertainment Finance · submit build.magicblock.app/?stage=blitz#submit

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

NEXT:
  - Bid + win one lot to exercise pack popup + history end-to-end
  - Demo video → Blitz submit before deadline
  OUT: ER VRF (fill = TEE-local entropy — honest)

HONEST LIMITS: fill = TEE-local entropy · Devnet/TEE only

WALLET: 4qwVuf…AUy7 · House C7cfsQ… · SCRIP 5RMEdwx…
```
