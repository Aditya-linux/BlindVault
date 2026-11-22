# Debug / scratch scripts

One-off probes used while bringing up Blind Vault on Devnet/TEE.
**Do not commit keypairs** (`*wallet*.json`) or vault-specific rescue dumps.

Canonical pipeline stays in `scripts/`:

- `01-init-house.ts` → `02-seed-items.ts` → `03-init-pool.ts`
- `open-vault.ts`, `demo-bid.ts`, `demo-round.ts`, `keeper.ts`, `snoop.ts`, `auto-round.ts`

Reusable helpers that may live here (named, no leading `_`):

- `acct-check.ts`, `resume-open.ts`, `fetch-pool.ts`, `touch-and-open.ts`, …

Operator one-shots (`_vault-status.ts`, `_unstick-v14-open.ts`, …) are **gitignored** — keep them local.

```bash
npx tsx scripts/debug/acct-check.ts
```

Redirect noisy runs into `logs/` (gitignored):

```bash
npx tsx scripts/debug/resume-open.ts > logs/resume-open.log 2>&1
```
