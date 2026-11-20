# Blind Vault Agent Rules

Lean engineering rules for AI/human contributors. MagicBlock details: `.cursor/rules/magicblock.mdc`. Spec: `BLIND_VAULT_SPEC.md`.

## Non-negotiables

1. Devnet / TEE only — never mainnet or real funds.
2. Never expose private keys; never sign with developer keys for user ops.
3. Do not fake PER privacy or VRF success with mocks counted as proof.
4. Pin compatible versions; mirror `sealed-auction` (Anchor 1.0.2, ER SDK 0.16.2).
5. Warehouse/public vault views work without a wallet; bidding needs wallet + TEE auth.
6. Smallest secure vertical slice: implement → test → evidence → next gate.
7. No pitch decks, marketing, videos, or submission polish until the core loop works.
8. Update `docs/BUILD_STATUS.md` after every passing/failing gate.

## Stack boundaries

- Client: Next.js “Rocco’s Lock-Up Auctions” UI (Warehouse, Live Vault, Reveal, Proof, Me, Paddle).
- Base Solana: House, Items, SCRIP mint, faucet, create/delegate vault, finalize.
- MagicBlock PER (`devnet-tee`): private contents + pool ledger + sealed bids + peeks.
- Fill: TEE-local entropy mix until ER VRF on TEE is verified (spec §7.5 / R1).
- Settlement: end → reveal → settle/refund → close_round → finalize.

## Quality bar

Every feature needs: user-visible outcome + command/test + observed PASS/FAIL evidence.
