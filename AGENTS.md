# Pulse Call Agent Rules

Lean engineering rules for AI/human contributors. MagicBlock details: `.cursor/rules/magicblock.mdc`.

## Non-negotiables

1. Devnet / test validators only — never mainnet or real funds.
2. Never expose private keys; never sign with developer keys for user ops.
3. Do not fake onchain success with mocks counted as VRF/ER/oracle proof.
4. Pin compatible versions; mirror active MagicBlock examples (Anchor 1.0.2).
5. Guest practice works without a wallet; onchain calls need a supported wallet.
6. Smallest secure vertical slice: implement → test → evidence → next gate.
7. No pitch decks, marketing, videos, or submission polish in this repo.
8. Update `docs/BUILD_STATUS.md` after every passing/failing gate.

## Stack boundaries

- Client: live ER oracle tape, guest practice UP/DOWN rounds, wallet connect.
- Base Solana: pool init, Call PDA create, undelegate / settled receipts.
- MagicBlock ER: place_call + settle_call latency path (after delegate).
- MagicBlock VRF: payout pulse trim only (`request_pulse` → `consume_pulse`).
- MagicBlock oracle: SOL/USD open + settle prices (never invent prices).

## Quality bar

Every feature needs: user-visible outcome + command/test + observed PASS/FAIL evidence.
