#![no_std]

extern crate alloc;

use alloc::string::String;
use casper_types::{account::AccountHash, U256, U512};

/// Position direction (Long or Short)
#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum PositionSide {
    Long = 0,  // Betting price goes up
    Short = 1, // Betting price goes down
}

/// Settlement mode for positions
#[repr(u8)]
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum SettlementMode {
    Daily = 0,       // Daily settlement (closes at 00:00 UTC)
    Continuous = 1,  // Perpetual (continuous settlement with funding)
}

/// User position in a daily or continuous market
pub struct Position {
    pub user: AccountHash,
    pub market_key: String,
    pub side: PositionSide,
    pub settlement_mode: SettlementMode,
    pub collateral: U512,        // Amount of CSPR/stablecoin deposited
    pub leverage: u8,             // 1-10x
    pub effective_size: U512,     // collateral * leverage
    pub entry_price: U256,        // Price when position opened
    pub timestamp: u64,           // When position was created
    pub is_closed: bool,
    // Continuous perp specific fields
    pub accumulated_funding: i128,   // Net funding payments (positive = received, negative = paid)
    pub last_funding_time: u64,      // Last time funding was applied
    pub funding_payments_count: u32, // Number of funding payments applied
}

impl Position {
    /// Calculate PnL for this position given a settlement price
    /// Returns (pnl_amount, is_profit)
    pub fn calculate_pnl(&self, settlement_price: U256) -> (U512, bool) {
        let entry_price_u512 = U512::from(self.entry_price.as_u128());
        let settlement_price_u512 = U512::from(settlement_price.as_u128());

        match self.side {
            PositionSide::Long => {
                if settlement_price > self.entry_price {
                    // Profit: (settlement - entry) / entry * effective_size
                    let price_diff = settlement_price_u512 - entry_price_u512;
                    let pnl = (price_diff * self.effective_size) / entry_price_u512;
                    (pnl, true)
                } else {
                    // Loss: (entry - settlement) / entry * effective_size
                    let price_diff = entry_price_u512 - settlement_price_u512;
                    let pnl = (price_diff * self.effective_size) / entry_price_u512;
                    (pnl, false)
                }
            }
            PositionSide::Short => {
                if settlement_price < self.entry_price {
                    // Profit: (entry - settlement) / entry * effective_size
                    let price_diff = entry_price_u512 - settlement_price_u512;
                    let pnl = (price_diff * self.effective_size) / entry_price_u512;
                    (pnl, true)
                } else {
                    // Loss: (settlement - entry) / entry * effective_size
                    let price_diff = settlement_price_u512 - entry_price_u512;
                    let pnl = (price_diff * self.effective_size) / entry_price_u512;
                    (pnl, false)
                }
            }
        }
    }

    /// Calculate PnL including accumulated funding (for continuous perps)
    /// Returns (pnl_amount, is_profit) with funding included
    pub fn calculate_pnl_with_funding(&self, current_price: U256) -> (U512, bool) {
        let (base_pnl, base_is_profit) = self.calculate_pnl(current_price);

        if self.settlement_mode as u8 == SettlementMode::Daily as u8 {
            // Daily markets don't have funding
            return (base_pnl, base_is_profit);
        }

        // For continuous perps, add funding payments
        let base_pnl_i128 = base_pnl.as_u128() as i128;
        let signed_pnl = if base_is_profit {
            base_pnl_i128
        } else {
            -base_pnl_i128
        };

        // Add accumulated funding (positive = received, negative = paid)
        let total_pnl = signed_pnl + self.accumulated_funding;

        if total_pnl >= 0 {
            (U512::from(total_pnl as u128), true)
        } else {
            (U512::from((-total_pnl) as u128), false)
        }
    }

    /// Apply funding payment to this position
    /// Funding rate is in basis points (1 bp = 0.01%)
    /// Positive rate = longs pay shorts, Negative rate = shorts pay longs
    pub fn apply_funding(&mut self, funding_rate: i64, current_time: u64) {
        if self.settlement_mode as u8 != SettlementMode::Continuous as u8 {
            return; // Only apply to continuous perps
        }

        if self.is_closed {
            return; // Don't apply to closed positions
        }

        // Calculate funding payment
        // Payment = position_size * funding_rate / 10000
        let position_size = self.effective_size.as_u128() as i128;
        let funding_payment = (position_size * funding_rate as i128) / 10000;

        // Longs pay when funding_rate is positive (mark > index)
        // Shorts pay when funding_rate is negative (mark < index)
        let net_payment = match self.side {
            PositionSide::Long => -funding_payment,  // Longs pay positive funding
            PositionSide::Short => funding_payment,  // Shorts receive positive funding
        };

        // Update accumulated funding
        self.accumulated_funding += net_payment;
        self.last_funding_time = current_time;
        self.funding_payments_count += 1;
    }

    /// Check if position would be liquidated at given price
    /// Liquidation occurs if loss >= collateral (100% loss for leverage)
    pub fn is_liquidated(&self, current_price: U256) -> bool {
        let (pnl, is_profit) = self.calculate_pnl_with_funding(current_price);

        if is_profit {
            return false;
        }

        // If loss >= collateral, position is liquidated
        pnl >= self.collateral
    }

    /// Calculate liquidation price
    /// For long: entry_price * (1 - 1/leverage)
    /// For short: entry_price * (1 + 1/leverage)
    pub fn get_liquidation_price(&self) -> U256 {
        let entry_price_u128 = self.entry_price.as_u128();
        let leverage_u128 = self.leverage as u128;

        match self.side {
            PositionSide::Long => {
                // Liquidation when price drops by (1/leverage * 100)%
                // liquidation_price = entry * (1 - 1/leverage)
                let multiplier = (leverage_u128 - 1) * 1000 / leverage_u128;
                let liq_price = (entry_price_u128 * multiplier) / 1000;
                U256::from(liq_price)
            }
            PositionSide::Short => {
                // Liquidation when price rises by (1/leverage * 100)%
                // liquidation_price = entry * (1 + 1/leverage)
                let multiplier = (leverage_u128 + 1) * 1000 / leverage_u128;
                let liq_price = (entry_price_u128 * multiplier) / 1000;
                U256::from(liq_price)
            }
        }
    }
}

/// Storage keys
pub mod storage_keys {
    pub const POSITIONS_COUNT: &str = "positions_count";
    pub const POSITION_PREFIX: &str = "position_";
    pub const USER_POSITIONS_PREFIX: &str = "user_positions_";
    pub const MARKET_POSITIONS_PREFIX: &str = "market_positions_";
    pub const PERP_POSITIONS_PREFIX: &str = "perp_positions_";  // Continuous perp positions by asset
    pub const VAULT_CONTRACT: &str = "vault_contract";
    pub const MARKET_FACTORY: &str = "market_factory";
    pub const ADMIN: &str = "admin";
}

/// Error codes
pub mod errors {
    pub const INVALID_LEVERAGE: u16 = 101;
    pub const INVALID_COLLATERAL: u16 = 102;
    pub const MARKET_NOT_ACTIVE: u16 = 103;
    pub const POSITION_NOT_FOUND: u16 = 104;
    pub const POSITION_ALREADY_CLOSED: u16 = 105;
    pub const INSUFFICIENT_COLLATERAL: u16 = 106;
    pub const UNAUTHORIZED: u16 = 107;
    pub const POSITION_LIQUIDATED: u16 = 108;
    pub const POSITION_SIZE_TOO_LARGE: u16 = 109;
}
