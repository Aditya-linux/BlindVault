# Blind Vault

Sealed storage-unit auctions on Solana Devnet — Storage Wars energy, MagicBlock privacy under the hood.

Nobody (not even the house) can read what’s in the vault while it’s live. Hints drip out on a schedule, bids stay sealed, paid peeks are private to the buyer, and the winner walks away with real SPL collectibles — now shown as **creature cards** with Simple → Shiny → Legendary tiers.

Built for **[Solana Blitz v10](https://luma.com/hedv5sgh)** by MagicBlock — theme: **Entertainment Finance**.

**Repo:** [github.com/Aditya-linux/BlindVault](https://github.com/Aditya-linux/BlindVault)  
**Submit:** [build.magicblock.app/?stage=blitz#submit](https://build.magicblock.app/?stage=blitz#submit)

---

## Why MagicBlock

Plain sealed-bid demos already hide **amounts**. Blind Vault also hides the **lot**.

On a public chain, an RPC can read vault contents and bids the moment they’re written. That’s fatal for a mystery auction. Private state lives on MagicBlock’s **Private Ephemeral Rollup** (`devnet-tee`): Intel TDX TEE + ephemeral permissions (ACLs). Different wallets literally get different eyes on the same accounts.

| Without PER | With Blind Vault + PER |
|-------------|------------------------|
| Contents visible on explorer | `VaultContents` private until reveal |
| Bids readable by anyone | Bid PDAs ACL’d to bidder (+ vault) |
| “Peek” is UI theater | Paid peek is a private account; snoop → ACCESS DENIED |
| Hints hand-waved | Hints computed from private state on-chain |

**One-liner:** other MagicBlock auctions hide bids; we hide the box *and* the bids — and you can prove the snoop fails live.

---

## How we use MagicBlock

| Piece | Where | What it does here |
|-------|-------|-------------------|
| **Private Ephemeral Rollup** (`devnet-tee.magicblock.app`) | Vault, contents, hints, bids, peeks, pool | Private execution + private account reads |
| **Delegate / undelegate** | `delegate_vault` → `close_round` | Move accounts into the TEE, later commit home |
| **Ephemeral permissions (ACLs)** | contents / bid / peek permissions | Buyer sees their peek; stranger gets denied |
| **`getAuthToken` (TEE guest book)** | App paddle + scripts | Free signature unlocks authenticated TEE RPC |
| **Commit + undelegate** | `close_round` MagicIntent bundle | Settlement path back to Solana for `finalize` |
| **SCRIP + item SPL** | Faucet, treasury fee, item custody | Public economy; privacy only where the game needs it |
| **Fill entropy** | `fill_vault` | TEE-local mix today; **ER VRF** next once verified on TEE |

Client: `@magicblock-labs/ephemeral-rollups-sdk` · Program: Anchor **1.0.2** + ER SDK **0.16.x** (Rust).

---

## Architecture

```mermaid
flowchart TB
  subgraph Player
    UI["Next.js · Warehouse cards · Live lot · Proof"]
    W["Wallet + TEE guest book"]
  end

  subgraph Solana["Solana Devnet"]
    House["House · SCRIP · Item PDAs"]
    Fin["finalize → winner ATAs"]
  end

  subgraph PER["MagicBlock PER · devnet-tee"]
    V["Vault · Hints"]
    C["VaultContents · private"]
    B["Sealed Bid · ACL"]
    P["Peek · ACL"]
  end

  UI --> W
  W -->|public reads| House
  W -->|place_bid / peek / hints| PER
  PER -->|close_round commit + undelegate| Fin
  Fin --> House
  C -.->|snoop without ACL| Deny["ACCESS DENIED"]
```

### One lot lifecycle

```mermaid
sequenceDiagram
  participant Op as Operator
  participant S as Solana
  participant T as TEE PER
  participant Pl as Player

  Op->>S: create_vault + delegate
  Op->>T: permissions + fill_vault → Open
  Pl->>S: faucet SCRIP
  Pl->>T: guest book · place_bid · buy_peek
  Note over T: Hints on schedule · contents & bids stay private
  Op->>T: end → reveal → settle → close_peek → close_round
  T->>S: undelegate
  Op->>S: finalize → item tokens to winner
```

---

## Player loop

1. **Warehouse** — 40 on-chain collectible cards (Simple / Common / Shiny / Epic / Legendary)
2. **Paddle** — connect → sign TEE guest book → claim SCRIP
3. **Live lot** — timed hints → seal a bid → optional paid peek
4. **Proof** — try to snoop contents / someone else’s peek → denied until reveal
5. **Reveal** — lot opens; winner’s cards show in **Me**

---

## Live Devnet

| | |
|--|--|
| Program | [`E9UmQYi4gTHyyQ3SK5B4UCpewBnUBFrEc5NqkkAjr42h`](https://explorer.solana.com/address/E9UmQYi4gTHyyQ3SK5B4UCpewBnUBFrEc5NqkkAjr42h?cluster=devnet) |
| House | `C7cfsQFawFQkNk6GsRk4LuCtRcUGAg1Ux7mp66EQDDFE` |
| SCRIP | `5RMEdwxEqfsdqiuSr658N4M5JFyTSeMC4KcF9b41bWHx` |
| TEE | `https://devnet-tee.magicblock.app` · validator `MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo` |

**Sample evidence**

- Full settle (Vault 5): [`5Nun4q…`](https://explorer.solana.com/tx/5Nun4qFDYFgv2EQ3Cca7kLz9KRfpFEF96dUTxV8oPMSdUTpHvUcWKLNVVLNzLYtrickVKofjCBuQTHHQWGZFQL8C?cluster=devnet)
- Private peek (Vault 8 TEE): [`5DnHvB…`](https://explorer.solana.com/tx/5DnHvBaZT3dy71TM47vNch9Zx69cc8bfS8GtNMNA1ySf84HFAgwsgRXPQj1GraV4zgR4F4dKpFNMTUbfzxjZvkKV?cluster=devnet)
- Vault 8 finalize: [`5uobPA…`](https://explorer.solana.com/tx/5uobPAb1N35TujTVvpthMJq3uShP1DJdnGCYUCgujNart5Lg6DQBN8GFkWisrf859t4mW43gvXzreuPQRt753yvP?cluster=devnet)

More stamps: [`data/exhibits.json`](data/exhibits.json) · status: [`docs/BUILD_STATUS.md`](docs/BUILD_STATUS.md)

---

## Quick start

```bash
git clone https://github.com/Aditya-linux/BlindVault.git
cd BlindVault
cp .env.example app/.env.local
npm install --legacy-peer-deps
npm run typecheck
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Deploy (Vercel)

- Root directory: repo root (or `app/` with the nested `vercel.json`)
- Install: `npm install --legacy-peer-deps --force`
- Build: `npm run build`
- Env: copy from `.env.example` (`NEXT_PUBLIC_SOLANA_RPC`, `NEXT_PUBLIC_TEE_RPC`, `NEXT_PUBLIC_TEE_WS`, `NEXT_PUBLIC_PROGRAM_ID`)

### Operator scripts

```bash
npx tsx scripts/open-vault.ts --size 0
npx tsx scripts/demo-bid.ts --amount 25
npx tsx scripts/debug/_buy-peek.ts
npx tsx scripts/debug/_verify-peek.ts
npx tsx scripts/debug/_finish-v8-settle.ts
```

QA: [`docs/TEST_RUNBOOK.md`](docs/TEST_RUNBOOK.md) · Blitz draft: [`docs/BLITZ_FORM_DRAFT.md`](docs/BLITZ_FORM_DRAFT.md)

---

## Repo map

| Path | Role |
|------|------|
| `programs/blind_vault` | Anchor program (PER + Solana settlement) |
| `app/` | Next.js — Rocco’s Lock-Up Auctions |
| `data/items.json` | Catalog + rarity tiers |
| `scripts/` | open / bid / peek / settle / keeper |
| `docs/` | status, checklist, test runbook |

---

## Honest limits

- **Devnet / TEE only** — no mainnet, no real value.
- **Fill** uses TEE-local entropy until ER VRF on `devnet-tee` is verified.
- Card art is original SVG chrome (TCG vibe) — not third-party IP.
- Privacy assumes MagicBlock’s attested TEE validator.

---

Built during Blitz week. Powered by MagicBlock Private Ephemeral Rollups.
