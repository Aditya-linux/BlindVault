use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke,
};
use anchor_spl::token::Mint;
use ephemeral_rollups_sdk::access_control::structs::{
    Member, AUTHORITY_FLAG, TX_BALANCES_FLAG, TX_LOGS_FLAG, TX_MESSAGE_FLAG,
};
use crate::constants::{DELEGATION_PROGRAM_ID, EPHEMERAL_SPL_TOKEN_PROGRAM_ID};

const INIT_EPHEMERAL_ATA_DISCRIMINATOR: u8 = 0;
const DELEGATE_EPHEMERAL_ATA_DISCRIMINATOR: u8 = 4;

pub fn permission_member(pubkey: Pubkey) -> Member {
    Member {
        flags: AUTHORITY_FLAG | TX_LOGS_FLAG | TX_MESSAGE_FLAG | TX_BALANCES_FLAG,
        pubkey,
    }
}

pub fn init_ephemeral_ata<'info>(
    program: &UncheckedAccount<'info>,
    ephemeral_ata: &UncheckedAccount<'info>,
    owner: AccountInfo<'info>,
    mint: &Account<'info, Mint>,
    payer: &Signer<'info>,
    system_program: &Program<'info, System>,
) -> Result<()> {
    let instruction = Instruction {
        program_id: EPHEMERAL_SPL_TOKEN_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(ephemeral_ata.key(), false),
            AccountMeta::new(payer.key(), true),
            AccountMeta::new_readonly(owner.key(), false),
            AccountMeta::new_readonly(mint.key(), false),
            AccountMeta::new_readonly(system_program.key(), false),
        ],
        data: vec![INIT_EPHEMERAL_ATA_DISCRIMINATOR],
    };
    invoke(
        &instruction,
        &[
            ephemeral_ata.to_account_info(),
            payer.to_account_info(),
            owner,
            mint.to_account_info(),
            system_program.to_account_info(),
            program.to_account_info(),
        ],
    )?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
pub fn delegate_ephemeral_ata<'info>(
    program: &UncheckedAccount<'info>,
    payer: &Signer<'info>,
    ephemeral_ata: &UncheckedAccount<'info>,
    buffer: &UncheckedAccount<'info>,
    record: &UncheckedAccount<'info>,
    metadata: &UncheckedAccount<'info>,
    delegation_program: &UncheckedAccount<'info>,
    system_program: &Program<'info, System>,
    validator: Option<Pubkey>,
) -> Result<()> {
    let mut data = vec![DELEGATE_EPHEMERAL_ATA_DISCRIMINATOR];
    if let Some(validator) = validator {
        data.extend_from_slice(validator.as_ref());
    }

    let instruction = Instruction {
        program_id: EPHEMERAL_SPL_TOKEN_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(payer.key(), true),
            AccountMeta::new(ephemeral_ata.key(), false),
            AccountMeta::new_readonly(EPHEMERAL_SPL_TOKEN_PROGRAM_ID, false),
            AccountMeta::new(buffer.key(), false),
            AccountMeta::new(record.key(), false),
            AccountMeta::new(metadata.key(), false),
            AccountMeta::new_readonly(delegation_program.key(), false),
            AccountMeta::new_readonly(system_program.key(), false),
        ],
        data,
    };
    invoke(
        &instruction,
        &[
            payer.to_account_info(),
            ephemeral_ata.to_account_info(),
            program.to_account_info(),
            buffer.to_account_info(),
            record.to_account_info(),
            metadata.to_account_info(),
            delegation_program.to_account_info(),
            system_program.to_account_info(),
        ],
    )?;
    Ok(())
}

pub fn ephemeral_ata_pda(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[owner.as_ref(), mint.as_ref()],
        &EPHEMERAL_SPL_TOKEN_PROGRAM_ID,
    )
    .0
}

pub fn eata_buffer_address(delegated_account: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[b"buffer", delegated_account.as_ref()],
        &EPHEMERAL_SPL_TOKEN_PROGRAM_ID,
    )
    .0
}

pub fn record_pda(delegated_account: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[b"delegation", delegated_account.as_ref()],
        &DELEGATION_PROGRAM_ID,
    )
    .0
}

pub fn metadata_pda(delegated_account: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[b"delegation-metadata", delegated_account.as_ref()],
        &DELEGATION_PROGRAM_ID,
    )
    .0
}
