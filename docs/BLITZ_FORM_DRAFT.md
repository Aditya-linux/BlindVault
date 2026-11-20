# Blitz V10 — form draft (fill after demo post)

Submit: https://build.magicblock.app/?stage=blitz#submit  
Do **not** submit until site + demo are live. Copy into MagicBlock submit UI.

## Theme fit (Entertainment Finance)
Trade / collect / compete / win assets you own, with game mechanics — sealed lots, timed hints, private peeks, SPL warehouse items in the winner’s wallet. MagicBlock PER for privacy; Solana for custody + finalize.

## WOW / uniqueness (judge one-liner)
Other MagicBlock sealed auctions hide **bids**. Blind Vault also hides the **lot** — contents + sealed bids + paid peeks live under PER ACLs so different eyes see different truths. Hints are computed on-chain from private state (they can’t lie). Snoop test: ACCESS DENIED until reveal. Winner walks away with real SPL warehouse items.

## Project name
Blind Vault (Rocco's Lock-Up Auctions)

## Description
Sealed storage-unit auctions on Solana Devnet. Vault contents, sealed bids, and paid peeks stay private inside MagicBlock Private Ephemeral Rollups (TEE) until reveal. Hints drip on-chain while the lot is open; winners settle SCRIP and claim warehouse items after finalize. Uses PER ACLs (different eyes for peeks/bids), TEE-local fill entropy until ER VRF on TEE is verified, and Solana settlement — no mainnet / no real funds.

## Categories (up to 3)
Privacy · Games · Consumer

## Project website
_(paste Vercel / public URL when posted)_

## GitHub
https://github.com/AdityaNishad77/magicblock
_(confirm exact repo URL / visibility before submit)_

## Pitch & Demo
_(paste Loom / YouTube after recording)_  
Script: warehouse → live vault → TEE guest book → sealed bid → paid peek → snoop ACCESS DENIED → reveal → settle → items owned.

## Explorer link (integration proof)
Program: https://explorer.solana.com/address/E9UmQYi4gTHyyQ3SK5B4UCpewBnUBFrEc5NqkkAjr42h?cluster=devnet

Vault 5 finalize (full loop): https://explorer.solana.com/tx/5Nun4qFDYFgv2EQ3Cca7kLz9KRfpFEF96dUTxV8oPMSdUTpHvUcWKLNVVLNzLYtrickVKofjCBuQTHHQWGZFQL8C?cluster=devnet

Vault 8 place_bid (TEE): https://explorer.solana.com/tx/5Br79RtgYTWsFAoF4MtqPJp2fMgj68Rp9KcNncYm4jg5pQQWoJm7d3DPhXvKSU2N8FdCB3TV9kK9df6AXXMJ46DR?cluster=devnet

Vault 8 buy_peek (TEE): https://explorer.solana.com/tx/5DnHvBaZT3dy71TM47vNch9Zx69cc8bfS8GtNMNA1ySf84HFAgwsgRXPQj1GraV4zgR4F4dKpFNMTUbfzxjZvkKV?cluster=devnet

Peek fee Solana: https://explorer.solana.com/tx/4x4JX9XQvMYg91Uehuyf87sLmAVi8pdRNmYjfykatcAKvPsYpCfX3DAKcXo4SJUnUSosTcoC8QehZ6U1eoeZY3X4?cluster=devnet

## On-chain addresses
- Program ID: `E9UmQYi4gTHyyQ3SK5B4UCpewBnUBFrEc5NqkkAjr42h`
- House PDA: `C7cfsQFawFQkNk6GsRk4LuCtRcUGAg1Ux7mp66EQDDFE`
- SCRIP mint: `5RMEdwxEqfsdqiuSr658N4M5JFyTSeMC4KcF9b41bWHx`
- TEE validator: `MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo`
- Active Vault 8: `H7eRknqjXbhho9MKk3vfu7rV4VmqvqNrN4RiXjdjU5VD`
- Operator: `4qwVufZVGEgY4WB1ALNGUzqd8DRQQk55SiJQL1zZAUy7`

## MagicBlock stack used
Private Ephemeral Rollups (`devnet-tee`) · ephemeral permissions / ACLs · commit+undelegate settlement · (VRF: planned; fill currently TEE-local entropy — disclose)
