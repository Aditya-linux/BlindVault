from pathlib import Path

p = Path(r"programs/blind_vault/src/lib.rs")
text = p.read_text(encoding="utf-8")


def rename_handler(fn_name: str, src: str) -> str:
    start = src.find(f"pub fn {fn_name}(")
    if start < 0:
        raise SystemExit(f"missing {fn_name}")
    next_fn = src.find("\n    pub fn ", start + 1)
    if next_fn < 0:
        next_fn = src.find("\n}", start)
    body = src[start:next_fn]
    new_body = body.replace("ctx.accounts.vault", "ctx.accounts.lot")
    new_body = new_body.replace(
        "ctx.accounts.ephemeral_lot", "ctx.accounts.ephemeral_vault"
    )
    return src[:start] + new_body + src[next_fn:]


for fn in ["buy_peek", "settle_winning_bid", "refund_bid", "close_peek"]:
    text = rename_handler(fn, text)

replacements = [
    (
        """pub struct BuyPeek<'info> {
    pub buyer: Signer<'info>,
    #[account(
        mut,
        sponsor,
        seeds = [VAULT_SEED, vault.house.as_ref(), &vault.id.to_le_bytes()],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,
    pub contents: Account<'info, VaultContents>,
    pub pool_ledger: Account<'info, PoolLedger>,
    /// CHECK: peek
    #[account(
        mut,
        eph,
        seeds = [PEEK_SEED, vault.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub peek: UncheckedAccount<'info>,""",
        """pub struct BuyPeek<'info> {
    pub buyer: Signer<'info>,
    #[account(
        mut,
        sponsor,
        seeds = [VAULT_SEED, lot.house.as_ref(), &lot.id.to_le_bytes()],
        bump = lot.bump
    )]
    pub lot: Account<'info, Vault>,
    pub contents: Account<'info, VaultContents>,
    pub pool_ledger: Account<'info, PoolLedger>,
    /// CHECK: peek
    #[account(
        mut,
        eph,
        seeds = [PEEK_SEED, lot.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub peek: UncheckedAccount<'info>,""",
    ),
    (
        """pub struct SettleWinningBid<'info> {
    #[account(
        mut,
        sponsor,
        seeds = [VAULT_SEED, vault.house.as_ref(), &vault.id.to_le_bytes()],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,
    /// CHECK: ephemeral winning bid
    #[account(
        mut,
        eph,
        seeds = [BID_SEED, vault.key().as_ref(), vault.winner.as_ref()],
        bump
    )]
    pub bid: UncheckedAccount<'info>,
    /// CHECK: permission
    #[account(mut)]
    pub bid_permission: UncheckedAccount<'info>,
    /// CHECK: vault escrow eATA
    #[account(mut)]
    pub escrow: UncheckedAccount<'info>,
    /// CHECK: house treasury eATA (or ATA mirrored on TEE)
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,
    /// CHECK: ephemeral vault
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: magic
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
    /// CHECK: permission program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    /// CHECK: ephemeral SPL token program on TEE
    pub token_program: UncheckedAccount<'info>,
}""",
        """pub struct SettleWinningBid<'info> {
    #[account(
        mut,
        sponsor,
        seeds = [VAULT_SEED, lot.house.as_ref(), &lot.id.to_le_bytes()],
        bump = lot.bump
    )]
    pub lot: Account<'info, Vault>,
    /// CHECK: ephemeral winning bid
    #[account(
        mut,
        eph,
        seeds = [BID_SEED, lot.key().as_ref(), lot.winner.as_ref()],
        bump
    )]
    pub bid: UncheckedAccount<'info>,
    /// CHECK: permission
    #[account(mut)]
    pub bid_permission: UncheckedAccount<'info>,
    /// Vault escrow ATA (canonical on TEE)
    #[account(mut)]
    pub escrow: Account<'info, TokenAccount>,
    /// House treasury ATA
    #[account(mut)]
    pub treasury: Account<'info, TokenAccount>,
    /// CHECK: ephemeral vault
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: magic
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
    /// CHECK: permission program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}""",
    ),
    (
        """pub struct RefundBid<'info> {
    /// CHECK: bidder identity checked against Bid
    pub bidder: UncheckedAccount<'info>,
    #[account(
        mut,
        sponsor,
        seeds = [VAULT_SEED, vault.house.as_ref(), &vault.id.to_le_bytes()],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,
    /// CHECK: ephemeral bid
    #[account(
        mut,
        eph,
        seeds = [BID_SEED, vault.key().as_ref(), bidder.key().as_ref()],
        bump
    )]
    pub bid: UncheckedAccount<'info>,
    /// CHECK: permission
    #[account(mut)]
    pub bid_permission: UncheckedAccount<'info>,
    /// CHECK: vault escrow eATA
    #[account(mut)]
    pub escrow: UncheckedAccount<'info>,
    /// CHECK: bidder SCRIP eATA
    #[account(mut)]
    pub bidder_scrip: UncheckedAccount<'info>,
    /// CHECK: ephemeral vault
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: magic
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
    /// CHECK: permission program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    /// CHECK: ephemeral SPL token program on TEE
    pub token_program: UncheckedAccount<'info>,
}""",
        """pub struct RefundBid<'info> {
    /// CHECK: bidder identity checked against Bid
    pub bidder: UncheckedAccount<'info>,
    #[account(
        mut,
        sponsor,
        seeds = [VAULT_SEED, lot.house.as_ref(), &lot.id.to_le_bytes()],
        bump = lot.bump
    )]
    pub lot: Account<'info, Vault>,
    /// CHECK: ephemeral bid
    #[account(
        mut,
        eph,
        seeds = [BID_SEED, lot.key().as_ref(), bidder.key().as_ref()],
        bump
    )]
    pub bid: UncheckedAccount<'info>,
    /// CHECK: permission
    #[account(mut)]
    pub bid_permission: UncheckedAccount<'info>,
    /// Vault escrow ATA
    #[account(mut)]
    pub escrow: Account<'info, TokenAccount>,
    /// Bidder SCRIP ATA
    #[account(mut)]
    pub bidder_scrip: Account<'info, TokenAccount>,
    /// CHECK: ephemeral vault
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: magic
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
    /// CHECK: permission program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}""",
    ),
    (
        """pub struct ClosePeek<'info> {
    /// CHECK: buyer
    pub buyer: UncheckedAccount<'info>,
    #[account(
        mut,
        sponsor,
        seeds = [VAULT_SEED, vault.house.as_ref(), &vault.id.to_le_bytes()],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,
    /// CHECK: peek
    #[account(
        mut,
        eph,
        seeds = [PEEK_SEED, vault.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub peek: UncheckedAccount<'info>,""",
        """pub struct ClosePeek<'info> {
    /// CHECK: buyer
    pub buyer: UncheckedAccount<'info>,
    #[account(
        mut,
        sponsor,
        seeds = [VAULT_SEED, lot.house.as_ref(), &lot.id.to_le_bytes()],
        bump = lot.bump
    )]
    pub lot: Account<'info, Vault>,
    /// CHECK: peek
    #[account(
        mut,
        eph,
        seeds = [PEEK_SEED, lot.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub peek: UncheckedAccount<'info>,""",
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit("block not found:\n" + old[:160])
    text = text.replace(old, new, 1)

old_refund_check = """        {
            let scrip_data = ctx.accounts.bidder_scrip.try_borrow_data()?;
            require!(scrip_data.len() >= 64, ErrorCode::WrongRefundAccount);
            let token_owner = Pubkey::new_from_array(scrip_data[32..64].try_into().unwrap());
            require_keys_eq!(token_owner, bid.bidder, ErrorCode::WrongRefundAccount);
        }"""
new_refund_check = """        require_keys_eq!(
            ctx.accounts.bidder_scrip.owner,
            bid.bidder,
            ErrorCode::WrongRefundAccount
        );"""
if old_refund_check not in text:
    raise SystemExit("refund check not found")
text = text.replace(old_refund_check, new_refund_check, 1)

p.write_text(text, encoding="utf-8")
print("OK")
