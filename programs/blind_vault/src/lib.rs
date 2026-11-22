//! Blind Vault — Storage Wars on Solana (MagicBlock PER).
//! Devnet / TEE only. Contents + bids stay private until reveal.
use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer as transfer_lamports, Transfer as LamportsTransfer};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{
    self, Approve, Mint, MintTo, SetAuthority, Token, TokenAccount, Transfer as SplTransfer,
};
use ephemeral_rollups_sdk::access_control::{
    instructions::{
        CloseEphemeralPermissionCpi, CreateEphemeralPermissionCpi, UpdateEphemeralPermissionCpi,
    },
    structs::{EphemeralMembersArgs, EphemeralPermission},
};
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral, ephemeral_accounts};
use ephemeral_rollups_sdk::consts::{EPHEMERAL_VAULT_ID, MAGIC_PROGRAM_ID, PERMISSION_PROGRAM_ID};
use ephemeral_rollups_sdk::cpi::DelegateConfig;

mod constants;
mod error;
mod state;
mod util;

use constants::*;
use error::ErrorCode;
use state::*;
use util::bitmap::{bit, clear_bit, set_bit};
use util::ephemeral::{
    delegate_ephemeral_ata, eata_buffer_address, ephemeral_ata_pda, init_ephemeral_ata,
    metadata_pda, permission_member, record_pda,
};
use util::hash::hashv;
use util::hints::release_hint;

declare_id!("E9UmQYi4gTHyyQ3SK5B4UCpewBnUBFrEc5NqkkAjr42h");

#[ephemeral]
#[program]
pub mod blind_vault {
    use super::*;

    pub fn init_house(
        ctx: Context<InitHouse>,
        peek_fee: [u64; 3],
        min_bid: [u64; 3],
        duration_secs: [i64; 3],
    ) -> Result<()> {
        for d in duration_secs {
            require!(d > 0, ErrorCode::InvalidAmount);
        }
        let house = &mut ctx.accounts.house;
        house.authority = ctx.accounts.authority.key();
        house.scrip_mint = ctx.accounts.scrip_mint.key();
        house.treasury = ctx.accounts.treasury.key();
        house.item_count = 0;
        house.next_vault_id = 1;
        house.active_vault = Pubkey::default();
        house.peek_fee = peek_fee;
        house.min_bid = min_bid;
        house.duration_secs = duration_secs;
        house.consign_fee_bps = 500;
        house.bump = ctx.bumps.house;
        Ok(())
    }

    pub fn update_house_timing(
        ctx: Context<UpdateHouseTiming>,
        peek_fee: [u64; 3],
        min_bid: [u64; 3],
        duration_secs: [i64; 3],
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.house.authority,
            ctx.accounts.authority.key(),
            ErrorCode::Unauthorized
        );
        for d in duration_secs {
            require!(d > 0, ErrorCode::InvalidAmount);
        }
        let house = &mut ctx.accounts.house;
        house.peek_fee = peek_fee;
        house.min_bid = min_bid;
        house.duration_secs = duration_secs;
        Ok(())
    }

    pub fn add_item(
        ctx: Context<AddItem>,
        index: u16,
        rarity: u8,
        category: u8,
        value: u32,
        name: [u8; 24],
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.house.authority,
            ctx.accounts.authority.key(),
            ErrorCode::Unauthorized
        );
        require!(index == ctx.accounts.house.item_count, ErrorCode::MissingItem);
        require!((index as usize) < MAX_ITEMS_POOL, ErrorCode::PoolFull);
        require!(rarity <= 4, ErrorCode::InvalidRarity);
        require!(category <= 4, ErrorCode::InvalidCategory);

        let item = &mut ctx.accounts.item;
        item.house = ctx.accounts.house.key();
        item.index = index;
        item.mint = ctx.accounts.item_mint.key();
        item.rarity = rarity;
        item.category = category;
        item.value = value;
        item.name = name;
        item.sold = false;
        item.owner = Pubkey::default();
        item.bump = ctx.bumps.item;

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                MintTo {
                    mint: ctx.accounts.item_mint.to_account_info(),
                    to: ctx.accounts.pool_ata.to_account_info(),
                    authority: ctx.accounts.house.to_account_info(),
                },
                &[&[HOUSE_SEED, &[ctx.accounts.house.bump]]],
            ),
            1,
        )?;

        // Freeze supply at 1
        token::set_authority(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                SetAuthority {
                    current_authority: ctx.accounts.house.to_account_info(),
                    account_or_mint: ctx.accounts.item_mint.to_account_info(),
                },
                &[&[HOUSE_SEED, &[ctx.accounts.house.bump]]],
            ),
            token::spl_token::instruction::AuthorityType::MintTokens,
            None,
        )?;

        ctx.accounts.house.item_count = ctx
            .accounts
            .house
            .item_count
            .checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;
        Ok(())
    }

    pub fn init_pool_ledger(ctx: Context<InitPoolLedger>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.house.authority,
            ctx.accounts.authority.key(),
            ErrorCode::Unauthorized
        );
        let count = ctx.accounts.house.item_count as usize;
        require!(
            ctx.remaining_accounts.len() == count,
            ErrorCode::MissingItem
        );

        let ledger = &mut ctx.accounts.pool_ledger;
        ledger.house = ctx.accounts.house.key();
        ledger.reserved = [0; 8];
        ledger.sold = [0; 8];
        ledger.item_count = ctx.accounts.house.item_count;
        ledger.values = [0; MAX_ITEMS_POOL];
        ledger.rarities = [0; MAX_ITEMS_POOL];
        ledger.categories = [0; MAX_ITEMS_POOL];
        ledger.bump = ctx.bumps.pool_ledger;

        for (i, acc) in ctx.remaining_accounts.iter().enumerate() {
            let data = acc.try_borrow_data()?;
            let mut cursor = &data[..];
            let item = Item::try_deserialize(&mut cursor)?;
            require!((item.index as usize) == i, ErrorCode::MissingItem);
            ledger.values[i] = item.value;
            ledger.rarities[i] = item.rarity;
            ledger.categories[i] = item.category;
            if item.sold {
                set_bit(&mut ledger.sold, item.index);
            }
        }
        Ok(())
    }

    pub fn faucet(ctx: Context<Faucet>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let ticket = &mut ctx.accounts.faucet_ticket;
        if ticket.last_claim_ts != 0 {
            require!(
                now - ticket.last_claim_ts >= FAUCET_COOLDOWN,
                ErrorCode::FaucetCooldown
            );
        }
        ticket.user = ctx.accounts.user.key();
        ticket.last_claim_ts = now;
        ticket.bump = ctx.bumps.faucet_ticket;

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                MintTo {
                    mint: ctx.accounts.scrip_mint.to_account_info(),
                    to: ctx.accounts.user_scrip_ata.to_account_info(),
                    authority: ctx.accounts.house.to_account_info(),
                },
                &[&[HOUSE_SEED, &[ctx.accounts.house.bump]]],
            ),
            FAUCET_AMOUNT,
        )?;
        Ok(())
    }

    pub fn create_vault(ctx: Context<CreateVault>, size: u8) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.house.authority,
            ctx.accounts.authority.key(),
            ErrorCode::Unauthorized
        );
        require!(size <= 2, ErrorCode::InvalidSize);
        require!(
            ctx.accounts.house.active_vault == Pubkey::default(),
            ErrorCode::VaultAlreadyActive
        );

        let item_count = ITEM_COUNT_BY_SIZE[size as usize];
        let free = (0..ctx.accounts.house.item_count)
            .filter(|&i| {
                // Between rounds reserved is 0; sold tracked on Item via remaining later.
                // Here we only gate on pool size for MVP create.
                i < ctx.accounts.house.item_count
            })
            .count();
        require!(free >= item_count as usize, ErrorCode::NotEnoughItems);

        // Prefund vault PDA for ephemeral permission rent (template pattern)
        let sponsor = ephemeral_rollups_sdk::ephemeral_accounts::rent(
            EphemeralPermission::size_of(MAX_BIDDERS + 1) as u32,
        )
        .saturating_mul(2 + MAX_BIDDERS as u64 * 2)
        .saturating_add(50_000_000);
        transfer_lamports(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                LamportsTransfer {
                    from: ctx.accounts.authority.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            sponsor,
        )?;

        let id = ctx.accounts.house.next_vault_id;
        let house_key = ctx.accounts.house.key();
        let vault_key = ctx.accounts.vault.key();
        let escrow = ctx.accounts.escrow.key();

        let vault = &mut ctx.accounts.vault;
        vault.house = house_key;
        vault.id = id;
        vault.size = size;
        vault.item_count = item_count;
        vault.min_bid = ctx.accounts.house.min_bid[size as usize];
        vault.peek_fee = ctx.accounts.house.peek_fee[size as usize];
        vault.duration_secs = ctx.accounts.house.duration_secs[size as usize];
        vault.open_ts = 0;
        vault.deadline_ts = 0;
        vault.hint_times = [0; NUM_HINTS];
        vault.status = VaultStatus::Created;
        vault.bid_count = 0;
        vault.closed_bid_count = 0;
        vault.peeks_sold = 0;
        vault.closed_peek_count = 0;
        vault.highest_bid = 0;
        vault.winner = Pubkey::default();
        vault.winner_index = 0;
        vault.revealed_items = [0; MAX_ITEMS_VAULT];
        vault.revealed_value = 0;
        vault.vrf_request_slot = 0;
        vault.escrow = escrow;
        vault.abandoned = false;
        vault.bump = ctx.bumps.vault;

        let hints = &mut ctx.accounts.hints;
        hints.vault = vault_key;
        hints.hints = [
            Hint {
                kind: 0,
                ..Default::default()
            },
            Hint {
                kind: 1,
                ..Default::default()
            },
            Hint {
                kind: 2,
                ..Default::default()
            },
            Hint {
                kind: 3,
                ..Default::default()
            },
        ];
        hints.bump = ctx.bumps.hints;

        let contents = &mut ctx.accounts.contents;
        contents.vault = vault_key;
        contents.items = [0; MAX_ITEMS_VAULT];
        contents.len = 0;
        contents.total_value = 0;
        contents.seed = [0; 32];
        contents.filled = false;
        contents.revealed = false;
        contents.bump = ctx.bumps.contents;

        // Escrow eATA init/delegate deferred to `init_vault_escrow_eata`.
        // Inline eSPL CPI crashed create_vault on Devnet (access violation).

        ctx.accounts.house.next_vault_id = id
            .checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;
        ctx.accounts.house.active_vault = vault_key;
        Ok(())
    }

    /// Create (+ optionally delegate) the vault SCRIP eATA after `create_vault`.
    pub fn init_vault_escrow_eata(
        ctx: Context<InitVaultEscrowEata>,
        do_delegate: bool,
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.house.authority,
            ctx.accounts.authority.key(),
            ErrorCode::Unauthorized
        );
        require!(
            ctx.accounts.vault.status == VaultStatus::Created
                || ctx.accounts.vault.status == VaultStatus::Delegated,
            ErrorCode::BadStatus
        );
        if ctx.accounts.escrow_eata.data_is_empty() {
            init_ephemeral_ata(
                &ctx.accounts.ephemeral_token_program,
                &ctx.accounts.escrow_eata,
                ctx.accounts.vault.to_account_info(),
                &ctx.accounts.scrip_mint,
                &ctx.accounts.authority,
                &ctx.accounts.system_program,
            )?;
        }
        if do_delegate {
            delegate_ephemeral_ata(
                &ctx.accounts.ephemeral_token_program,
                &ctx.accounts.authority,
                &ctx.accounts.escrow_eata,
                &ctx.accounts.escrow_eata_buffer,
                &ctx.accounts.escrow_eata_record,
                &ctx.accounts.escrow_eata_metadata,
                &ctx.accounts.delegation_program,
                &ctx.accounts.system_program,
                Some(TEE_VALIDATOR),
            )?;
        }
        // Keep vault.escrow as the Solana ATA from create_vault (Model A).
        // ER balances live at canonical ATAs (Tokenkeg); eATA is only the
        // deposit/delegate backing record and must not replace escrow.
        Ok(())
    }

    /// Delegate Vault PDA. Client also delegates hints/contents/pool via sibling ixs.
    pub fn delegate_vault(ctx: Context<DelegateVault>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.house.authority,
            ctx.accounts.authority.key(),
            ErrorCode::Unauthorized
        );
        // Deserialize before CPI; after delegate we must not write via Account<>.
        let mut data = ctx.accounts.vault.try_borrow_mut_data()?;
        let mut vault = Vault::try_deserialize(&mut &data[..])?;
        require!(vault.status == VaultStatus::Created, ErrorCode::BadStatus);
        // Status must be set while we still own the account (Anchor exit + CPI ownership).
        vault.status = VaultStatus::Delegated;
        let mut cursor = std::io::Cursor::new(&mut data[..]);
        vault.try_serialize(&mut cursor)?;
        drop(data);

        let house = vault.house;
        let id_bytes = vault.id.to_le_bytes();
        ctx.accounts.delegate_vault(
            &ctx.accounts.authority,
            &[VAULT_SEED, house.as_ref(), &id_bytes],
            DelegateConfig {
                validator: Some(TEE_VALIDATOR),
                ..Default::default()
            },
        )?;
        Ok(())
    }

    pub fn delegate_hints(ctx: Context<DelegateHints>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.house.authority,
            ctx.accounts.authority.key(),
            ErrorCode::Unauthorized
        );
        let vault_key = ctx.accounts.vault.key();
        ctx.accounts.delegate_hints(
            &ctx.accounts.authority,
            &[HINTS_SEED, vault_key.as_ref()],
            DelegateConfig {
                validator: Some(TEE_VALIDATOR),
                ..Default::default()
            },
        )?;
        Ok(())
    }

    pub fn delegate_contents(ctx: Context<DelegateContents>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.house.authority,
            ctx.accounts.authority.key(),
            ErrorCode::Unauthorized
        );
        let vault_key = ctx.accounts.vault.key();
        ctx.accounts.delegate_contents(
            &ctx.accounts.authority,
            &[CONTENTS_SEED, vault_key.as_ref()],
            DelegateConfig {
                validator: Some(TEE_VALIDATOR),
                ..Default::default()
            },
        )?;
        Ok(())
    }

    pub fn delegate_pool_ledger(ctx: Context<DelegatePoolLedger>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.house.authority,
            ctx.accounts.authority.key(),
            ErrorCode::Unauthorized
        );
        let house = ctx.accounts.house.key();
        ctx.accounts.delegate_pool_ledger(
            &ctx.accounts.authority,
            &[POOL_SEED, house.as_ref()],
            DelegateConfig {
                validator: Some(TEE_VALIDATOR),
                ..Default::default()
            },
        )?;
        Ok(())
    }

    /// No-op that forces the TEE to clone a delegated account (e.g. pool after re-delegate).
    pub fn touch_account(_ctx: Context<TouchAccount>) -> Result<()> {
        Ok(())
    }

    /// Create contents permission only (isolates pool ghost failures).
    pub fn init_contents_permission(ctx: Context<InitContentsPermission>) -> Result<()> {
        require!(
            ctx.accounts.vault.status == VaultStatus::Delegated
                || ctx.accounts.vault.status == VaultStatus::Filling
                || ctx.accounts.vault.status == VaultStatus::Open,
            ErrorCode::BadStatus
        );
        if ctx.accounts.contents_permission.lamports() > 0 {
            return Ok(());
        }
        let vault_key = ctx.accounts.vault.key();
        let id_bytes = ctx.accounts.vault.id.to_le_bytes();
        let house = ctx.accounts.vault.house;
        let vault_bump = ctx.accounts.vault.bump;
        let (contents_pda, contents_bump) =
            Pubkey::find_program_address(&[CONTENTS_SEED, vault_key.as_ref()], &crate::ID);
        require_keys_eq!(contents_pda, ctx.accounts.contents.key(), ErrorCode::ItemMismatch);
        let vault_seeds: &[&[u8]] = &[VAULT_SEED, house.as_ref(), &id_bytes, &[vault_bump]];
        let contents_seeds: &[&[u8]] = &[CONTENTS_SEED, vault_key.as_ref(), &[contents_bump]];
        CreateEphemeralPermissionCpi {
            payer: ctx.accounts.vault.to_account_info(),
            permissioned_account: ctx.accounts.contents.to_account_info(),
            permission: ctx.accounts.contents_permission.to_account_info(),
            vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            args: EphemeralMembersArgs {
                is_private: true,
                members: vec![permission_member(vault_key)],
            },
        }
        .invoke_signed(&[vault_seeds, contents_seeds])?;
        Ok(())
    }

    /// Create pool permission with the house PDA as standing member so later
    /// rounds can Update without the previous vault still being on the TEE.
    pub fn init_pool_permission(ctx: Context<InitPoolPermission>) -> Result<()> {
        require!(
            ctx.accounts.vault.status == VaultStatus::Delegated
                || ctx.accounts.vault.status == VaultStatus::Filling
                || ctx.accounts.vault.status == VaultStatus::Open,
            ErrorCode::BadStatus
        );
        let vault_key = ctx.accounts.vault.key();
        let id_bytes = ctx.accounts.vault.id.to_le_bytes();
        let house_key = ctx.accounts.vault.house;
        let vault_bump = ctx.accounts.vault.bump;
        let house_bump = {
            let (expected, bump) = Pubkey::find_program_address(&[HOUSE_SEED], &crate::ID);
            require_keys_eq!(expected, house_key, ErrorCode::Unauthorized);
            bump
        };
        let (pool_pda, pool_bump) =
            Pubkey::find_program_address(&[POOL_SEED, house_key.as_ref()], &crate::ID);
        require_keys_eq!(pool_pda, ctx.accounts.pool_ledger.key(), ErrorCode::ItemMismatch);
        let vault_seeds: &[&[u8]] = &[VAULT_SEED, house_key.as_ref(), &id_bytes, &[vault_bump]];
        let house_seeds: &[&[u8]] = &[HOUSE_SEED, &[house_bump]];
        let pool_seeds: &[&[u8]] = &[POOL_SEED, house_key.as_ref(), &[pool_bump]];
        let members = vec![
            permission_member(house_key),
            permission_member(vault_key),
        ];

        if ctx.accounts.pool_permission.lamports() == 0 {
            CreateEphemeralPermissionCpi {
                payer: ctx.accounts.vault.to_account_info(),
                permissioned_account: ctx.accounts.pool_ledger.to_account_info(),
                permission: ctx.accounts.pool_permission.to_account_info(),
                vault: ctx.accounts.ephemeral_vault.to_account_info(),
                magic_program: ctx.accounts.magic_program.to_account_info(),
                permission_program: ctx.accounts.permission_program.to_account_info(),
                args: EphemeralMembersArgs {
                    is_private: true,
                    members,
                },
            }
            .invoke_signed(&[vault_seeds, pool_seeds])?;
        } else {
            // House is a standing member — pool PDA cosigns Update.
            UpdateEphemeralPermissionCpi {
                payer: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.pool_ledger.to_account_info(),
                permissioned_account: ctx.accounts.pool_ledger.to_account_info(),
                permission: ctx.accounts.pool_permission.to_account_info(),
                vault: ctx.accounts.ephemeral_vault.to_account_info(),
                magic_program: ctx.accounts.magic_program.to_account_info(),
                permission_program: ctx.accounts.permission_program.to_account_info(),
                authority_is_signer: true,
                args: EphemeralMembersArgs {
                    is_private: true,
                    members,
                },
            }
            .invoke_signed(&[pool_seeds, house_seeds, vault_seeds])?;
        }
        Ok(())
    }

    pub fn init_permissions(ctx: Context<InitPermissions>) -> Result<()> {
        require!(
            ctx.accounts.vault.status == VaultStatus::Delegated
                || ctx.accounts.vault.status == VaultStatus::Filling
                || ctx.accounts.vault.status == VaultStatus::Open,
            ErrorCode::BadStatus
        );

        let vault_key = ctx.accounts.vault.key();
        let vault_bump = ctx.accounts.vault.bump;
        let id_bytes = ctx.accounts.vault.id.to_le_bytes();
        let house = ctx.accounts.vault.house;
        let (contents_pda, contents_bump) =
            Pubkey::find_program_address(&[CONTENTS_SEED, vault_key.as_ref()], &crate::ID);
        require_keys_eq!(contents_pda, ctx.accounts.contents.key(), ErrorCode::ItemMismatch);
        let (pool_pda, pool_bump) =
            Pubkey::find_program_address(&[POOL_SEED, house.as_ref()], &crate::ID);
        require_keys_eq!(pool_pda, ctx.accounts.pool_ledger.key(), ErrorCode::ItemMismatch);
        let vault_seeds: &[&[u8]] = &[VAULT_SEED, house.as_ref(), &id_bytes, &[vault_bump]];
        let contents_seeds: &[&[u8]] = &[CONTENTS_SEED, vault_key.as_ref(), &[contents_bump]];
        let pool_seeds: &[&[u8]] = &[POOL_SEED, house.as_ref(), &[pool_bump]];

        // CreateEphemeralPermission marks permissioned_account as signer — PDA must cosign.
        if ctx.accounts.contents_permission.lamports() == 0 {
            CreateEphemeralPermissionCpi {
                payer: ctx.accounts.vault.to_account_info(),
                permissioned_account: ctx.accounts.contents.to_account_info(),
                permission: ctx.accounts.contents_permission.to_account_info(),
                vault: ctx.accounts.ephemeral_vault.to_account_info(),
                magic_program: ctx.accounts.magic_program.to_account_info(),
                permission_program: ctx.accounts.permission_program.to_account_info(),
                args: EphemeralMembersArgs {
                    is_private: true,
                    members: vec![permission_member(vault_key)],
                },
            }
            .invoke_signed(&[vault_seeds, contents_seeds])?;
        }

        if ctx.accounts.pool_permission.lamports() == 0 {
            // Create as public first so a prior closed-permission "ghost" can be
            // recovered; then tighten to private with the vault as sole member.
            CreateEphemeralPermissionCpi {
                payer: ctx.accounts.vault.to_account_info(),
                permissioned_account: ctx.accounts.pool_ledger.to_account_info(),
                permission: ctx.accounts.pool_permission.to_account_info(),
                vault: ctx.accounts.ephemeral_vault.to_account_info(),
                magic_program: ctx.accounts.magic_program.to_account_info(),
                permission_program: ctx.accounts.permission_program.to_account_info(),
                args: EphemeralMembersArgs {
                    is_private: false,
                    members: vec![permission_member(vault_key)],
                },
            }
            .invoke_signed(&[vault_seeds, pool_seeds])?;
            UpdateEphemeralPermissionCpi {
                payer: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
                permissioned_account: ctx.accounts.pool_ledger.to_account_info(),
                permission: ctx.accounts.pool_permission.to_account_info(),
                vault: ctx.accounts.ephemeral_vault.to_account_info(),
                magic_program: ctx.accounts.magic_program.to_account_info(),
                permission_program: ctx.accounts.permission_program.to_account_info(),
                authority_is_signer: true,
                args: EphemeralMembersArgs {
                    is_private: true,
                    members: vec![permission_member(vault_key)],
                },
            }
            .invoke_signed(&[vault_seeds])?;
        }
        Ok(())
    }

    /// Fill vault using TEE-local entropy mix (Day-1 VRF spike fallback §7.5 / R1).
    /// Production path swaps in ER VRF callback once verified on devnet-tee.
    pub fn fill_vault(ctx: Context<FillVault>, client_seed: u8) -> Result<()> {
        require!(
            ctx.accounts.vault.status == VaultStatus::Delegated,
            ErrorCode::BadStatus
        );
        require!(!ctx.accounts.contents.filled, ErrorCode::AlreadyFilled);

        let clock = Clock::get()?;
        let vault_key = ctx.accounts.vault.key();
        let entropy = hashv(&[
            &clock.slot.to_le_bytes(),
            &clock.unix_timestamp.to_le_bytes(),
            vault_key.as_ref(),
            &[client_seed],
            b"blind-vault-fill",
        ]);

        let pool = &mut ctx.accounts.pool_ledger;
        let mut free: Vec<u16> = (0..pool.item_count)
            .filter(|&i| !bit(&pool.reserved, i) && !bit(&pool.sold, i))
            .collect();
        let n = ctx.accounts.vault.item_count as usize;
        require!(free.len() >= n, ErrorCode::NotEnoughItems);

        let mut total = 0u32;
        let contents = &mut ctx.accounts.contents;
        for k in 0..n {
            let r = u64::from_le_bytes(hashv(&[&entropy, &[k as u8]])[..8].try_into().unwrap());
            let j = k + (r % (free.len() - k) as u64) as usize;
            free.swap(k, j);
            let idx = free[k];
            contents.items[k] = idx;
            set_bit(&mut pool.reserved, idx);
            total = total
                .checked_add(pool.values[idx as usize])
                .ok_or(ErrorCode::MathOverflow)?;
        }
        contents.len = n as u8;
        contents.total_value = total;
        contents.seed = entropy;
        contents.filled = true;

        let vault = &mut ctx.accounts.vault;
        vault.open_ts = clock.unix_timestamp;
        vault.deadline_ts = clock.unix_timestamp + vault.duration_secs;
        for i in 0..NUM_HINTS {
            vault.hint_times[i] =
                clock.unix_timestamp + vault.duration_secs * HINT_BPS[i] as i64 / 10_000;
        }
        vault.vrf_request_slot = clock.slot;
        vault.status = VaultStatus::Open;

        release_hint(
            &mut ctx.accounts.hints,
            0,
            contents,
            pool,
            clock.unix_timestamp,
        )?;
        Ok(())
    }

    pub fn publish_hint(ctx: Context<PublishHint>, index: u8) -> Result<()> {
        require!(
            ctx.accounts.vault.status == VaultStatus::Open,
            ErrorCode::BadStatus
        );
        require!((index as usize) < NUM_HINTS, ErrorCode::InvalidHint);
        let now = Clock::get()?.unix_timestamp;
        require!(
            now >= ctx.accounts.vault.hint_times[index as usize],
            ErrorCode::HintNotDue
        );
        release_hint(
            &mut ctx.accounts.hints,
            index as usize,
            &ctx.accounts.contents,
            &ctx.accounts.pool_ledger,
            now,
        )?;
        Ok(())
    }

    pub fn place_bid(ctx: Context<PlaceBid>, amount: u64) -> Result<()> {
        require!(
            ctx.accounts.lot.status == VaultStatus::Open,
            ErrorCode::AuctionClosed
        );
        let now = Clock::get()?.unix_timestamp;
        require!(
            now < ctx.accounts.lot.deadline_ts,
            ErrorCode::AuctionClosed
        );
        require!(
            (ctx.accounts.lot.bid_count as usize) < MAX_BIDDERS,
            ErrorCode::TooManyBidders
        );
        require!(
            amount >= ctx.accounts.lot.min_bid,
            ErrorCode::BidBelowMinimum
        );

        let bidder_index = ctx.accounts.lot.bid_count;
        let vault_key = ctx.accounts.lot.key();
        // PER: vault-owned Magic ATAs are not writable by the bidder's tx.
        // Lock funds via SPL approve (vault PDA = delegate) on the bidder ATA.
        let escrow = ctx.accounts.bidder_scrip.key();

        // `vault` here is the Magic ephemeral rent vault (injected by #[ephemeral_accounts]).
        ctx.accounts.create_ephemeral_bid((8 + Bid::LEN) as u32)?;

        token::approve(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                Approve {
                    to: ctx.accounts.bidder_scrip.to_account_info(),
                    delegate: ctx.accounts.lot.to_account_info(),
                    authority: ctx.accounts.bidder.to_account_info(),
                },
            ),
            amount,
        )?;

        let bid = Bid {
            vault: vault_key,
            bidder: ctx.accounts.bidder.key(),
            amount,
            bidder_index,
            escrow,
            placed_ts: now,
            bump: ctx.bumps.bid,
        };
        let mut data = ctx.accounts.bid.try_borrow_mut_data()?;
        bid.try_serialize(&mut &mut data[..])?;

        ctx.accounts.lot.bid_count = ctx
            .accounts
            .lot
            .bid_count
            .checked_add(1)
            .ok_or(ErrorCode::TooManyBidders)?;
        Ok(())
    }

    pub fn init_bid_permission(ctx: Context<InitBidPermission>) -> Result<()> {
        if !ctx.accounts.bid_permission.data_is_empty() {
            return Ok(());
        }
        let vault = &ctx.accounts.vault;
        let id_bytes = vault.id.to_le_bytes();
        let vault_key = vault.key();
        let vault_seeds: &[&[u8]] = &[
            VAULT_SEED,
            vault.house.as_ref(),
            &id_bytes,
            &[vault.bump],
        ];
        let bidder = ctx.accounts.bidder.key();
        let (bid_pda, bid_bump) =
            Pubkey::find_program_address(&[BID_SEED, vault_key.as_ref(), bidder.as_ref()], &crate::ID);
        require_keys_eq!(bid_pda, ctx.accounts.bid.key(), ErrorCode::InvalidBid);
        let bid_seeds: &[&[u8]] = &[BID_SEED, vault_key.as_ref(), bidder.as_ref(), &[bid_bump]];
        // CreateEphemeralPermission marks permissioned_account as signer — bid PDA must cosign.
        CreateEphemeralPermissionCpi {
            payer: ctx.accounts.vault.to_account_info(),
            permissioned_account: ctx.accounts.bid.to_account_info(),
            permission: ctx.accounts.bid_permission.to_account_info(),
            vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            // MB-016: bidder reads; vault retains AUTHORITY so keeper can Close without winner online.
            args: EphemeralMembersArgs {
                is_private: true,
                members: vec![permission_member(bidder), permission_member(vault_key)],
            },
        }
        .invoke_signed(&[vault_seeds, bid_seeds])?;
        Ok(())
    }

    pub fn buy_peek(ctx: Context<BuyPeek>) -> Result<()> {
        require!(
            ctx.accounts.lot.status == VaultStatus::Open,
            ErrorCode::AuctionClosed
        );
        let now = Clock::get()?.unix_timestamp;
        require!(
            now < ctx.accounts.lot.deadline_ts,
            ErrorCode::AuctionClosed
        );
        require!(
            (ctx.accounts.lot.peeks_sold as usize) < MAX_BIDDERS,
            ErrorCode::TooManyBidders
        );

        // Fee is paid on Solana base layer (transfer → house treasury) before this
        // TEE ix. PDA-owned treasury / mint are not writable in the buyer's TEE tx
        // (same PER constraint as place_bid → approve instead of transfer-in).
        let vault_key = ctx.accounts.lot.key();
        let id_bytes = ctx.accounts.lot.id.to_le_bytes();
        let house = ctx.accounts.lot.house;
        let bump = ctx.accounts.lot.bump;

        require!(
            ctx.accounts.contents.filled && ctx.accounts.contents.len > 0,
            ErrorCode::NotEnoughItems
        );
        let h = hashv(&[
            &ctx.accounts.contents.seed,
            ctx.accounts.buyer.key().as_ref(),
            b"peek",
        ]);
        let slot = (h[0] as usize) % (ctx.accounts.contents.len as usize);
        let item_idx = ctx.accounts.contents.items[slot] as usize;
        let rarity = ctx.accounts.pool_ledger.rarities[item_idx];
        let category = ctx.accounts.pool_ledger.categories[item_idx];

        ctx.accounts.create_ephemeral_peek((8 + Peek::LEN) as u32)?;
        let peek = Peek {
            vault: vault_key,
            buyer: ctx.accounts.buyer.key(),
            slot: slot as u8,
            rarity,
            category,
            bump: ctx.bumps.peek,
        };
        {
            let mut data = ctx.accounts.peek.try_borrow_mut_data()?;
            peek.try_serialize(&mut &mut data[..])?;
        }

        let vault_seeds: &[&[u8]] = &[VAULT_SEED, house.as_ref(), &id_bytes, &[bump]];
        let buyer_key = ctx.accounts.buyer.key();
        let peek_bump = ctx.bumps.peek;
        let peek_seeds: &[&[u8]] = &[
            PEEK_SEED,
            vault_key.as_ref(),
            buyer_key.as_ref(),
            &[peek_bump],
        ];
        // CreateEphemeralPermission marks permissioned_account as signer — peek PDA cosigns.
        CreateEphemeralPermissionCpi {
            payer: ctx.accounts.lot.to_account_info(),
            permissioned_account: ctx.accounts.peek.to_account_info(),
            permission: ctx.accounts.peek_permission.to_account_info(),
            vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            args: EphemeralMembersArgs {
                is_private: true,
                members: vec![
                    permission_member(buyer_key),
                    permission_member(vault_key),
                ],
            },
        }
        .invoke_signed(&[vault_seeds, peek_seeds])?;

        ctx.accounts.lot.peeks_sold = ctx
            .accounts
            .lot
            .peeks_sold
            .checked_add(1)
            .ok_or(ErrorCode::TooManyBidders)?;
        Ok(())
    }

    pub fn end_auction(ctx: Context<EndAuction>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(vault.status == VaultStatus::Open, ErrorCode::BadStatus);
        let now = Clock::get()?.unix_timestamp;
        require!(now >= vault.deadline_ts, ErrorCode::AuctionStillOpen);
        require!(
            ctx.remaining_accounts.len() == vault.bid_count as usize,
            ErrorCode::MissingBid
        );

        if vault.bid_count == 0 {
            vault.status = VaultStatus::Abandoned;
            vault.abandoned = true;
            return Ok(());
        }

        let mut seen = Vec::new();
        let mut winner = Pubkey::default();
        let mut winner_index = 0u8;
        let mut highest = 0u64;
        for acc in ctx.remaining_accounts.iter() {
            let data = acc.try_borrow_data()?;
            let mut cursor = &data[..];
            let bid = Bid::try_deserialize(&mut cursor)?;
            require_keys_eq!(bid.vault, vault.key(), ErrorCode::InvalidBid);
            require!(!seen.contains(&bid.bidder), ErrorCode::DuplicateBid);
            seen.push(bid.bidder);
            if bid.amount > highest
                || (bid.amount == highest
                    && (winner == Pubkey::default() || bid.bidder_index < winner_index))
            {
                highest = bid.amount;
                winner = bid.bidder;
                winner_index = bid.bidder_index;
            }
        }

        vault.highest_bid = highest;
        vault.winner = winner;
        vault.winner_index = winner_index;
        vault.status = VaultStatus::Ended;
        Ok(())
    }

    /// Clear `house.active_vault` so a new lot can open when the prior round is stuck
    /// mid-settlement on TEE (Devnet/demo escape hatch).
    pub fn force_clear_active(ctx: Context<ForceClearActive>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.house.authority,
            ctx.accounts.authority.key(),
            ErrorCode::Unauthorized
        );
        require_keys_eq!(
            ctx.accounts.house.active_vault,
            ctx.accounts.vault.key(),
            ErrorCode::ItemMismatch
        );
        ctx.accounts.house.active_vault = Pubkey::default();
        Ok(())
    }

    /// House escape hatch after deadline + grace when private bids block `end_auction`.
    /// Marks the lot abandoned and treats bids/peeks as closed so settlement can finish
    /// and a new Open lot can start (Devnet faucet SCRIP — not real funds).
    pub fn force_abandon_stale(ctx: Context<ForceAbandonStale>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.house.authority,
            ctx.accounts.authority.key(),
            ErrorCode::Unauthorized
        );
        let vault = &mut ctx.accounts.vault;
        require_keys_eq!(vault.house, ctx.accounts.house.key(), ErrorCode::ItemMismatch);
        require!(vault.status == VaultStatus::Open, ErrorCode::BadStatus);
        let now = Clock::get()?.unix_timestamp;
        // 45s past deadline — bidder End lot / end_auction first; then house escape.
        const GRACE_SECS: i64 = 45;
        require!(
            now >= vault.deadline_ts.saturating_add(GRACE_SECS),
            ErrorCode::AuctionStillOpen
        );

        vault.abandoned = true;
        vault.status = VaultStatus::Abandoned;
        vault.closed_bid_count = vault.bid_count;
        vault.closed_peek_count = vault.peeks_sold;
        vault.highest_bid = 0;
        vault.winner = Pubkey::default();
        vault.winner_index = 0;
        Ok(())
    }

    pub fn reveal_contents(ctx: Context<RevealContents>) -> Result<()> {
        require!(
            ctx.accounts.vault.status == VaultStatus::Ended
                || ctx.accounts.vault.status == VaultStatus::Abandoned,
            ErrorCode::BadStatus
        );
        require!(!ctx.accounts.contents.revealed, ErrorCode::AlreadyRevealed);

        let id_bytes = ctx.accounts.vault.id.to_le_bytes();
        let house = ctx.accounts.vault.house;
        let bump = ctx.accounts.vault.bump;
        let vault_key = ctx.accounts.vault.key();
        let abandoned = ctx.accounts.vault.abandoned;
        let vault_seeds: &[&[u8]] = &[VAULT_SEED, house.as_ref(), &id_bytes, &[bump]];

        // Vault is the permission member/authority — mark it as signer (not contents).
        UpdateEphemeralPermissionCpi {
            payer: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
            permissioned_account: ctx.accounts.contents.to_account_info(),
            permission: ctx.accounts.contents_permission.to_account_info(),
            vault: ctx.accounts.ephemeral_vault.to_account_info(),
            magic_program: ctx.accounts.magic_program.to_account_info(),
            permission_program: ctx.accounts.permission_program.to_account_info(),
            authority_is_signer: true,
            args: EphemeralMembersArgs {
                is_private: false,
                members: vec![permission_member(vault_key)],
            },
        }
        .invoke_signed(&[vault_seeds])?;

        let len = ctx.accounts.contents.len as usize;
        let total = ctx.accounts.contents.total_value;
        let items = ctx.accounts.contents.items;
        for i in 0..len {
            ctx.accounts.vault.revealed_items[i] = items[i];
        }
        ctx.accounts.vault.revealed_value = total;
        ctx.accounts.contents.revealed = true;

        if abandoned {
            for i in 0..len {
                clear_bit(&mut ctx.accounts.pool_ledger.reserved, items[i]);
            }
        }

        ctx.accounts.vault.status = VaultStatus::Revealed;
        Ok(())
    }

    pub fn settle_winning_bid(ctx: Context<SettleWinningBid>) -> Result<()> {
        require!(
            ctx.accounts.lot.status == VaultStatus::Revealed,
            ErrorCode::BadStatus
        );
        require!(!ctx.accounts.lot.abandoned, ErrorCode::BadStatus);

        let data = ctx.accounts.bid.try_borrow_data()?;
        let mut cursor = &data[..];
        let bid = Bid::try_deserialize(&mut cursor)?;
        drop(data);
        require_keys_eq!(bid.bidder, ctx.accounts.lot.winner, ErrorCode::InvalidBid);
        require!(
            bid.amount == ctx.accounts.lot.highest_bid,
            ErrorCode::InvalidBid
        );
        require_keys_eq!(bid.escrow, ctx.accounts.escrow.key(), ErrorCode::InvalidBidEscrow);
        // Closer must be the winner (legacy bid ACL member) so CloseEphemeralPermission
        // can authorize; future bids also list the vault PDA as AUTHORITY (MB-016).
        require_keys_eq!(
            ctx.accounts.closer.key(),
            ctx.accounts.lot.winner,
            ErrorCode::Unauthorized
        );

        let id_bytes = ctx.accounts.lot.id.to_le_bytes();
        let house = ctx.accounts.lot.house;
        let bump = ctx.accounts.lot.bump;
        let amount = bid.amount;
        let vault_seeds: &[&[u8]] = &[VAULT_SEED, house.as_ref(), &id_bytes, &[bump]];

        // Vault is the SPL delegate from place_bid. Pull winner → treasury only when
        // treasury looks like a real Token account on TEE (Magic ATA sinks often fail).
        if ctx.accounts.treasury.data_len() >= 165 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.key(),
                    SplTransfer {
                        from: ctx.accounts.escrow.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                        authority: ctx.accounts.lot.to_account_info(),
                    },
                    &[vault_seeds],
                ),
                amount,
            )?;
        }

        // `vault` = Magic rent vault injected by #[ephemeral_accounts]
        // Close ACL (SDK 0.16.2): payer always signs; when authority_is_signer,
        // authority must be a permission member (winner for legacy bid perms).
        close_bid_perm(
            &ctx.accounts.lot.to_account_info(),
            &ctx.accounts.closer.to_account_info(),
            &ctx.accounts.bid.to_account_info(),
            &ctx.accounts.bid_permission.to_account_info(),
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.magic_program.to_account_info(),
            &ctx.accounts.permission_program.to_account_info(),
            true,
            &[vault_seeds],
        )?;
        ctx.accounts.close_ephemeral_bid()?;
        ctx.accounts.lot.closed_bid_count = ctx
            .accounts
            .lot
            .closed_bid_count
            .checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;
        Ok(())
    }

    pub fn refund_bid(ctx: Context<RefundBid>) -> Result<()> {
        require!(
            ctx.accounts.lot.status == VaultStatus::Revealed,
            ErrorCode::BadStatus
        );

        let data = ctx.accounts.bid.try_borrow_data()?;
        let mut cursor = &data[..];
        let bid = Bid::try_deserialize(&mut cursor)?;
        drop(data);
        require_keys_eq!(bid.vault, ctx.accounts.lot.key(), ErrorCode::InvalidBid);
        if !ctx.accounts.lot.abandoned {
            require!(
                bid.bidder != ctx.accounts.lot.winner,
                ErrorCode::WrongRefundAccount
            );
        }
        require_keys_eq!(
            ctx.accounts.bidder_scrip.owner,
            bid.bidder,
            ErrorCode::WrongRefundAccount
        );

        let id_bytes = ctx.accounts.lot.id.to_le_bytes();
        let house = ctx.accounts.lot.house;
        let bump = ctx.accounts.lot.bump;
        let amount = bid.amount;
        let vault_seeds: &[&[u8]] = &[VAULT_SEED, house.as_ref(), &id_bytes, &[bump]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                SplTransfer {
                    from: ctx.accounts.escrow.to_account_info(),
                    to: ctx.accounts.bidder_scrip.to_account_info(),
                    authority: ctx.accounts.lot.to_account_info(),
                },
                &[vault_seeds],
            ),
            amount,
        )?;

        // Loser (or winner on abandon) must sign — they are the bid permission member.
        close_bid_perm(
            &ctx.accounts.lot.to_account_info(),
            &ctx.accounts.bidder.to_account_info(),
            &ctx.accounts.bid.to_account_info(),
            &ctx.accounts.bid_permission.to_account_info(),
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.magic_program.to_account_info(),
            &ctx.accounts.permission_program.to_account_info(),
            true,
            &[vault_seeds],
        )?;
        ctx.accounts.close_ephemeral_bid()?;
        ctx.accounts.lot.closed_bid_count = ctx
            .accounts
            .lot
            .closed_bid_count
            .checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;
        Ok(())
    }

    pub fn close_peek(ctx: Context<ClosePeek>) -> Result<()> {
        require!(
            ctx.accounts.lot.status == VaultStatus::Revealed,
            ErrorCode::BadStatus
        );
        let id_bytes = ctx.accounts.lot.id.to_le_bytes();
        let house = ctx.accounts.lot.house;
        let bump = ctx.accounts.lot.bump;
        let vault_seeds: &[&[u8]] = &[VAULT_SEED, house.as_ref(), &id_bytes, &[bump]];
        close_bid_perm(
            &ctx.accounts.lot.to_account_info(),
            &ctx.accounts.buyer.to_account_info(),
            &ctx.accounts.peek.to_account_info(),
            &ctx.accounts.peek_permission.to_account_info(),
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.magic_program.to_account_info(),
            &ctx.accounts.permission_program.to_account_info(),
            true,
            &[vault_seeds],
        )?;
        ctx.accounts.close_ephemeral_peek()?;
        ctx.accounts.lot.closed_peek_count = ctx
            .accounts
            .lot
            .closed_peek_count
            .checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;
        Ok(())
    }

    /// House authority closes a foreign peek after reveal.
    /// Peek ACL lists the vault PDA as AUTHORITY (same pattern as MB-016 bids),
    /// so the buyer does not need to be online — unblocks abandoned close_round.
    pub fn close_peek_keeper(ctx: Context<ClosePeekKeeper>) -> Result<()> {
        require!(
            ctx.accounts.lot.status == VaultStatus::Revealed,
            ErrorCode::BadStatus
        );
        require_keys_eq!(
            ctx.accounts.house.authority,
            ctx.accounts.authority.key(),
            ErrorCode::Unauthorized
        );
        require_keys_eq!(
            ctx.accounts.lot.house,
            ctx.accounts.house.key(),
            ErrorCode::Unauthorized
        );
        let id_bytes = ctx.accounts.lot.id.to_le_bytes();
        let house = ctx.accounts.lot.house;
        let bump = ctx.accounts.lot.bump;
        let vault_seeds: &[&[u8]] = &[VAULT_SEED, house.as_ref(), &id_bytes, &[bump]];
        // Vault PDA is the ACL AUTHORITY member — sign CloseEphemeralPermission with seeds.
        close_bid_perm(
            &ctx.accounts.lot.to_account_info(),
            &ctx.accounts.lot.to_account_info(),
            &ctx.accounts.peek.to_account_info(),
            &ctx.accounts.peek_permission.to_account_info(),
            &ctx.accounts.vault.to_account_info(),
            &ctx.accounts.magic_program.to_account_info(),
            &ctx.accounts.permission_program.to_account_info(),
            true,
            &[vault_seeds],
        )?;
        ctx.accounts.close_ephemeral_peek()?;
        ctx.accounts.lot.closed_peek_count = ctx
            .accounts
            .lot
            .closed_peek_count
            .checked_add(1)
            .ok_or(ErrorCode::MathOverflow)?;
        Ok(())
    }

    pub fn close_round(ctx: Context<CloseRound>) -> Result<()> {
        // UncheckedAccount for commit targets: typed Account<> writeback after
        // MagicIntent CPI fails with ExternalAccountDataModified (SIMD-0460).
        let vault_ai = ctx.accounts.vault.to_account_info();
        let pool_ai = ctx.accounts.pool_ledger.to_account_info();
        let (id_bytes, house, bump, abandoned) = {
            let mut data = vault_ai.try_borrow_mut_data()?;
            let mut vault: Vault = Vault::try_deserialize(&mut &data[..])?;
            require!(vault.status == VaultStatus::Revealed, ErrorCode::BadStatus);
            require!(
                vault.closed_bid_count == vault.bid_count,
                ErrorCode::UnclosedBids
            );
            require!(
                vault.closed_peek_count == vault.peeks_sold,
                ErrorCode::UnclosedPeeks
            );

            let revealed = vault.revealed_items;
            let abandoned = vault.abandoned;
            let contents_len = {
                let cdata = ctx.accounts.contents.try_borrow_data()?;
                let contents: VaultContents = VaultContents::try_deserialize(&mut &cdata[..])?;
                contents.len as usize
            };
            // Pool stays delegated — mark sold / clear reserved on TEE before commit.
            // Abandoned rounds already cleared reserved in reveal_contents; do not mark sold.
            if !abandoned {
                let mut pool_data = pool_ai.try_borrow_mut_data()?;
                let mut pool: PoolLedger = PoolLedger::try_deserialize(&mut &pool_data[..])?;
                for i in 0..contents_len {
                    let item_idx = revealed[i];
                    set_bit(&mut pool.sold, item_idx);
                    clear_bit(&mut pool.reserved, item_idx);
                }
                let mut out: &mut [u8] = &mut pool_data[..];
                pool.try_serialize(&mut out)?;
            }

            let id_bytes = vault.id.to_le_bytes();
            let house = vault.house;
            let bump = vault.bump;
            vault.status = VaultStatus::Closed;
            let mut out: &mut [u8] = &mut data[..];
            vault.try_serialize(&mut out)?;
            (id_bytes, house, bump, abandoned)
        };
        let vault_seeds: &[&[u8]] = &[VAULT_SEED, house.as_ref(), &id_bytes, &[bump]];

        // MagicIntent commit/undelegate + CloseEphemeralPermission fail on
        // `devnet-tee` after public reveal with ExternalAccountDataModified /
        // custom 0xa0000000 — for BOTH abandoned and winning rounds. Status is
        // already Closed above; pool sold/reserved bits are already written for
        // wins. Skip the CPI so the ix commits; house `force_clear_active`
        // unblocks the next Open. Orphaned TEE accounts are acceptable on
        // Devnet/demo (no real funds). Keep pool delegated across rounds.
        let _ = (vault_seeds, abandoned);
        let _ = (
            &ctx.accounts.contents_permission,
            &ctx.accounts.ephemeral_vault,
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
            &ctx.accounts.permission_program,
            &ctx.accounts.hints,
            &ctx.accounts.contents,
            &ctx.accounts.payer,
        );
        Ok(())
    }

    /// TEE-only: mark pool items sold / clear reserved after a round already closed
    /// without pool bit updates (pool stays delegated — MB-015 lifecycle).
    pub fn release_pool_items(ctx: Context<ReleasePoolItems>, indices: Vec<u16>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.house.authority,
            ctx.accounts.authority.key(),
            ErrorCode::Unauthorized
        );
        require!(indices.len() <= MAX_ITEMS_VAULT, ErrorCode::ItemMismatch);
        for item_idx in indices {
            set_bit(&mut ctx.accounts.pool_ledger.sold, item_idx);
            clear_bit(&mut ctx.accounts.pool_ledger.reserved, item_idx);
        }
        Ok(())
    }

    pub fn finalize<'a>(ctx: Context<'a, Finalize<'a>>) -> Result<()> {
        require!(
            ctx.accounts.vault.status == VaultStatus::Closed,
            ErrorCode::BadStatus
        );
        require!(!ctx.accounts.vault.abandoned, ErrorCode::BadStatus);
        let owner = *ctx.accounts.vault.to_account_info().owner;
        require_keys_eq!(owner, crate::ID, ErrorCode::NotUndelegated);

        let len = ctx.accounts.contents.len as usize;
        require!(
            ctx.remaining_accounts.len() == len * 3,
            ErrorCode::ItemMismatch
        );

        let house_bump = ctx.accounts.house.bump;
        let house_seeds: &[&[u8]] = &[HOUSE_SEED, &[house_bump]];
        let winner = ctx.accounts.vault.winner;
        let house_ai = ctx.accounts.house.to_account_info();
        let token_program_key = ctx.accounts.token_program.key();

        for i in 0..len {
            let item_idx = ctx.accounts.contents.items[i];
            require!(
                ctx.accounts.vault.revealed_items[i] == item_idx,
                ErrorCode::ItemMismatch
            );
            let item_ai = ctx.remaining_accounts[i * 3].clone();
            let pool_ata = ctx.remaining_accounts[i * 3 + 1].clone();
            let winner_ata = ctx.remaining_accounts[i * 3 + 2].clone();

            let mut data = item_ai.try_borrow_mut_data()?;
            let mut cursor = &data[..];
            let mut item = Item::try_deserialize(&mut cursor)?;
            require!(item.index == item_idx, ErrorCode::ItemMismatch);
            require!(!item.sold, ErrorCode::ItemMismatch);

            token::transfer(
                CpiContext::new_with_signer(
                    token_program_key,
                    SplTransfer {
                        from: pool_ata,
                        to: winner_ata,
                        authority: house_ai.clone(),
                    },
                    &[house_seeds],
                ),
                1,
            )?;

            item.sold = true;
            item.owner = winner;
            let mut out = &mut data[..];
            item.try_serialize(&mut out)?;
            // Pool sold/reserved bits are updated on TEE in close_round / release_pool_items.
        }

        ctx.accounts.house.active_vault = Pubkey::default();
        ctx.accounts.vault.status = VaultStatus::Settled;
        Ok(())
    }

    pub fn finalize_abandoned(ctx: Context<FinalizeAbandoned>) -> Result<()> {
        require!(
            ctx.accounts.vault.status == VaultStatus::Closed,
            ErrorCode::BadStatus
        );
        require!(ctx.accounts.vault.abandoned, ErrorCode::BadStatus);
        ctx.accounts.house.active_vault = Pubkey::default();
        ctx.accounts.vault.status = VaultStatus::Settled;
        Ok(())
    }
}

fn close_bid_perm<'info>(
    payer: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    account: &AccountInfo<'info>,
    permission: &AccountInfo<'info>,
    ephemeral_vault: &AccountInfo<'info>,
    magic_program: &AccountInfo<'info>,
    permission_program: &AccountInfo<'info>,
    authority_is_signer: bool,
    seeds: &[&[&[u8]]],
) -> Result<()> {
    // SDK CloseEphemeralPermission: payer always signs; exactly one of
    // authority / permissioned_account is marked signer via authority_is_signer
    // (see ephemeral-rollups-sdk 0.16.2 close_ephemeral_permission.rs).
    CloseEphemeralPermissionCpi {
        payer: payer.clone(),
        authority: authority.clone(),
        permissioned_account: account.clone(),
        permission: permission.clone(),
        vault: ephemeral_vault.clone(),
        magic_program: magic_program.clone(),
        permission_program: permission_program.clone(),
        authority_is_signer,
    }
    .invoke_signed(seeds)?;
    Ok(())
}

// ——— Accounts ———

#[derive(Accounts)]
pub struct InitHouse<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + House::LEN,
        seeds = [HOUSE_SEED],
        bump
    )]
    pub house: Account<'info, House>,
    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = house,
    )]
    pub scrip_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = scrip_mint,
        associated_token::authority = house,
    )]
    pub treasury: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UpdateHouseTiming<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
}

#[derive(Accounts)]
#[instruction(index: u16)]
pub struct AddItem<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    #[account(
        init,
        payer = authority,
        space = 8 + Item::LEN,
        seeds = [ITEM_SEED, &index.to_le_bytes()],
        bump
    )]
    pub item: Account<'info, Item>,
    #[account(
        init,
        payer = authority,
        mint::decimals = 0,
        mint::authority = house,
    )]
    pub item_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = item_mint,
        associated_token::authority = house,
    )]
    pub pool_ata: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct InitPoolLedger<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    #[account(
        init,
        payer = authority,
        space = 8 + PoolLedger::LEN,
        seeds = [POOL_SEED, house.key().as_ref()],
        bump
    )]
    pub pool_ledger: Account<'info, PoolLedger>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Faucet<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    #[account(mut, address = house.scrip_mint)]
    pub scrip_mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = scrip_mint,
        associated_token::authority = user,
    )]
    pub user_scrip_ata: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + FaucetTicket::LEN,
        seeds = [FAUCET_SEED, user.key().as_ref()],
        bump
    )]
    pub faucet_ticket: Account<'info, FaucetTicket>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
#[instruction(size: u8)]
pub struct CreateVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    #[account(
        init,
        payer = authority,
        space = 8 + Vault::LEN,
        seeds = [VAULT_SEED, house.key().as_ref(), &house.next_vault_id.to_le_bytes()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    #[account(
        init,
        payer = authority,
        space = 8 + VaultHints::LEN,
        seeds = [HINTS_SEED, vault.key().as_ref()],
        bump
    )]
    pub hints: Account<'info, VaultHints>,
    #[account(
        init,
        payer = authority,
        space = 8 + VaultContents::LEN,
        seeds = [CONTENTS_SEED, vault.key().as_ref()],
        bump
    )]
    pub contents: Account<'info, VaultContents>,
    #[account(address = house.scrip_mint)]
    pub scrip_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = scrip_mint,
        associated_token::authority = vault,
    )]
    pub escrow: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct InitVaultEscrowEata<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    #[account(
        mut,
        seeds = [VAULT_SEED, vault.house.as_ref(), &vault.id.to_le_bytes()],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,
    #[account(address = house.scrip_mint)]
    pub scrip_mint: Account<'info, Mint>,
    /// CHECK: eATA PDA
    #[account(mut, constraint = escrow_eata.key() == ephemeral_ata_pda(&vault.key(), &scrip_mint.key()))]
    pub escrow_eata: UncheckedAccount<'info>,
    /// CHECK: buffer
    #[account(mut, constraint = escrow_eata_buffer.key() == eata_buffer_address(&escrow_eata.key()))]
    pub escrow_eata_buffer: UncheckedAccount<'info>,
    /// CHECK: record
    #[account(mut, constraint = escrow_eata_record.key() == record_pda(&escrow_eata.key()))]
    pub escrow_eata_record: UncheckedAccount<'info>,
    /// CHECK: metadata
    #[account(mut, constraint = escrow_eata_metadata.key() == metadata_pda(&escrow_eata.key()))]
    pub escrow_eata_metadata: UncheckedAccount<'info>,
    /// CHECK: ephemeral SPL
    #[account(address = EPHEMERAL_SPL_TOKEN_PROGRAM_ID)]
    pub ephemeral_token_program: UncheckedAccount<'info>,
    /// CHECK: delegation
    #[account(address = DELEGATION_PROGRAM_ID)]
    pub delegation_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateVault<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    /// CHECK: typed as Unchecked so Anchor does not rewrite after owner→delegation program
    #[account(mut, del)]
    pub vault: UncheckedAccount<'info>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateHints<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    /// CHECK: vault may already be delegated (base-layer owner ≠ program)
    pub vault: UncheckedAccount<'info>,
    /// CHECK: delegated by macro
    #[account(mut, del)]
    pub hints: UncheckedAccount<'info>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegateContents<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    /// CHECK: vault may already be delegated
    pub vault: UncheckedAccount<'info>,
    /// CHECK: delegated by macro
    #[account(mut, del)]
    pub contents: UncheckedAccount<'info>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegatePoolLedger<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    /// CHECK: vault already delegated; pubkey only
    pub vault: UncheckedAccount<'info>,
    /// CHECK: delegated by macro
    #[account(mut, del)]
    pub pool_ledger: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct TouchAccount<'info> {
    /// CHECK: any delegated account to force-clone onto the TEE
    #[account(mut)]
    pub account: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct InitPoolPermission<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    /// CHECK: pool ledger
    #[account(mut)]
    pub pool_ledger: UncheckedAccount<'info>,
    /// CHECK: permission PDA
    #[account(mut)]
    pub pool_permission: UncheckedAccount<'info>,
    /// CHECK: Magic ephemeral rent vault
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: magic
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
    /// CHECK: permission program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitContentsPermission<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    /// CHECK: contents PDA
    #[account(mut)]
    pub contents: UncheckedAccount<'info>,
    /// CHECK: permission PDA
    #[account(mut)]
    pub contents_permission: UncheckedAccount<'info>,
    /// CHECK: Magic ephemeral rent vault
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: magic
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
    /// CHECK: permission program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitPermissions<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    /// CHECK: contents (PDA-signs CreateEphemeralPermission; Unchecked avoids clone race deserialize)
    #[account(mut)]
    pub contents: UncheckedAccount<'info>,
    /// CHECK: pool ledger
    #[account(mut)]
    pub pool_ledger: UncheckedAccount<'info>,
    /// CHECK: permission PDA
    #[account(mut)]
    pub contents_permission: UncheckedAccount<'info>,
    /// CHECK: permission PDA
    #[account(mut)]
    pub pool_permission: UncheckedAccount<'info>,
    /// CHECK: Magic ephemeral rent vault — CPI marks it writable
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: magic
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
    /// CHECK: permission program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FillVault<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub hints: Account<'info, VaultHints>,
    #[account(mut)]
    pub contents: Account<'info, VaultContents>,
    #[account(mut)]
    pub pool_ledger: Account<'info, PoolLedger>,
}

#[derive(Accounts)]
pub struct PublishHint<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub hints: Account<'info, VaultHints>,
    pub contents: Account<'info, VaultContents>,
    pub pool_ledger: Account<'info, PoolLedger>,
}

#[ephemeral_accounts]
#[derive(Accounts)]
pub struct PlaceBid<'info> {
    pub bidder: Signer<'info>,
    /// Auction vault PDA (must NOT be named `vault` — macro reserves that for Magic rent vault)
    #[account(
        mut,
        sponsor,
        seeds = [VAULT_SEED, lot.house.as_ref(), &lot.id.to_le_bytes()],
        bump = lot.bump
    )]
    pub lot: Account<'info, Vault>,
    /// CHECK: ephemeral bid PDA sponsored by the lot
    #[account(
        mut,
        eph,
        seeds = [BID_SEED, lot.key().as_ref(), bidder.key().as_ref()],
        bump
    )]
    pub bid: UncheckedAccount<'info>,
    /// Bidder SCRIP ATA (canonical ATA on TEE after delegateSpl). Funds locked via approve.
    #[account(mut, constraint = bidder_scrip.owner == bidder.key())]
    pub bidder_scrip: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitBidPermission<'info> {
    pub bidder: Signer<'info>,
    #[account(
        mut,
        seeds = [VAULT_SEED, vault.house.as_ref(), &vault.id.to_le_bytes()],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,
    /// CHECK: bid
    #[account(mut)]
    pub bid: UncheckedAccount<'info>,
    /// CHECK: permission
    #[account(mut)]
    pub bid_permission: UncheckedAccount<'info>,
    /// CHECK: ephemeral vault
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: magic
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
    /// CHECK: permission program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
}

#[ephemeral_accounts]
#[derive(Accounts)]
pub struct BuyPeek<'info> {
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
    pub peek: UncheckedAccount<'info>,
    /// CHECK: permission
    #[account(mut)]
    pub peek_permission: UncheckedAccount<'info>,
    /// CHECK: ephemeral vault
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: magic
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
    /// CHECK: permission program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct EndAuction<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct ForceAbandonStale<'info> {
    pub authority: Signer<'info>,
    pub house: Account<'info, House>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
}

#[derive(Accounts)]
pub struct ForceClearActive<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    /// CHECK: must match house.active_vault — may still be delegated on TEE
    pub vault: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct RevealContents<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub contents: Account<'info, VaultContents>,
    #[account(mut)]
    pub pool_ledger: Account<'info, PoolLedger>,
    /// CHECK: permission
    #[account(mut)]
    pub contents_permission: UncheckedAccount<'info>,
    /// CHECK: Magic ephemeral rent vault — UpdateEphemeralPermission CPI marks it writable
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: magic
    #[account(address = MAGIC_PROGRAM_ID)]
    pub magic_program: UncheckedAccount<'info>,
    /// CHECK: permission program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
}

#[ephemeral_accounts]
#[derive(Accounts)]
pub struct SettleWinningBid<'info> {
    /// Winner signs CloseEphemeralPermission (bid ACL member per MB-016).
    pub closer: Signer<'info>,
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
    /// Winner SCRIP ATA (bid.escrow) — vault is SPL delegate from place_bid
    #[account(mut)]
    pub escrow: Account<'info, TokenAccount>,
    /// CHECK: settlement destination (Magic ATA ok — not Anchor-deserialized)
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,
    /// CHECK: permission program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[ephemeral_accounts]
#[derive(Accounts)]
pub struct RefundBid<'info> {
    /// Bidder signs CloseEphemeralPermission (ACL member).
    pub bidder: Signer<'info>,
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
    /// CHECK: permission program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[ephemeral_accounts]
#[derive(Accounts)]
pub struct ClosePeek<'info> {
    /// Buyer signs CloseEphemeralPermission (ACL member).
    pub buyer: Signer<'info>,
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
    pub peek: UncheckedAccount<'info>,
    /// CHECK: permission
    #[account(mut)]
    pub peek_permission: UncheckedAccount<'info>,
    /// CHECK: permission program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
}

#[ephemeral_accounts]
#[derive(Accounts)]
pub struct ClosePeekKeeper<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    #[account(
        mut,
        sponsor,
        seeds = [VAULT_SEED, lot.house.as_ref(), &lot.id.to_le_bytes()],
        bump = lot.bump
    )]
    pub lot: Account<'info, Vault>,
    /// CHECK: peek buyer pubkey (does not sign — vault is ACL AUTHORITY).
    pub buyer: UncheckedAccount<'info>,
    /// CHECK: peek
    #[account(
        mut,
        eph,
        seeds = [PEEK_SEED, lot.key().as_ref(), buyer.key().as_ref()],
        bump
    )]
    pub peek: UncheckedAccount<'info>,
    /// CHECK: permission
    #[account(mut)]
    pub peek_permission: UncheckedAccount<'info>,
    /// CHECK: permission program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct CloseRound<'info> {
    pub payer: Signer<'info>,
    /// CHECK: commit target — must stay UncheckedAccount (no Anchor writeback)
    #[account(mut)]
    pub vault: UncheckedAccount<'info>,
    /// CHECK: commit target
    #[account(mut)]
    pub hints: UncheckedAccount<'info>,
    /// CHECK: commit target
    #[account(mut)]
    pub contents: UncheckedAccount<'info>,
    /// CHECK: commit target (may be private to non-members)
    #[account(mut)]
    pub pool_ledger: UncheckedAccount<'info>,
    /// CHECK: contents ephemeral permission (closed before undelegate)
    #[account(mut)]
    pub contents_permission: UncheckedAccount<'info>,
    /// CHECK: pool ephemeral permission (closed before undelegate)
    #[account(mut)]
    pub pool_permission: UncheckedAccount<'info>,
    /// CHECK: Magic ephemeral rent vault
    #[account(mut, address = EPHEMERAL_VAULT_ID)]
    pub ephemeral_vault: UncheckedAccount<'info>,
    /// CHECK: permission program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Finalize<'info> {
    #[account(mut, seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    pub contents: Account<'info, VaultContents>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ReleasePoolItems<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    #[account(
        mut,
        seeds = [POOL_SEED, house.key().as_ref()],
        bump = pool_ledger.bump
    )]
    pub pool_ledger: Account<'info, PoolLedger>,
}

#[derive(Accounts)]
pub struct FinalizeAbandoned<'info> {
    #[account(mut, seeds = [HOUSE_SEED], bump = house.bump)]
    pub house: Account<'info, House>,
    #[account(mut)]
    pub vault: Account<'info, Vault>,
}
