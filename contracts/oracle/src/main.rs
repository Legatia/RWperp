#![no_std]
#![no_main]

extern crate alloc;

use alloc::{format, vec::Vec};
use casper_contract::{
    contract_api::{runtime, storage},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{account::AccountHash, Key, U256, CLValue};

use oracle::{
    errors, storage_keys, AggregatedPrice, OracleConfig, OracleValidator, PriceSubmission,
};

/// Initialize the oracle contract
#[no_mangle]
pub extern "C" fn init() {
    let admin: Key = runtime::get_named_arg("admin");
    let settlement_contract: Key = runtime::get_named_arg("settlement_contract");

    runtime::put_key(storage_keys::ADMIN, storage::new_uref(admin).into());
    runtime::put_key(
        storage_keys::SETTLEMENT_CONTRACT,
        storage::new_uref(settlement_contract).into(),
    );
    runtime::put_key(storage_keys::VALIDATORS_COUNT, storage::new_uref(0u64).into());

    let config = OracleConfig::default();
    runtime::put_key(storage_keys::CONFIG, storage::new_uref(config).into());
}

/// Register as an oracle validator (requires staking)
#[no_mangle]
pub extern "C" fn register_validator() {
    let stake_amount: u64 = runtime::get_named_arg("stake_amount");
    let validator_address = runtime::get_caller();

    // Get config
    let config = get_config();

    if stake_amount < config.min_stake {
        runtime::revert(errors::INSUFFICIENT_STAKE);
    }

    // TODO: Lock staked CSPR in contract

    // Create validator
    let validator = OracleValidator {
        address: validator_address,
        stake: stake_amount,
        is_active: true,
        submissions_count: 0,
        accurate_submissions: 0,
    };

    // Store validator
    let validator_key = format!("{}{:?}", storage_keys::VALIDATORS_PREFIX, validator_address);
    runtime::put_key(&validator_key, storage::new_uref(validator).into());

    // Increment validator count
    increment_validator_count();

    runtime::ret(CLValue::from_t(true).unwrap_or_revert());
}

/// Submit a price for an RWA asset (validators only)
#[no_mangle]
pub extern "C" fn submit_price() {
    let asset_type: u8 = runtime::get_named_arg("asset_type");
    let price: U256 = runtime::get_named_arg("price");
    let data_sources: u8 = runtime::get_named_arg("data_sources");
    let target_timestamp: u64 = runtime::get_named_arg("target_timestamp");

    let validator_address = runtime::get_caller();

    // Verify validator is registered and active
    let validator_key = format!("{}{:?}", storage_keys::VALIDATORS_PREFIX, validator_address);
    let validator_uref = runtime::get_key(&validator_key)
        .unwrap_or_revert_with(errors::VALIDATOR_NOT_FOUND)
        .into_uref()
        .unwrap_or_revert();

    let mut validator: OracleValidator = storage::read(validator_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    if !validator.is_active {
        runtime::revert(errors::UNAUTHORIZED);
    }

    // Get config
    let config = get_config();

    // Check submission window
    let current_time = runtime::get_blocktime();
    if current_time > target_timestamp + config.submission_window {
        runtime::revert(errors::SUBMISSION_WINDOW_CLOSED);
    }

    // Create submission
    let submission = PriceSubmission {
        validator: validator_address,
        asset_type,
        price,
        timestamp: current_time,
        data_sources,
    };

    // Store submission
    let submission_key = format!(
        "{}{}_{:?}_{}",
        storage_keys::SUBMISSIONS_PREFIX,
        asset_type,
        validator_address,
        target_timestamp
    );

    // Check if already submitted
    if runtime::get_key(&submission_key).is_some() {
        runtime::revert(errors::ALREADY_SUBMITTED);
    }

    runtime::put_key(&submission_key, storage::new_uref(submission).into());

    // Update validator stats
    validator.submissions_count += 1;
    storage::write(validator_uref, validator);

    runtime::ret(CLValue::from_t(true).unwrap_or_revert());
}

/// Aggregate submitted prices and finalize (called by settlement contract or admin)
#[no_mangle]
pub extern "C" fn aggregate_prices() {
    verify_authorized();

    let asset_type: u8 = runtime::get_named_arg("asset_type");
    let target_timestamp: u64 = runtime::get_named_arg("target_timestamp");

    // Get config
    let config = get_config();

    // Collect all submissions for this asset and timestamp
    // TODO: In production, use dictionaries to efficiently retrieve submissions
    // For now, we'll assume submissions are provided as parameter for simplicity

    let prices: Vec<U256> = runtime::get_named_arg("prices");

    if prices.len() < config.min_validators as usize {
        runtime::revert(errors::INSUFFICIENT_VALIDATORS);
    }

    // Calculate median price
    let median_price = calculate_median(&prices);

    // Calculate deviation
    let deviation = calculate_deviation(&prices, median_price);

    // Check deviation is within acceptable range
    let max_deviation = (median_price * U256::from(config.max_price_deviation_bps)) / U256::from(10000);

    if deviation > max_deviation {
        runtime::revert(errors::PRICE_DEVIATION_TOO_HIGH);
    }

    // Create aggregated price
    let aggregated = AggregatedPrice {
        asset_type,
        price: median_price,
        timestamp: runtime::get_blocktime(),
        submissions_count: prices.len() as u8,
        deviation,
        is_finalized: true,
    };

    // Store aggregated price
    let aggregated_key = format!(
        "{}{}_{}",
        storage_keys::AGGREGATED_PRICE_PREFIX,
        asset_type,
        target_timestamp
    );
    runtime::put_key(&aggregated_key, storage::new_uref(aggregated).into());

    runtime::ret(CLValue::from_t(median_price).unwrap_or_revert());
}

/// Get the latest finalized price for an asset
#[no_mangle]
pub extern "C" fn get_price() {
    let asset_type: u8 = runtime::get_named_arg("asset_type");
    let target_timestamp: u64 = runtime::get_named_arg("target_timestamp");

    let aggregated_key = format!(
        "{}{}_{}",
        storage_keys::AGGREGATED_PRICE_PREFIX,
        asset_type,
        target_timestamp
    );

    let aggregated_uref = runtime::get_key(&aggregated_key)
        .unwrap_or_revert_with(errors::PRICE_NOT_FINALIZED)
        .into_uref()
        .unwrap_or_revert();

    let aggregated: AggregatedPrice = storage::read(aggregated_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    if !aggregated.is_finalized {
        runtime::revert(errors::PRICE_NOT_FINALIZED);
    }

    runtime::ret(CLValue::from_t(aggregated).unwrap_or_revert());
}

/// Slash a validator for inaccurate submission (admin only)
#[no_mangle]
pub extern "C" fn slash_validator() {
    verify_admin();

    let validator_address: AccountHash = runtime::get_named_arg("validator_address");

    let validator_key = format!("{}{:?}", storage_keys::VALIDATORS_PREFIX, validator_address);
    let validator_uref = runtime::get_key(&validator_key)
        .unwrap_or_revert_with(errors::VALIDATOR_NOT_FOUND)
        .into_uref()
        .unwrap_or_revert();

    let mut validator: OracleValidator = storage::read(validator_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    let config = get_config();

    // Deduct slash amount from stake
    if validator.stake > config.slash_amount {
        validator.stake -= config.slash_amount;
    } else {
        validator.stake = 0;
        validator.is_active = false;
    }

    storage::write(validator_uref, validator);

    // TODO: Transfer slashed amount to insurance fund
}

/// Update oracle configuration (admin only)
#[no_mangle]
pub extern "C" fn update_config() {
    verify_admin();

    let min_validators: Option<u8> = runtime::get_named_arg("min_validators");
    let max_price_deviation_bps: Option<u16> = runtime::get_named_arg("max_price_deviation_bps");

    let config_uref = runtime::get_key(storage_keys::CONFIG)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let mut config: OracleConfig = storage::read(config_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    if let Some(min_val) = min_validators {
        config.min_validators = min_val;
    }
    if let Some(max_dev) = max_price_deviation_bps {
        config.max_price_deviation_bps = max_dev;
    }

    storage::write(config_uref, config);
}

// Helper functions

fn get_config() -> OracleConfig {
    let config_uref = runtime::get_key(storage_keys::CONFIG)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    storage::read(config_uref)
        .unwrap_or_revert()
        .unwrap_or_revert()
}

fn increment_validator_count() {
    let count_uref = runtime::get_key(storage_keys::VALIDATORS_COUNT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let current: u64 = storage::read(count_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    storage::write(count_uref, current + 1);
}

fn calculate_median(prices: &Vec<U256>) -> U256 {
    let mut sorted_prices = prices.clone();
    sorted_prices.sort();

    let len = sorted_prices.len();
    if len % 2 == 0 {
        // Even number: average of middle two
        (sorted_prices[len / 2 - 1] + sorted_prices[len / 2]) / U256::from(2)
    } else {
        // Odd number: middle value
        sorted_prices[len / 2]
    }
}

fn calculate_deviation(prices: &Vec<U256>, median: U256) -> U256 {
    if prices.is_empty() {
        return U256::zero();
    }

    let mut max_diff = U256::zero();

    for price in prices {
        let diff = if *price > median {
            *price - median
        } else {
            median - *price
        };

        if diff > max_diff {
            max_diff = diff;
        }
    }

    max_diff
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

fn verify_authorized() {
    let caller = runtime::get_caller();

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
    let settlement: Key = storage::read(settlement_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    if caller != admin.into_account().unwrap_or_revert()
        && caller != settlement.into_account().unwrap_or_revert()
    {
        runtime::revert(errors::UNAUTHORIZED);
    }
}

#[no_mangle]
pub extern "C" fn call() {
    // Contract installation
    let admin: Key = runtime::get_named_arg("admin");
    let settlement_contract: Key = runtime::get_named_arg("settlement_contract");

    let entry_points = casper_contract::contract_api::storage::create_contract_package_at_hash();

    runtime::put_key("oracle", entry_points.into());
}
