# Build Status

```text
PHASE: live options-chain UI (dark pit) + richer oracle chart
DONE:
  - Dark live-trading theme (charcoal + up/down neon, Syne/Sora/IBM Plex Mono)
  - CallChainBoard: UP | window | DOWN with spot pill + OI bars (your fills)
  - PriceChart: H/L, session change %, grid, open/settle marks, responsive height
  - Sticky pit header, Arena strip, dual-column lg layout, denser blotter
  - Guest practice + honest onchain path still intact (no mocked VRF/oracle proof)
CHECKED (2026-11-19):
  - apps/web tsc → PASS
  - browser localhost:5173 → PASS (live SOL tape, chain UP call armed)
  - Devnet deploy → still BLOCKED (0.008 SOL; airdrop rate-limited)
NEXT:
  1. Fund Devnet wallet ≥ ~2 SOL → deploy pulse_call
  2. Wire onchain createSessionV2 + popup-free place
  3. Optional SPL stake (binary-prediction pattern)
```
