# Pulse Call

Call SOL/USD **UP** or **DOWN** on MagicBlock Ephemeral Rollups (Devnet only).

Status / next gates: [`docs/BUILD_STATUS.md`](docs/BUILD_STATUS.md). Agent rules: [`AGENTS.md`](AGENTS.md).

## Quick start

```bash
cp .env.example apps/web/.env
npm install
npm run dev
```

Guest practice needs no wallet. It still reads the live ER oracle — if the feed is down, settle refuses to invent a price.

| Script | Purpose |
|---|---|
| `npm run dev` | Client |
| `npm run typecheck` / `test` / `lint` | Gates |
| `npm run anchor:build` | `pulse_call` program |

## Layout

- `apps/web` — React client (oracle tape, guest + onchain UI)
- `programs/pulse_call` — Anchor 1.0.2 (pool / call / ER / VRF)

Devnet/localnet only. No private keys in repo. No mock onchain success.
