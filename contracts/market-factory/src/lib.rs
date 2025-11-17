#![no_std]

extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;
use casper_contract::contract_api::{runtime, storage};
use casper_types::{Key, U256, U512};

/// Represents a Real World Asset that can be traded
#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum RWAssetType {
    Gold = 0,
    Silver = 1,
    SP500 = 2,
    Nasdaq = 3,
    Oil = 4,
    USHousing = 5,
    Platinum = 6,
}

/// Represents a single daily market for an RWA
pub struct DailyMarket {
    pub asset_type: RWAssetType,
    pub opening_price: U256,      // Price at market open (from previous day close)
    pub settlement_price: U256,    // Price at settlement (00:00 UTC next day)
    pub market_date: u64,          // Unix timestamp of market start
    pub settlement_time: u64,      // Unix timestamp when settled (market_date + 86400)
    pub total_long_collateral: U512,
    pub total_short_collateral: U512,
    pub max_leverage: u8,          // Default: 10x
    pub is_settled: bool,
    pub is_active: bool,
}

/// Market configuration parameters
pub struct MarketConfig {
    pub max_leverage: u8,
    pub maker_fee_bps: u16,        // Basis points (100 = 1%)
    pub taker_fee_bps: u16,
    pub insurance_fee_bps: u16,    // % of fees to insurance fund
    pub max_position_size_bps: u16, // Max position as % of total pool
}

impl Default for MarketConfig {
    fn default() -> Self {
        Self {
            max_leverage: 10,
            maker_fee_bps: 10,      // 0.1%
            taker_fee_bps: 20,      // 0.2%
            insurance_fee_bps: 2000, // 20% of fees
            max_position_size_bps: 500, // 5% of pool
        }
    }
}

/// Constants for storage keys
pub mod storage_keys {
    pub const MARKETS_COUNT: &str = "markets_count";
    pub const MARKET_PREFIX: &str = "market_";
    pub const CONFIG: &str = "config";
    pub const VAULT_CONTRACT: &str = "vault_contract";
    pub const ORACLE_CONTRACT: &str = "oracle_contract";
    pub const SETTLEMENT_CONTRACT: &str = "settlement_contract";
    pub const ADMIN: &str = "admin";
}

/// Error codes
pub mod errors {
    pub const INVALID_ASSET_TYPE: u16 = 1;
    pub const MARKET_ALREADY_EXISTS: u16 = 2;
    pub const MARKET_NOT_FOUND: u16 = 3;
    pub const MARKET_NOT_ACTIVE: u16 = 4;
    pub const MARKET_ALREADY_SETTLED: u16 = 5;
    pub const UNAUTHORIZED: u16 = 6;
    pub const INVALID_LEVERAGE: u16 = 7;
}
