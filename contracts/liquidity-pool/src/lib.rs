#![no_std]

extern crate alloc;

use alloc::string::String;
use casper_types::{account::AccountHash, U512};

/// LP Token for liquidity providers
/// Users deposit CSPR/stablecoins and get LP tokens
/// LP tokens represent share of the pool + accrued fees

pub struct LiquidityPool {
    pub total_liquidity: U512,        // Total CSPR in pool
    pub total_lp_tokens: U512,        // Total LP tokens minted
    pub total_fees_earned: U512,      // Lifetime fees
    pub trader_pnl: i128,             // Net trader profit/loss
    pub utilization_rate: u16,        // % of pool in use (basis points)
}

pub struct LiquidityProvider {
    pub address: AccountHash,
    pub lp_tokens: U512,              // rwLP-CSPR tokens owned
    pub deposited_amount: U512,       // Initial deposit
    pub deposit_timestamp: u64,
    pub fees_earned: U512,            // Fees earned so far
    pub withdrawal_requests: Vec<WithdrawalRequest>,
}

pub struct WithdrawalRequest {
    pub amount: U512,
    pub request_time: u64,
    pub unlock_time: u64,             // 24h delay for withdrawals
}

/// LP Token functions
impl LiquidityPool {
    /// Calculate LP token price
    /// price = (total_liquidity + fees - trader_pnl) / total_lp_tokens
    pub fn get_lp_token_price(&self) -> U512 {
        if self.total_lp_tokens == U512::zero() {
            return U512::from(1_000_000_000); // 1 CSPR in motes
        }

        let pool_value = if self.trader_pnl >= 0 {
            // Traders won, pool lost
            self.total_liquidity + self.total_fees_earned - U512::from(self.trader_pnl.abs() as u128)
        } else {
            // Traders lost, pool won
            self.total_liquidity + self.total_fees_earned + U512::from(self.trader_pnl.abs() as u128)
        };

        pool_value / self.total_lp_tokens
    }

    /// Calculate APY for LPs
    pub fn get_lp_apy(&self) -> u64 {
        // APY = (fees_earned / total_liquidity) * 365
        // Simplified calculation
        let daily_fees = self.total_fees_earned; // Would be last 24h fees
        let apy = (daily_fees * U512::from(365) * U512::from(100)) / self.total_liquidity;
        apy.as_u64()
    }
}

/// Storage keys
pub mod storage_keys {
    pub const LP_POOL: &str = "lp_pool";
    pub const LP_TOKEN_NAME: &str = "rwLP-CSPR";
    pub const LIQUIDITY_PROVIDERS_PREFIX: &str = "lp_";
    pub const MIN_LIQUIDITY: &str = "min_liquidity";
    pub const WITHDRAWAL_DELAY: &str = "withdrawal_delay";
}

/// Error codes
pub mod errors {
    pub const INSUFFICIENT_LIQUIDITY: u16 = 501;
    pub const WITHDRAWAL_LOCKED: u16 = 502;
    pub const BELOW_MIN_DEPOSIT: u16 = 503;
    pub const POOL_UTILIZATION_TOO_HIGH: u16 = 504;
}
