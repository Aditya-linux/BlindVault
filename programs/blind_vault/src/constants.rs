use anchor_lang::prelude::*;

pub const HOUSE_SEED: &[u8] = b"house";
pub const ITEM_SEED: &[u8] = b"item";
/// Bumped when prior pool PDAs left TEE-private ghosts / stale vault-only members
/// after round close (next vault could not UpdateEphemeralPermission).
/// Bumped when TEE lost the delegated pool clone (touch could not rehydrate).
pub const POOL_SEED: &[u8] = b"pool_v9";
pub const VAULT_SEED: &[u8] = b"vault";
pub const HINTS_SEED: &[u8] = b"hints";
pub const CONTENTS_SEED: &[u8] = b"contents";
pub const BID_SEED: &[u8] = b"bid";
pub const PEEK_SEED: &[u8] = b"peek";
pub const FAUCET_SEED: &[u8] = b"faucet";
pub const PAYMENT_SEED: &[u8] = b"payment";

pub const MAX_ITEMS_POOL: usize = 64;
pub const MAX_ITEMS_VAULT: usize = 8;
pub const MAX_BIDDERS: usize = 8;
pub const NUM_HINTS: usize = 4;
pub const HINT_BPS: [u16; 4] = [0, 3000, 5500, 8000];
pub const FAUCET_AMOUNT: u64 = 500_000_000; // 500 SCRIP (6 decimals)
pub const FAUCET_COOLDOWN: i64 = 12 * 3600;

pub const ITEM_COUNT_BY_SIZE: [u8; 3] = [3, 5, 8];

/// Devnet TEE validator (devnet-tee.magicblock.app)
pub const TEE_VALIDATOR: Pubkey = pubkey!("MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo");

pub const EPHEMERAL_SPL_TOKEN_PROGRAM_ID: Pubkey =
    pubkey!("SPLxh1LVZzEkX99H6rqYizhytLWPZVV296zyYDPagv2");
pub const DELEGATION_PROGRAM_ID: Pubkey =
    pubkey!("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
