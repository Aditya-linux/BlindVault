# Debug / scratch scripts

One-off probes used while bringing up Blind Vault on Devnet/TEE.
Canonical pipeline stays in `scripts/`:

- `01-init-house.ts` → `02-seed-items.ts` → `03-init-pool.ts`
- `open-vault.ts`, `demo-bid.ts`, `demo-round.ts`, `keeper.ts`, `snoop.ts`

Run from repo root, e.g.:

```bash
npx tsx scripts/debug/_vault-status.ts
```

Redirect noisy runs into `logs/` (gitignored):

```bash
npx tsx scripts/debug/_sim-settle.ts > logs/sim-settle.log 2>&1
```
