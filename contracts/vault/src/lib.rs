#![no_std]

extern crate alloc;

use casper_types::{account::AccountHash, U512};

/// User account information in the vault
pub struct UserAccount {
    pub user: AccountHash,
    pub cspr_balance: U512,
    pub stablecoin_balance: U512,
    pub locked_collateral: U512,  // Currently locked in open positions
    pub total_deposited: U512,     // Lifetime deposits
    pub total_withdrawn: U512,     // Lifetime withdrawals
    pub realized_pnl: i128,        // Lifetime profit/loss
}

/// Collateral type
#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum CollateralType {
    CSPR = 0,
    Stablecoin = 1,
}

/// Insurance fund state
pub struct InsuranceFund {
    pub cspr_balance: U512,
    pub stablecoin_balance: U512,
    pub total_liquidations_covered: u64,
    pub total_coverage_amount: U512,
}

impl Default for InsuranceFund {
    fn default() -> Self {
        Self {
            cspr_balance: U512::zero(),
            stablecoin_balance: U512::zero(),
            total_liquidations_covered: 0,
            total_coverage_amount: U512::zero(),
        }
    }
}

/// Storage keys
pub mod storage_keys {
    pub const USER_ACCOUNT_PREFIX: &str = "user_account_";
    pub const TOTAL_CSPR_DEPOSITED: &str = "total_cspr_deposited";
    pub const TOTAL_STABLECOIN_DEPOSITED: &str = "total_stablecoin_deposited";
    pub const INSURANCE_FUND: &str = "insurance_fund";
    pub const POSITION_MANAGER: &str = "position_manager";
    pub const SETTLEMENT_CONTRACT: &str = "settlement_contract";
    pub const ADMIN: &str = "admin";
    pub const STABLECOIN_CONTRACT: &str = "stablecoin_contract";
    pub const PAUSED: &str = "paused";
}

/// Error codes
pub mod errors {
    pub const INSUFFICIENT_BALANCE: u16 = 201;
    pub const INSUFFICIENT_LOCKED_COLLATERAL: u16 = 202;
    pub const INVALID_AMOUNT: u16 = 203;
    pub const UNAUTHORIZED: u16 = 204;
    pub const VAULT_PAUSED: u16 = 205;
    pub const TRANSFER_FAILED: u16 = 206;
}
