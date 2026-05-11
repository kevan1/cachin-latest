use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("32sURiEkLHtsvwXRQkEvZrQjEDg2peZEM8iZWmeKhYgy");

pub const FEE_BPS_CAP: u16 = 100;
pub const BPS_DENOMINATOR: u64 = 10_000;

#[program]
pub mod workspace {
    use super::*;

    // fee_bps: u16, Fee in basis points, 100 = 1%
    // fee_treasury: Pubkey, Treasury address receiving fees, 9PJ8I...3555
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        fee_bps: u16,
        fee_treasury: Pubkey,
    ) -> Result<()> {
        require!(fee_bps <= FEE_BPS_CAP, ErrorCode::FeeTooHigh);
        require!(fee_treasury != Pubkey::default(), ErrorCode::InvalidParameter);

        let config = &mut ctx.accounts.config;
        config.bump = ctx.bumps.config;
        config.authority = ctx.accounts.authority.key();
        config.is_active = true;
        config.is_paused = false;
        config.fee_bps = fee_bps;
        config.fee_treasury = fee_treasury;
        config.version = 1;
        Ok(())
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        fee_bps: u16,
        fee_treasury: Pubkey,
    ) -> Result<()> {
        require!(fee_bps <= FEE_BPS_CAP, ErrorCode::FeeTooHigh);
        require!(fee_treasury != Pubkey::default(), ErrorCode::InvalidParameter);

        let config = &mut ctx.accounts.config;
        config.fee_bps = fee_bps;
        config.fee_treasury = fee_treasury;
        Ok(())
    }

    pub fn pay_merchant(ctx: Context<PayMerchant>, amount_units: u64) -> Result<()> {
        require!(amount_units > 0, ErrorCode::InvalidAmount);

        let config = &ctx.accounts.config;
        require!(config.is_active, ErrorCode::ConfigInactive);
        require!(!config.is_paused, ErrorCode::ConfigPaused);

        let fee_units = amount_units
            .checked_mul(config.fee_bps as u64)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(BPS_DENOMINATOR)
            .ok_or(ErrorCode::MathOverflow)?;

        let merchant_units = amount_units
            .checked_sub(fee_units)
            .ok_or(ErrorCode::MathOverflow)?;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.payer_token.to_account_info(),
                    to: ctx.accounts.merchant_token.to_account_info(),
                    authority: ctx.accounts.payer.to_account_info(),
                },
            ),
            merchant_units,
        )?;

        if fee_units > 0 {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.payer_token.to_account_info(),
                        to: ctx.accounts.fee_treasury_token.to_account_info(),
                        authority: ctx.accounts.payer.to_account_info(),
                    },
                ),
                fee_units,
            )?;
        }

        emit!(MerchantPayment {
            payer: ctx.accounts.payer.key(),
            merchant: ctx.accounts.merchant.key(),
            mint: ctx.accounts.mint.key(),
            gross_amount: amount_units,
            merchant_amount: merchant_units,
            fee_amount: fee_units,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        seeds = [b"config", authority.key().as_ref()],
        bump,
        payer = authority,
        space = 8 + Config::LEN,
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"config", authority.key().as_ref()],
        bump = config.bump,
        has_one = authority @ ErrorCode::Unauthorized,
    )]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct PayMerchant<'info> {
    #[account(
        seeds = [b"config", config.authority.as_ref()],
        bump = config.bump,
        constraint = config.is_active @ ErrorCode::ConfigInactive,
        constraint = !config.is_paused @ ErrorCode::ConfigPaused,
    )]
    pub config: Account<'info, Config>,

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        constraint = payer_token.mint == mint.key() @ ErrorCode::InvalidMint,
        constraint = payer_token.owner == payer.key() @ ErrorCode::InvalidOwner,
    )]
    pub payer_token: Account<'info, TokenAccount>,

    /// CHECK: Merchant wallet, validated via merchant_token.owner constraint
    pub merchant: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = merchant_token.mint == mint.key() @ ErrorCode::InvalidMint,
        constraint = merchant_token.owner == merchant.key() @ ErrorCode::InvalidOwner,
    )]
    pub merchant_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = fee_treasury_token.key() == config.fee_treasury @ ErrorCode::InvalidTreasury,
        constraint = fee_treasury_token.mint == mint.key() @ ErrorCode::InvalidMint,
    )]
    pub fee_treasury_token: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Config {
    pub bump: u8,
    pub authority: Pubkey,
    pub is_active: bool,
    pub is_paused: bool,
    pub fee_bps: u16,
    pub fee_treasury: Pubkey,
    pub version: u8,
}

impl Config {
    pub const LEN: usize = 1 + 32 + 1 + 1 + 2 + 32 + 1;
}

#[event]
pub struct MerchantPayment {
    pub payer: Pubkey,
    pub merchant: Pubkey,
    pub mint: Pubkey,
    pub gross_amount: u64,
    pub merchant_amount: u64,
    pub fee_amount: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Math overflow occurred")]
    MathOverflow,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Config is inactive")]
    ConfigInactive,
    #[msg("Config is paused")]
    ConfigPaused,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid parameter")]
    InvalidParameter,
    #[msg("Invalid mint")]
    InvalidMint,
    #[msg("Invalid owner")]
    InvalidOwner,
    #[msg("Invalid treasury account")]
    InvalidTreasury,
    #[msg("Fee exceeds maximum cap of 100 bps")]
    FeeTooHigh,
}
