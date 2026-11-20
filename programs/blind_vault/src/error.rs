use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid vault size")]
    InvalidSize,
    #[msg("Invalid rarity")]
    InvalidRarity,
    #[msg("Invalid category")]
    InvalidCategory,
    #[msg("Item pool is full")]
    PoolFull,
    #[msg("Missing item account")]
    MissingItem,
    #[msg("Not enough free items for this vault")]
    NotEnoughItems,
    #[msg("A vault is already active")]
    VaultAlreadyActive,
    #[msg("Bad vault status for this instruction")]
    BadStatus,
    #[msg("Invalid VRF queue")]
    InvalidQueue,
    #[msg("Vault already filled")]
    AlreadyFilled,
    #[msg("Hint is not due yet")]
    HintNotDue,
    #[msg("Hint already released")]
    HintAlreadyReleased,
    #[msg("Invalid hint index or kind")]
    InvalidHint,
    #[msg("Auction is closed")]
    AuctionClosed,
    #[msg("Auction is still open")]
    AuctionStillOpen,
    #[msg("Too many bidders")]
    TooManyBidders,
    #[msg("Bid below minimum")]
    BidBelowMinimum,
    #[msg("Already bid on this vault")]
    AlreadyBid,
    #[msg("Already peeked this vault")]
    AlreadyPeeked,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Missing bid account")]
    MissingBid,
    #[msg("Invalid bid account")]
    InvalidBid,
    #[msg("Invalid bid escrow")]
    InvalidBidEscrow,
    #[msg("Duplicate bid")]
    DuplicateBid,
    #[msg("Wrong refund account")]
    WrongRefundAccount,
    #[msg("Contents already revealed")]
    AlreadyRevealed,
    #[msg("Not all bids closed")]
    UnclosedBids,
    #[msg("Not all peeks closed")]
    UnclosedPeeks,
    #[msg("Vault not undelegated yet")]
    NotUndelegated,
    #[msg("Item mismatch on finalize")]
    ItemMismatch,
    #[msg("Faucet cooldown active")]
    FaucetCooldown,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Mint mismatch")]
    MintMismatch,
    #[msg("Invalid token owner")]
    InvalidTokenOwner,
}
