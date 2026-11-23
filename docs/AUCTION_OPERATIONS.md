# Devnet auction operations

Run these commands from the repository root in PowerShell. Use the house operator's configured Devnet wallet in `ANCHOR_WALLET`; do not use that key for bidder actions. Keep `.env` and wallet files private.

## Open one lot manually

```powershell
cd C:\Users\Aditya\OneDrive\Desktop\magicblock
npx tsx scripts/open-vault.ts --size 0
```

The command resumes an unfinished active lot or creates the next one. `--size 0` is the three-card locker used for the live demo. A successful run prints `OPEN ok` with the new lot ID and deadline. To advance an expired lot once, run:

```powershell
npx tsx scripts/keeper.ts --once
```

The keeper may need several runs because end, reveal, settlement, commit, and finalize are separate transactions. Check the public state at `https://blind-vault-amber.vercel.app/api/public-vault`.

Before a manual open, check whether the watchdog is already running. If it is, let it open the next lot. Two simultaneous opens can race on `house.nextVaultId` and one will fail with `ConstraintSeeds`; the active lot can still be valid. If a lot is active, `open-vault.ts` resumes or confirms that lot rather than creating a new one.

## Keep opening lots

```powershell
npm run auto-round:keep
```

Keep that terminal open. The watchdog restarts the round loop if it exits. The loop opens a new lot when the house has no active vault, watches the deadline, runs the keeper, and opens the next lot after finalization. Run only one copy of the watchdog. `Ctrl+C` stops a foreground copy.

On this operator machine, a hidden copy was started with PID recorded in `logs/auto-round.pid`. Inspect it without starting another copy:

```powershell
Get-Process -Id ([int](Get-Content logs/auto-round.pid))
Get-Content logs/auto-round.out.log -Tail 30
Get-Content logs/auto-round.err.log -Tail 30
```

To stop that hidden copy and its child processes:

```powershell
$watchPid = [int](Get-Content logs/auto-round.pid)
taskkill /PID $watchPid /T /F
```

## What automation can finish

If `peeksSold` exceeds `closedPeekCount`, the peek buyer can use **Release my peek** in the app. When that buyer has confirmed their public address, the operator can close their peek with the keeper's designated instruction:

```powershell
$env:PEEK_BUYER = '<confirmed peek buyer public address>'
npx tsx scripts/keeper.ts --once
Remove-Item Env:PEEK_BUYER
```

The keeper cannot sign the buyer's Claim or pay their winning SCRIP. If it prints `settle wait`, the winning wallet must finish Claim before the next lot opens.

The deployed app's Solana browser calls use `/api/solana-rpc`. Set `SOLANA_RPC` in Vercel Production to a sensitive, server-only HTTPS Devnet RPC URL; keep its API credential out of `NEXT_PUBLIC_*` variables and the repository. If Claim reports a rate limit, wait briefly and retry. Claim reads the payment receipt before asking Phantom to pay again.

Empty lots can end, reveal, close, commit, finalize, and roll forward without a bidder. A winning human bid needs the winner's wallet to sign the base SCRIP payment and TEE settlement. The operator watchdog cannot sign for a bidder or silently discard a bid. The winner should use the app's Claim flow after the deadline; the watchdog then completes the remaining stages and opens the next lot. The keeper may also need the bidder public keys (`BIDDERS`) to choose a winner if the bidders do not initiate End lot themselves.

After a confirmed bid, the live lot should show a dim, disabled **Bid placed** button. If the wallet is slow to read its private bid, the same device's saved bid keeps that button disabled. Do not try to place the same wallet's bid again. After the deadline, return to the lot page and use **Claim my pack** when the winner is selected; each required Phantom prompt is part of settlement.

Treat revealed cards and a selected winner as results, not ownership. For example, verify finalized lot 65 on base Solana with `npx tsx scripts/verify-settled-vault.ts 65`; it checks the payment receipt, Item owners, and one SPL token per card even after the shared pool is delegated for a later lot. Do not run `force_clear_active` or enable `FORCE_ABANDON_BIDS` to make a new lot while a winning bid is unsettled.

The watchdog runs only while this computer is awake and its process is alive. For unattended uptime after reboot, run the same command under a Windows Scheduled Task or on an always-on server with private operator credentials. Monitor the log and Devnet SOL balance; a repeated RPC or TEE error will be retried without force-clearing the active vault.
