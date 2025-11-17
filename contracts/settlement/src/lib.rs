#![no_std]

extern crate alloc;

use alloc::vec::Vec;
use casper_types::{U256, U512};

/// Settlement result for a single position
pub struct PositionSettlement {
    pub position_id: u64,
    pub user_address: alloc::string::String,
    pub pnl: U512,
    pub is_profit: bool,
    pub fees_paid: U512,
    pub final_balance: U512,
}

/// Daily settlement summary for a market
pub struct MarketSettlement {
    pub market_key: alloc::string::String,
    pub asset_type: u8,
    pub settlement_price: U256,
    pub total_positions: u64,
    pub total_long_pnl: U512,
    pub total_short_pnl: U512,
    pub total_fees_collected: U512,
    pub insurance_fund_contribution: U512,
    pub settlement_timestamp: u64,
}

/// Settlement configuration
pub struct SettlementConfig {
    pub settlement_hour: u8,        // Hour of day for settlement (0-23), default 0 for 00:00 UTC
    pub max_slippage_bps: u16,      // Max slippage allowed in basis points
    pub liquidation_fee_bps: u16,   // Fee for liquidations (e.g., 250 = 2.5%)
    pub insurance_fund_ratio_bps: u16, // % of fees to insurance fund
}

impl Default for SettlementConfig {
    fn default() -> Self {
        Self {
            settlement_hour: 0,
            max_slippage_bps: 100,       // 1% max slippage
            liquidation_fee_bps: 250,     // 2.5% liquidation fee
            insurance_fund_ratio_bps: 2000, // 20% to insurance fund
        }
    }
}

/// Storage keys
pub mod storage_keys {
    pub const CONFIG: &str = "settlement_config";
    pub const MARKET_FACTORY: &str = "market_factory";
    pub const POSITION_MANAGER: &str = "position_manager";
    pub const VAULT: &str = "vault";
    pub const ORACLE: &str = "oracle";
    pub const ADMIN: &str = "admin";
    pub const LAST_SETTLEMENT: &str = "last_settlement";
    pub const SETTLEMENT_HISTORY_PREFIX: &str = "settlement_";
}

/// Error codes
pub mod errors {
    pub const UNAUTHORIZED: u16 = 401;
    pub const SETTLEMENT_TOO_EARLY: u16 = 402;
    pub const ORACLE_PRICE_NOT_READY: u16 = 403;
    pub const MARKET_NOT_FOUND: u16 = 404;
    pub const SETTLEMENT_FAILED: u16 = 405;
}
