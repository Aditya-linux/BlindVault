//! Pulse Call — directional SOL/USD calls on MagicBlock Ephemeral Rollups.
//! Devnet / localnet only. Guest practice lives client-side; this program is the
//! onchain settle path once a wallet + pool are wired.
use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral, vrf, vrf_callback};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::MagicIntentBundleBuilder;
use ephemeral_rollups_sdk::vrf::{
    instructions::{create_request_scoped_randomness_ix, RequestRandomnessParams},
    types::SerializableAccountMeta,
};

declare_id!("BZ6PBwRABDTDsifdLoBKGbzXbxX5bGxStGyvbzneM9H1");

pub const SCHEMA_VERSION: u8 = 1;
pub const POOL_SEED: &[u8] = b"pulse_pool";
pub const CALL_SEED: &[u8] = b"pulse_call";
pub const BASIS_POINTS: u64 = 10_000;
/// Default payout multiplier in bps (1.8x) before VRF pulse trim.
pub const DEFAULT_PAYOUT_BPS: u64 = 18_000;

pub mod call_status {
    pub const IDLE: u8 = 0;
    pub const OPEN: u8 = 1;
    pub const SETTLED: u8 = 2;
}

pub mod direction {
    pub const UP: u8 = 0;
    pub const DOWN: u8 = 1;
}

#[error_code]
pub enum PulseError {
    #[msg("Unauthorized signer")]
    Unauthorized,
    #[msg("Call is not idle")]
    CallNotIdle,
    #[msg("Call is not open")]
    CallNotOpen,
    #[msg("Duration must be positive")]
    InvalidDuration,
    #[msg("Invalid direction")]
    InvalidDirection,
    #[msg("Settle time has not arrived")]
    TooEarly,
    #[msg("Oracle account data too short")]
    BadOracle,
}

#[account]
pub struct Pool {
    pub schema_version: u8,
    pub authority: Pubkey,
    pub price_feed: Pubkey,
    pub payout_bps: u64,
    pub min_duration_secs: i64,
    pub max_duration_secs: i64,
    pub bump: u8,
}

impl Pool {
    pub const SPACE: usize = 8 + 1 + 32 + 32 + 8 + 8 + 8 + 1;
}

#[account]
pub struct Call {
    pub schema_version: u8,
    pub player: Pubkey,
    pub status: u8,
    pub direction: u8,
    pub open_price: i64,
    pub settle_price: i64,
    pub open_slot: u64,
    pub expiry_unix: i64,
    pub payout_bps: u64,
    pub pulse_seed: u32,
    pub won: bool,
    pub bump: u8,
}

impl Call {
    pub const SPACE: usize = 8 + 1 + 32 + 1 + 1 + 8 + 8 + 8 + 8 + 8 + 4 + 1 + 1;
}

/// Read signed price (i64 LE) at offset 73 — MagicBlock ephemeral oracle / Pyth V2 layout.
pub fn read_oracle_price(data: &[u8]) -> Result<i64> {
    require!(data.len() >= 81, PulseError::BadOracle);
    let bytes: [u8; 8] = data[73..81]
        .try_into()
        .map_err(|_| error!(PulseError::BadOracle))?;
    Ok(i64::from_le_bytes(bytes))
}

#[ephemeral]
#[program]
pub mod pulse_call {
    use super::*;

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        price_feed: Pubkey,
        payout_bps: u64,
        min_duration_secs: i64,
        max_duration_secs: i64,
    ) -> Result<()> {
        require!(payout_bps >= BASIS_POINTS, PulseError::InvalidDuration);
        require!(min_duration_secs > 0, PulseError::InvalidDuration);
        require!(
            max_duration_secs >= min_duration_secs,
            PulseError::InvalidDuration
        );

        let pool = &mut ctx.accounts.pool;
        pool.schema_version = SCHEMA_VERSION;
        pool.authority = ctx.accounts.authority.key();
        pool.price_feed = price_feed;
        pool.payout_bps = payout_bps;
        pool.min_duration_secs = min_duration_secs;
        pool.max_duration_secs = max_duration_secs;
        pool.bump = ctx.bumps.pool;
        Ok(())
    }

    /// Create reusable per-player Call PDA on base layer before ER delegate.
    pub fn create_call(ctx: Context<CreateCall>) -> Result<()> {
        let call = &mut ctx.accounts.call;
        call.schema_version = SCHEMA_VERSION;
        call.player = ctx.accounts.player.key();
        call.status = call_status::IDLE;
        call.direction = 0;
        call.open_price = 0;
        call.settle_price = 0;
        call.open_slot = 0;
        call.expiry_unix = 0;
        call.payout_bps = 0;
        call.pulse_seed = 0;
        call.won = false;
        call.bump = ctx.bumps.call;
        Ok(())
    }

    /// Delegate Call PDA into the Ephemeral Rollup for low-latency place/settle.
    pub fn delegate(ctx: Context<DelegateCall>) -> Result<()> {
        ctx.accounts.delegate_call(
            &ctx.accounts.player,
            &[CALL_SEED, ctx.accounts.player.key().as_ref()],
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
                ..Default::default()
            },
        )?;
        Ok(())
    }

    /// Open a directional call against the live ER oracle price.
    pub fn place_call(
        ctx: Context<PlaceCall>,
        direction: u8,
        duration_secs: i64,
    ) -> Result<()> {
        require!(
            direction == direction::UP || direction == direction::DOWN,
            PulseError::InvalidDirection
        );
        let pool = &ctx.accounts.pool;
        require!(
            duration_secs >= pool.min_duration_secs
                && duration_secs <= pool.max_duration_secs,
            PulseError::InvalidDuration
        );

        let call = &mut ctx.accounts.call;
        require!(call.status == call_status::IDLE, PulseError::CallNotIdle);
        require_keys_eq!(call.player, ctx.accounts.player.key());

        let price = read_oracle_price(&ctx.accounts.price_feed.try_borrow_data()?)?;
        let clock = Clock::get()?;

        call.status = call_status::OPEN;
        call.direction = direction;
        call.open_price = price;
        call.settle_price = 0;
        call.open_slot = clock.slot;
        call.expiry_unix = clock.unix_timestamp + duration_secs;
        call.payout_bps = pool.payout_bps;
        call.pulse_seed = 0;
        call.won = false;
        Ok(())
    }

    /// Request MagicBlock VRF to trim the payout pulse (entertainment fairness).
    pub fn request_pulse(ctx: Context<RequestPulse>, client_seed: u8) -> Result<()> {
        let call = &ctx.accounts.call;
        require!(call.status == call_status::OPEN, PulseError::CallNotOpen);

        let ix = create_request_scoped_randomness_ix(RequestRandomnessParams {
            payer: ctx.accounts.player.key(),
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: crate::ID,
            callback_discriminator: crate::instruction::ConsumePulse::DISCRIMINATOR.to_vec(),
            caller_seed: [client_seed; 32],
            accounts_metas: Some(vec![SerializableAccountMeta {
                pubkey: call.key(),
                is_signer: false,
                is_writable: true,
            }]),
            callback_args: Some(vec![client_seed]),
            ..Default::default()
        });
        ctx.accounts
            .invoke_signed_vrf(&ctx.accounts.player.to_account_info(), &ix)?;
        Ok(())
    }

    pub fn consume_pulse(
        ctx: Context<ConsumePulse>,
        randomness: [u8; 32],
        _client_seed: u8,
    ) -> Result<()> {
        let call = &mut ctx.accounts.call;
        require!(call.status == call_status::OPEN, PulseError::CallNotOpen);
        let pulse = u32::from_le_bytes([
            randomness[0],
            randomness[1],
            randomness[2],
            randomness[3],
        ]);
        call.pulse_seed = pulse;
        // Trim payout between 100% and configured payout_bps using low 16 bits.
        let span = call.payout_bps.saturating_sub(BASIS_POINTS);
        let trim = (u64::from(pulse & 0xffff) * span) / u64::from(u16::MAX);
        call.payout_bps = BASIS_POINTS + trim;
        Ok(())
    }

    /// Settle against the current oracle price after expiry.
    pub fn settle_call(ctx: Context<SettleCall>) -> Result<()> {
        let call = &mut ctx.accounts.call;
        require!(call.status == call_status::OPEN, PulseError::CallNotOpen);
        require_keys_eq!(call.player, ctx.accounts.player.key());

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= call.expiry_unix,
            PulseError::TooEarly
        );

        let settle = read_oracle_price(&ctx.accounts.price_feed.try_borrow_data()?)?;
        call.settle_price = settle;

        if settle == call.open_price {
            call.won = false;
            call.status = call_status::SETTLED;
            return Ok(());
        }

        let went_up = settle > call.open_price;
        let called_up = call.direction == direction::UP;
        call.won = went_up == called_up;
        call.status = call_status::SETTLED;
        Ok(())
    }

    /// Reset settled call so the same PDA can be reused.
    pub fn reset_call(ctx: Context<ResetCall>) -> Result<()> {
        let call = &mut ctx.accounts.call;
        require_keys_eq!(call.player, ctx.accounts.player.key());
        require!(
            call.status == call_status::SETTLED || call.status == call_status::IDLE,
            PulseError::CallNotOpen
        );
        call.status = call_status::IDLE;
        call.direction = 0;
        call.open_price = 0;
        call.settle_price = 0;
        call.open_slot = 0;
        call.expiry_unix = 0;
        call.payout_bps = 0;
        call.pulse_seed = 0;
        call.won = false;
        Ok(())
    }

    pub fn undelegate_call(ctx: Context<UndelegateCall>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.player.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.call.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = Pool::SPACE,
        seeds = [POOL_SEED],
        bump
    )]
    pub pool: Account<'info, Pool>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateCall<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(
        init,
        payer = player,
        space = Call::SPACE,
        seeds = [CALL_SEED, player.key().as_ref()],
        bump
    )]
    pub call: Account<'info, Call>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateCall<'info> {
    pub player: Signer<'info>,
    /// CHECK: PDA seeds enforced by delegate macro
    #[account(mut, del)]
    pub call: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct PlaceCall<'info> {
    pub player: Signer<'info>,
    #[account(seeds = [POOL_SEED], bump = pool.bump)]
    pub pool: Account<'info, Pool>,
    #[account(
        mut,
        seeds = [CALL_SEED, player.key().as_ref()],
        bump = call.bump
    )]
    pub call: Account<'info, Call>,
    /// CHECK: MagicBlock / Pyth price feed account on the ER
    pub price_feed: UncheckedAccount<'info>,
}

#[vrf]
#[derive(Accounts)]
pub struct RequestPulse<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(
        mut,
        seeds = [CALL_SEED, player.key().as_ref()],
        bump = call.bump
    )]
    pub call: Account<'info, Call>,
    /// CHECK: MagicBlock VRF oracle queue (base or ephemeral / test variants)
    #[account(mut)]
    pub oracle_queue: UncheckedAccount<'info>,
}

#[vrf_callback]
#[derive(Accounts)]
pub struct ConsumePulse<'info> {
    #[account(mut)]
    pub call: Account<'info, Call>,
}

#[derive(Accounts)]
pub struct SettleCall<'info> {
    pub player: Signer<'info>,
    #[account(
        mut,
        seeds = [CALL_SEED, player.key().as_ref()],
        bump = call.bump
    )]
    pub call: Account<'info, Call>,
    /// CHECK: MagicBlock / Pyth price feed account on the ER
    pub price_feed: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct ResetCall<'info> {
    pub player: Signer<'info>,
    #[account(
        mut,
        seeds = [CALL_SEED, player.key().as_ref()],
        bump = call.bump
    )]
    pub call: Account<'info, Call>,
}

#[commit]
#[derive(Accounts)]
pub struct UndelegateCall<'info> {
    #[account(mut)]
    pub player: Signer<'info>,
    #[account(mut)]
    pub call: Account<'info, Call>,
}
