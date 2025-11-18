#![no_std]
#![no_main]

extern crate alloc;

use alloc::string::ToString;
use alloc::vec::Vec;
use casper_contract::{
    contract_api::{runtime, storage},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{runtime_args, Key, RuntimeArgs, U256, U512, CLValue};

use market_factory::{errors, storage_keys, DailyMarket, ContinuousPerp, FundingRateData, MarketConfig, RWAssetType, SettlementMode};

/// Initialize the market factory contract
#[no_mangle]
pub extern "C" fn init() {
    let admin: Key = runtime::get_named_arg("admin");
    let vault_contract: Key = runtime::get_named_arg("vault_contract");
    let oracle_contract: Key = runtime::get_named_arg("oracle_contract");
    let settlement_contract: Key = runtime::get_named_arg("settlement_contract");

    // Store configuration
    storage::new_dictionary(storage_keys::MARKET_PREFIX).unwrap_or_revert();
    runtime::put_key(storage_keys::MARKETS_COUNT, storage::new_uref(0u64).into());
    runtime::put_key(storage_keys::ADMIN, storage::new_uref(admin).into());
    runtime::put_key(storage_keys::VAULT_CONTRACT, storage::new_uref(vault_contract).into());
    runtime::put_key(storage_keys::ORACLE_CONTRACT, storage::new_uref(oracle_contract).into());
    runtime::put_key(storage_keys::SETTLEMENT_CONTRACT, storage::new_uref(settlement_contract).into());

    // Store default config
    let config = MarketConfig::default();
    runtime::put_key(storage_keys::CONFIG, storage::new_uref(config).into());
}

/// Create a new daily market for an RWA asset
/// Called automatically each day at 00:00 UTC or manually by admin
#[no_mangle]
pub extern "C" fn create_daily_market() {
    let asset_type_u8: u8 = runtime::get_named_arg("asset_type");
    let opening_price: U256 = runtime::get_named_arg("opening_price");
    let market_date: u64 = runtime::get_named_arg("market_date");

    // Verify caller is admin or settlement contract
    verify_authorized_caller();

    // Convert asset type
    let asset_type = match asset_type_u8 {
        0 => RWAssetType::Gold,
        1 => RWAssetType::Silver,
        2 => RWAssetType::SP500,
        3 => RWAssetType::Nasdaq,
        4 => RWAssetType::Oil,
        5 => RWAssetType::USHousing,
        6 => RWAssetType::Platinum,
        _ => runtime::revert(errors::INVALID_ASSET_TYPE),
    };

    // Get config
    let config_uref = runtime::get_key(storage_keys::CONFIG)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let config: MarketConfig = storage::read(config_uref).unwrap_or_revert().unwrap_or_revert();

    // Create new market
    let market = DailyMarket {
        asset_type,
        opening_price,
        settlement_price: U256::zero(),
        market_date,
        settlement_time: market_date + 86400, // +24 hours
        total_long_collateral: U512::zero(),
        total_short_collateral: U512::zero(),
        max_leverage: config.max_leverage,
        is_settled: false,
        is_active: true,
    };

    // Store market
    let market_id = get_and_increment_market_count();
    let market_key = format!("{}{}_{}", storage_keys::MARKET_PREFIX, asset_type_u8, market_date);
    runtime::put_key(&market_key, storage::new_uref(market).into());

    // Return market ID
    runtime::ret(CLValue::from_t(market_id).unwrap_or_revert());
}

/// Settle a market with the final price from oracle
#[no_mangle]
pub extern "C" fn settle_market() {
    let market_key: alloc::string::String = runtime::get_named_arg("market_key");
    let settlement_price: U256 = runtime::get_named_arg("settlement_price");

    // Verify caller is settlement contract
    verify_settlement_contract();

    // Get market
    let market_uref = runtime::get_key(&market_key)
        .unwrap_or_revert_with(errors::MARKET_NOT_FOUND)
        .into_uref()
        .unwrap_or_revert();

    let mut market: DailyMarket = storage::read(market_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    // Verify market is active and not settled
    if !market.is_active {
        runtime::revert(errors::MARKET_NOT_ACTIVE);
    }
    if market.is_settled {
        runtime::revert(errors::MARKET_ALREADY_SETTLED);
    }

    // Update market
    market.settlement_price = settlement_price;
    market.is_settled = true;
    market.is_active = false;

    storage::write(market_uref, market);
}

/// Get market information
#[no_mangle]
pub extern "C" fn get_market() {
    let market_key: alloc::string::String = runtime::get_named_arg("market_key");

    let market_uref = runtime::get_key(&market_key)
        .unwrap_or_revert_with(errors::MARKET_NOT_FOUND)
        .into_uref()
        .unwrap_or_revert();

    let market: DailyMarket = storage::read(market_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    runtime::ret(CLValue::from_t(market).unwrap_or_revert());
}

/// Update market configuration (admin only)
#[no_mangle]
pub extern "C" fn update_config() {
    verify_admin();

    let max_leverage: Option<u8> = runtime::get_named_arg("max_leverage");
    let maker_fee_bps: Option<u16> = runtime::get_named_arg("maker_fee_bps");
    let taker_fee_bps: Option<u16> = runtime::get_named_arg("taker_fee_bps");

    let config_uref = runtime::get_key(storage_keys::CONFIG)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let mut config: MarketConfig = storage::read(config_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    if let Some(leverage) = max_leverage {
        if leverage > 50 || leverage < 1 {
            runtime::revert(errors::INVALID_LEVERAGE);
        }
        config.max_leverage = leverage;
    }
    if let Some(fee) = maker_fee_bps {
        config.maker_fee_bps = fee;
    }
    if let Some(fee) = taker_fee_bps {
        config.taker_fee_bps = fee;
    }

    storage::write(config_uref, config);
}

/// Create a new continuous perpetual market for frequently-updating RWAs
/// Used for assets like Gold, Silver, Oil, S&P500, Nasdaq that update frequently
#[no_mangle]
pub extern "C" fn create_continuous_perp() {
    let asset_type_u8: u8 = runtime::get_named_arg("asset_type");
    let opening_price: U256 = runtime::get_named_arg("opening_price");

    // Verify caller is admin
    verify_admin();

    // Convert asset type
    let asset_type = match asset_type_u8 {
        0 => RWAssetType::Gold,
        1 => RWAssetType::Silver,
        2 => RWAssetType::SP500,
        3 => RWAssetType::Nasdaq,
        4 => RWAssetType::Oil,
        5 => RWAssetType::USHousing,
        6 => RWAssetType::Platinum,
        _ => runtime::revert(errors::INVALID_ASSET_TYPE),
    };

    // Check if perp already exists for this asset
    let perp_key = format!("{}{}", storage_keys::PERP_PREFIX, asset_type_u8);
    if runtime::get_key(&perp_key).is_some() {
        runtime::revert(errors::PERP_ALREADY_EXISTS);
    }

    // Validate price
    if opening_price == U256::zero() {
        runtime::revert(errors::INVALID_PRICE);
    }

    // Get config
    let config_uref = runtime::get_key(storage_keys::CONFIG)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let config: MarketConfig = storage::read(config_uref).unwrap_or_revert().unwrap_or_revert();

    // Get current timestamp
    let now = runtime::get_blocktime();

    // Create new perpetual market
    let perp = ContinuousPerp {
        asset_type,
        created_at: now,
        current_price: opening_price,
        index_price: opening_price,
        mark_price: opening_price,
        funding_rate: 0,  // Start with 0 funding rate
        last_funding_time: now,
        funding_interval: 28800, // 8 hours in seconds
        total_long_oi: U512::zero(),
        total_short_oi: U512::zero(),
        total_long_collateral: U512::zero(),
        total_short_collateral: U512::zero(),
        max_leverage: config.max_leverage,
        is_active: true,
    };

    // Store perp
    runtime::put_key(&perp_key, storage::new_uref(perp).into());

    // Initialize funding rate history dictionary
    let funding_dict_name = format!("{}{}", storage_keys::FUNDING_PREFIX, asset_type_u8);
    storage::new_dictionary(&funding_dict_name).unwrap_or_revert();
}

/// Update perpetual market price (called by oracle every 30 seconds)
#[no_mangle]
pub extern "C" fn update_perp_price() {
    let asset_type_u8: u8 = runtime::get_named_arg("asset_type");
    let new_price: U256 = runtime::get_named_arg("price");

    // Verify caller is oracle contract
    verify_oracle_contract();

    // Validate price
    if new_price == U256::zero() {
        runtime::revert(errors::INVALID_PRICE);
    }

    // Get perp
    let perp_key = format!("{}{}", storage_keys::PERP_PREFIX, asset_type_u8);
    let perp_uref = runtime::get_key(&perp_key)
        .unwrap_or_revert_with(errors::PERP_NOT_FOUND)
        .into_uref()
        .unwrap_or_revert();

    let mut perp: ContinuousPerp = storage::read(perp_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    // Verify perp is active
    if !perp.is_active {
        runtime::revert(errors::MARKET_NOT_ACTIVE);
    }

    // Update prices
    perp.current_price = new_price;
    perp.index_price = new_price;

    // Mark price is influenced by platform trading but starts with index price
    // In practice, this would be calculated based on order book/trades
    perp.mark_price = new_price;

    storage::write(perp_uref, perp);
}

/// Calculate funding rate based on price divergence
/// Formula: funding_rate = (mark_price - index_price) / index_price * funding_coefficient
/// Positive rate = longs pay shorts, Negative rate = shorts pay longs
#[no_mangle]
pub extern "C" fn calculate_funding_rate() {
    let asset_type_u8: u8 = runtime::get_named_arg("asset_type");

    // Verify caller is authorized (admin or settlement contract)
    verify_authorized_caller();

    // Get perp
    let perp_key = format!("{}{}", storage_keys::PERP_PREFIX, asset_type_u8);
    let perp_uref = runtime::get_key(&perp_key)
        .unwrap_or_revert_with(errors::PERP_NOT_FOUND)
        .into_uref()
        .unwrap_or_revert();

    let perp: ContinuousPerp = storage::read(perp_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    // Calculate premium index: (mark_price - index_price) / index_price * 10000 (basis points)
    let premium_index = if perp.index_price > U256::zero() {
        let price_diff = if perp.mark_price > perp.index_price {
            (perp.mark_price - perp.index_price).as_u128() as i128
        } else {
            -((perp.index_price - perp.mark_price).as_u128() as i128)
        };
        let index_price_u128 = perp.index_price.as_u128() as i128;
        (price_diff * 10000) / index_price_u128
    } else {
        0
    };

    // Interest rate component (fixed at 0.01% per 8 hours = 1 basis point)
    let interest_rate: i64 = 1;

    // Funding rate = (premium_index + interest_rate) / funding_periods_per_day
    // We have 3 funding periods per day (every 8 hours)
    let funding_rate: i64 = ((premium_index as i64 + interest_rate) / 3).max(-1000).min(1000); // Cap at ±10%

    // Return funding rate
    runtime::ret(CLValue::from_t(funding_rate).unwrap_or_revert());
}

/// Execute funding payments (called every 8 hours)
/// Transfers funding between longs and shorts based on funding rate
#[no_mangle]
pub extern "C" fn pay_funding() {
    let asset_type_u8: u8 = runtime::get_named_arg("asset_type");

    // Verify caller is authorized (admin or settlement contract)
    verify_authorized_caller();

    // Get perp
    let perp_key = format!("{}{}", storage_keys::PERP_PREFIX, asset_type_u8);
    let perp_uref = runtime::get_key(&perp_key)
        .unwrap_or_revert_with(errors::PERP_NOT_FOUND)
        .into_uref()
        .unwrap_or_revert();

    let mut perp: ContinuousPerp = storage::read(perp_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    // Verify perp is active
    if !perp.is_active {
        runtime::revert(errors::MARKET_NOT_ACTIVE);
    }

    // Check if funding interval has passed
    let now = runtime::get_blocktime();
    if now < perp.last_funding_time + perp.funding_interval {
        runtime::revert(errors::FUNDING_TOO_EARLY);
    }

    // Calculate funding rate
    let premium_index = if perp.index_price > U256::zero() {
        let price_diff = if perp.mark_price > perp.index_price {
            (perp.mark_price - perp.index_price).as_u128() as i128
        } else {
            -((perp.index_price - perp.mark_price).as_u128() as i128)
        };
        let index_price_u128 = perp.index_price.as_u128() as i128;
        (price_diff * 10000) / index_price_u128
    } else {
        0
    };

    let interest_rate: i64 = 1;
    let funding_rate: i64 = ((premium_index as i64 + interest_rate) / 3).max(-1000).min(1000);

    // Update perp with new funding rate and timestamp
    perp.funding_rate = funding_rate;
    perp.last_funding_time = now;
    storage::write(perp_uref, perp.clone());

    // Store funding rate data for historical tracking
    let funding_data = FundingRateData {
        timestamp: now,
        funding_rate,
        premium_index: premium_index as i64,
        interest_rate,
        long_oi: perp.total_long_oi,
        short_oi: perp.total_short_oi,
    };

    let funding_dict_name = format!("{}{}", storage_keys::FUNDING_PREFIX, asset_type_u8);
    let funding_key = now.to_string();
    storage::dictionary_put(
        runtime::get_key(&funding_dict_name).unwrap_or_revert().into_uref().unwrap_or_revert(),
        &funding_key,
        funding_data,
    );

    // NOTE: Actual funding payments to positions are handled by position-manager contract
    // This function just calculates and stores the funding rate
    // Position-manager will call get_funding_rate() and apply payments to all open positions
}

/// Get perpetual market information
#[no_mangle]
pub extern "C" fn get_perp() {
    let asset_type_u8: u8 = runtime::get_named_arg("asset_type");

    let perp_key = format!("{}{}", storage_keys::PERP_PREFIX, asset_type_u8);
    let perp_uref = runtime::get_key(&perp_key)
        .unwrap_or_revert_with(errors::PERP_NOT_FOUND)
        .into_uref()
        .unwrap_or_revert();

    let perp: ContinuousPerp = storage::read(perp_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    runtime::ret(CLValue::from_t(perp).unwrap_or_revert());
}

/// Get current funding rate for a perpetual market
#[no_mangle]
pub extern "C" fn get_funding_rate() {
    let asset_type_u8: u8 = runtime::get_named_arg("asset_type");

    let perp_key = format!("{}{}", storage_keys::PERP_PREFIX, asset_type_u8);
    let perp_uref = runtime::get_key(&perp_key)
        .unwrap_or_revert_with(errors::PERP_NOT_FOUND)
        .into_uref()
        .unwrap_or_revert();

    let perp: ContinuousPerp = storage::read(perp_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    runtime::ret(CLValue::from_t(perp.funding_rate).unwrap_or_revert());
}

/// Get funding rate history for a perpetual market
#[no_mangle]
pub extern "C" fn get_funding_history() {
    let asset_type_u8: u8 = runtime::get_named_arg("asset_type");
    let timestamp: u64 = runtime::get_named_arg("timestamp");

    let funding_dict_name = format!("{}{}", storage_keys::FUNDING_PREFIX, asset_type_u8);
    let funding_uref = runtime::get_key(&funding_dict_name)
        .unwrap_or_revert_with(errors::PERP_NOT_FOUND)
        .into_uref()
        .unwrap_or_revert();

    let funding_key = timestamp.to_string();
    let funding_data: Option<FundingRateData> = storage::dictionary_get(funding_uref, &funding_key)
        .unwrap_or_revert();

    runtime::ret(CLValue::from_t(funding_data).unwrap_or_revert());
}

/// Get settlement mode for a market (used by settlement contract)
/// Returns: 0 = Daily, 1 = Continuous, 2 = Triggered
#[no_mangle]
pub extern "C" fn get_market_settlement_mode() {
    let market_key: alloc::string::String = runtime::get_named_arg("market_key");

    // Check if this is a continuous perp (format: "perp_{asset_type}")
    if market_key.starts_with("perp_") {
        // This is a continuous perp
        runtime::ret(CLValue::from_t(SettlementMode::Continuous as u8).unwrap_or_revert());
    } else {
        // This is a daily market (format: "market_{asset_type}_{date}")
        runtime::ret(CLValue::from_t(SettlementMode::Daily as u8).unwrap_or_revert());
    }
}

// Helper functions

fn get_and_increment_market_count() -> u64 {
    let count_uref = runtime::get_key(storage_keys::MARKETS_COUNT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let current_count: u64 = storage::read(count_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    storage::write(count_uref, current_count + 1);
    current_count
}

fn verify_admin() {
    let admin_uref = runtime::get_key(storage_keys::ADMIN)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let admin: Key = storage::read(admin_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    if runtime::get_caller() != admin.into_account().unwrap_or_revert() {
        runtime::revert(errors::UNAUTHORIZED);
    }
}

fn verify_settlement_contract() {
    let settlement_uref = runtime::get_key(storage_keys::SETTLEMENT_CONTRACT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let settlement_contract: Key = storage::read(settlement_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    if runtime::get_caller() != settlement_contract.into_account().unwrap_or_revert() {
        runtime::revert(errors::UNAUTHORIZED);
    }
}

fn verify_authorized_caller() {
    let admin_uref = runtime::get_key(storage_keys::ADMIN)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let admin: Key = storage::read(admin_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    let settlement_uref = runtime::get_key(storage_keys::SETTLEMENT_CONTRACT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let settlement_contract: Key = storage::read(settlement_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    let caller = runtime::get_caller();
    if caller != admin.into_account().unwrap_or_revert()
       && caller != settlement_contract.into_account().unwrap_or_revert() {
        runtime::revert(errors::UNAUTHORIZED);
    }
}

fn verify_oracle_contract() {
    let oracle_uref = runtime::get_key(storage_keys::ORACLE_CONTRACT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let oracle_contract: Key = storage::read(oracle_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    if runtime::get_caller() != oracle_contract.into_account().unwrap_or_revert() {
        runtime::revert(errors::UNAUTHORIZED);
    }
}

#[no_mangle]
pub extern "C" fn call() {
    // Contract installation entry point
    let admin: Key = runtime::get_named_arg("admin");
    let vault_contract: Key = runtime::get_named_arg("vault_contract");
    let oracle_contract: Key = runtime::get_named_arg("oracle_contract");
    let settlement_contract: Key = runtime::get_named_arg("settlement_contract");

    let entry_points = casper_contract::contract_api::storage::create_contract_package_at_hash();

    runtime::put_key("market_factory", entry_points.into());
}
