#![no_std]

extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;
use casper_types::{account::AccountHash, U256};

/// Oracle validator who can submit prices
pub struct OracleValidator {
    pub address: AccountHash,
    pub stake: u64,              // CSPR staked
    pub is_active: bool,
    pub submissions_count: u64,
    pub accurate_submissions: u64,
}

/// Price submission from an oracle validator
pub struct PriceSubmission {
    pub validator: AccountHash,
    pub asset_type: u8,
    pub price: U256,
    pub timestamp: u64,
    pub data_sources: u8,        // Bitmap of data sources used
}

/// Aggregated price data for an asset
pub struct AggregatedPrice {
    pub asset_type: u8,
    pub price: U256,              // Median of all submissions
    pub timestamp: u64,           // When aggregated
    pub submissions_count: u8,    // How many validators submitted
    pub deviation: U256,          // Standard deviation
    pub is_finalized: bool,
}

/// Real-time price feed for continuous perps (updated every 30 seconds)
pub struct RealtimePrice {
    pub asset_type: u8,
    pub price: U256,              // Latest price
    pub timestamp: u64,           // Last update time
    pub update_interval: u64,     // 30 seconds
    pub validator: AccountHash,   // Validator who submitted last update
    pub sequence_number: u64,     // Incremental sequence for ordering
}

/// Oracle configuration
pub struct OracleConfig {
    pub min_validators: u8,       // Minimum validators needed (e.g., 3 out of 5)
    pub max_price_deviation_bps: u16,  // Max allowed deviation in basis points (e.g., 500 = 5%)
    pub submission_window: u64,    // Time window for submissions (e.g., 300 seconds)
    pub min_stake: u64,           // Minimum CSPR to stake as validator
    pub slash_amount: u64,        // Amount slashed for bad submission
    pub realtime_update_interval: u64,  // Interval for real-time price updates (30 seconds)
    pub realtime_max_deviation_bps: u16,  // Max deviation for real-time updates (e.g., 200 = 2%)
}

impl Default for OracleConfig {
    fn default() -> Self {
        Self {
            min_validators: 3,
            max_price_deviation_bps: 500,  // 5% max deviation
            submission_window: 300,         // 5 minutes
            min_stake: 10_000,             // 10k CSPR
            slash_amount: 1_000,           // 1k CSPR slash
            realtime_update_interval: 30,  // 30 seconds for continuous perps
            realtime_max_deviation_bps: 200,  // 2% max deviation for real-time
        }
    }
}

/// Storage keys
pub mod storage_keys {
    pub const VALIDATORS_PREFIX: &str = "validator_";
    pub const VALIDATORS_COUNT: &str = "validators_count";
    pub const SUBMISSIONS_PREFIX: &str = "submission_";
    pub const AGGREGATED_PRICE_PREFIX: &str = "aggregated_price_";
    pub const REALTIME_PRICE_PREFIX: &str = "realtime_price_";
    pub const PRICE_SEQUENCE_PREFIX: &str = "price_seq_";
    pub const CONFIG: &str = "oracle_config";
    pub const ADMIN: &str = "admin";
    pub const SETTLEMENT_CONTRACT: &str = "settlement_contract";
    pub const MARKET_FACTORY_CONTRACT: &str = "market_factory_contract";
}

/// Error codes
pub mod errors {
    pub const UNAUTHORIZED: u16 = 301;
    pub const VALIDATOR_NOT_FOUND: u16 = 302;
    pub const INSUFFICIENT_STAKE: u16 = 303;
    pub const SUBMISSION_WINDOW_CLOSED: u16 = 304;
    pub const PRICE_DEVIATION_TOO_HIGH: u16 = 305;
    pub const INSUFFICIENT_VALIDATORS: u16 = 306;
    pub const ALREADY_SUBMITTED: u16 = 307;
    pub const PRICE_NOT_FINALIZED: u16 = 308;
    pub const UPDATE_TOO_FREQUENT: u16 = 309;
    pub const REALTIME_PRICE_NOT_FOUND: u16 = 310;
    pub const INVALID_PRICE: u16 = 311;
}
