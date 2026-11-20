use anchor_lang::prelude::*;
use crate::constants::{MAX_ITEMS_POOL, MAX_ITEMS_VAULT, NUM_HINTS};

#[account]
pub struct House {
    pub authority: Pubkey,
    pub scrip_mint: Pubkey,
    pub treasury: Pubkey,
    pub item_count: u16,
    pub next_vault_id: u64,
    pub active_vault: Pubkey,
    pub peek_fee: [u64; 3],
    pub min_bid: [u64; 3],
    pub duration_secs: [i64; 3],
    pub consign_fee_bps: u16,
    pub bump: u8,
}

impl House {
    pub const LEN: usize = 32 + 32 + 32 + 2 + 8 + 32 + (8 * 3) + (8 * 3) + (8 * 3) + 2 + 1;
}

#[account]
pub struct Item {
    pub house: Pubkey,
    pub index: u16,
    pub mint: Pubkey,
    pub rarity: u8,
    pub category: u8,
    pub value: u32,
    pub name: [u8; 24],
    pub sold: bool,
    pub owner: Pubkey,
    pub bump: u8,
}

impl Item {
    pub const LEN: usize = 32 + 2 + 32 + 1 + 1 + 4 + 24 + 1 + 32 + 1;
}

#[account]
pub struct FaucetTicket {
    pub user: Pubkey,
    pub last_claim_ts: i64,
    pub bump: u8,
}

impl FaucetTicket {
    pub const LEN: usize = 32 + 8 + 1;
}

#[account]
pub struct PoolLedger {
    pub house: Pubkey,
    pub reserved: [u8; 8],
    pub sold: [u8; 8],
    pub item_count: u16,
    pub values: [u32; MAX_ITEMS_POOL],
    pub rarities: [u8; MAX_ITEMS_POOL],
    pub categories: [u8; MAX_ITEMS_POOL],
    pub bump: u8,
}

impl PoolLedger {
    pub const LEN: usize =
        32 + 8 + 8 + 2 + (4 * MAX_ITEMS_POOL) + MAX_ITEMS_POOL + MAX_ITEMS_POOL + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum VaultStatus {
    Created,
    Delegated,
    Filling,
    Open,
    Ended,
    Revealed,
    Abandoned,
    Closed,
    Settled,
}

#[account]
pub struct Vault {
    pub house: Pubkey,
    pub id: u64,
    pub size: u8,
    pub item_count: u8,
    pub min_bid: u64,
    pub peek_fee: u64,
    pub duration_secs: i64,
    pub open_ts: i64,
    pub deadline_ts: i64,
    pub hint_times: [i64; NUM_HINTS],
    pub status: VaultStatus,
    pub bid_count: u8,
    pub closed_bid_count: u8,
    pub peeks_sold: u8,
    pub closed_peek_count: u8,
    pub highest_bid: u64,
    pub winner: Pubkey,
    pub winner_index: u8,
    pub revealed_items: [u16; MAX_ITEMS_VAULT],
    pub revealed_value: u32,
    pub vrf_request_slot: u64,
    pub escrow: Pubkey,
    pub abandoned: bool,
    pub bump: u8,
}

impl Vault {
    pub const LEN: usize = 32
        + 8
        + 1
        + 1
        + 8
        + 8
        + 8
        + 8
        + 8
        + (8 * NUM_HINTS)
        + 1
        + 1
        + 1
        + 1
        + 1
        + 8
        + 32
        + 1
        + (2 * MAX_ITEMS_VAULT)
        + 4
        + 8
        + 32
        + 1
        + 1;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct Hint {
    pub kind: u8,
    pub released: bool,
    pub a: u32,
    pub b: u32,
    pub released_ts: i64,
}

#[account]
pub struct VaultHints {
    pub vault: Pubkey,
    pub hints: [Hint; NUM_HINTS],
    pub bump: u8,
}

impl VaultHints {
    pub const LEN: usize = 32 + (NUM_HINTS * (1 + 1 + 4 + 4 + 8)) + 1;
}

#[account]
pub struct VaultContents {
    pub vault: Pubkey,
    pub items: [u16; MAX_ITEMS_VAULT],
    pub len: u8,
    pub total_value: u32,
    pub seed: [u8; 32],
    pub filled: bool,
    pub revealed: bool,
    pub bump: u8,
}

impl VaultContents {
    pub const LEN: usize = 32 + (2 * MAX_ITEMS_VAULT) + 1 + 4 + 32 + 1 + 1 + 1;
}

#[account]
pub struct Bid {
    pub vault: Pubkey,
    pub bidder: Pubkey,
    pub amount: u64,
    pub bidder_index: u8,
    pub escrow: Pubkey,
    pub placed_ts: i64,
    pub bump: u8,
}

impl Bid {
    pub const LEN: usize = 32 + 32 + 8 + 1 + 32 + 8 + 1;
}

#[account]
pub struct Peek {
    pub vault: Pubkey,
    pub buyer: Pubkey,
    pub slot: u8,
    pub rarity: u8,
    pub category: u8,
    pub bump: u8,
}

impl Peek {
    pub const LEN: usize = 32 + 32 + 1 + 1 + 1 + 1;
}
