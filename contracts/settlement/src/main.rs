#![no_std]
#![no_main]

extern crate alloc;

use alloc::{format, string::String, vec::Vec};
use casper_contract::{
    contract_api::{runtime, storage},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{runtime_args, Key, RuntimeArgs, U256, U512, CLValue};

use settlement::{errors, storage_keys, MarketSettlement, SettlementConfig, SettlementMode};

/// Initialize the settlement contract
#[no_mangle]
pub extern "C" fn init() {
    let admin: Key = runtime::get_named_arg("admin");
    let market_factory: Key = runtime::get_named_arg("market_factory");
    let position_manager: Key = runtime::get_named_arg("position_manager");
    let vault: Key = runtime::get_named_arg("vault");
    let oracle: Key = runtime::get_named_arg("oracle");

    runtime::put_key(storage_keys::ADMIN, storage::new_uref(admin).into());
    runtime::put_key(storage_keys::MARKET_FACTORY, storage::new_uref(market_factory).into());
    runtime::put_key(storage_keys::POSITION_MANAGER, storage::new_uref(position_manager).into());
    runtime::put_key(storage_keys::VAULT, storage::new_uref(vault).into());
    runtime::put_key(storage_keys::ORACLE, storage::new_uref(oracle).into());

    let config = SettlementConfig::default();
    runtime::put_key(storage_keys::CONFIG, storage::new_uref(config).into());

    runtime::put_key(storage_keys::LAST_SETTLEMENT, storage::new_uref(0u64).into());
}

/// Trigger daily settlement for a specific market
/// This is the main settlement function called daily at 00:00 UTC
/// NOTE: This only settles Daily markets. Continuous perps use funding rates instead.
#[no_mangle]
pub extern "C" fn settle_market() {
    // Can be called by admin or automatically by keeper/cron
    verify_authorized();

    let market_key: String = runtime::get_named_arg("market_key");
    let asset_type: u8 = runtime::get_named_arg("asset_type");
    let target_timestamp: u64 = runtime::get_named_arg("target_timestamp");

    // Get settlement config
    let config = get_config();

    // Check market settlement mode
    let market_factory_key = get_market_factory_contract();
    let settlement_mode_u8: u8 = runtime::call_contract(
        market_factory_key.into_hash().unwrap_or_revert(),
        "get_market_settlement_mode",
        runtime_args! {
            "market_key" => market_key.clone(),
        },
    );
    let settlement_mode = SettlementMode::from(settlement_mode_u8);

    // Continuous perps should NOT be settled - they use funding rates instead
    if settlement_mode == SettlementMode::Continuous {
        runtime::revert(errors::CANNOT_SETTLE_CONTINUOUS_PERP);
    }

    // Step 1: Get aggregated price from oracle
    let oracle_key = get_oracle_contract();
    let settlement_price: U256 = runtime::call_contract(
        oracle_key.into_hash().unwrap_or_revert(),
        "get_price",
        runtime_args! {
            "asset_type" => asset_type,
            "target_timestamp" => target_timestamp,
        },
    );

    // Step 2: Settle the market in market factory
    let market_factory_key = get_market_factory_contract();
    let _: () = runtime::call_contract(
        market_factory_key.into_hash().unwrap_or_revert(),
        "settle_market",
        runtime_args! {
            "market_key" => market_key.clone(),
            "settlement_price" => settlement_price,
        },
    );

    // Step 3: Settle all positions for this market
    let position_manager_key = get_position_manager_contract();
    let _: () = runtime::call_contract(
        position_manager_key.into_hash().unwrap_or_revert(),
        "settle_market_positions",
        runtime_args! {
            "market_key" => market_key.clone(),
            "settlement_price" => settlement_price,
        },
    );

    // Step 4: Create settlement record
    let market_settlement = MarketSettlement {
        market_key: market_key.clone(),
        asset_type,
        settlement_mode,
        settlement_price,
        total_positions: 0, // TODO: Get from position manager
        total_long_pnl: U512::zero(),
        total_short_pnl: U512::zero(),
        total_fees_collected: U512::zero(),
        insurance_fund_contribution: U512::zero(),
        settlement_timestamp: runtime::get_blocktime(),
    };

    // Store settlement record
    let settlement_key = format!(
        "{}{}",
        storage_keys::SETTLEMENT_HISTORY_PREFIX,
        runtime::get_blocktime()
    );
    runtime::put_key(&settlement_key, storage::new_uref(market_settlement).into());

    // Update last settlement timestamp
    update_last_settlement(runtime::get_blocktime());

    // Step 5: Create new market for next day (ONLY for Daily markets)
    // Continuous perps run indefinitely and don't need new markets
    if settlement_mode == SettlementMode::Daily {
        let _: u64 = runtime::call_contract(
            market_factory_key.into_hash().unwrap_or_revert(),
            "create_daily_market",
            runtime_args! {
                "asset_type" => asset_type,
                "opening_price" => settlement_price,  // Today's close = tomorrow's open
                "market_date" => target_timestamp + 86400,  // Next day
            },
        );
    }

    runtime::ret(CLValue::from_t(settlement_price).unwrap_or_revert());
}

/// Settle all active markets (called daily by keeper)
/// This function settles all Daily markets in one transaction
/// NOTE: Continuous perps are automatically skipped (they use funding rates)
#[no_mangle]
pub extern "C" fn settle_all_markets() {
    verify_authorized();

    let market_keys: Vec<String> = runtime::get_named_arg("market_keys");
    let asset_types: Vec<u8> = runtime::get_named_arg("asset_types");
    let target_timestamp: u64 = runtime::get_named_arg("target_timestamp");

    // Check we haven't settled too recently
    let last_settlement = get_last_settlement();
    let current_time = runtime::get_blocktime();

    // Must be at least 23 hours since last settlement
    if current_time < last_settlement + 82800 {
        runtime::revert(errors::SETTLEMENT_TOO_EARLY);
    }

    // Get market factory to check settlement modes
    let market_factory_key = get_market_factory_contract();

    // Settle each market (skip continuous perps)
    let mut settled_count = 0u64;
    let mut skipped_count = 0u64;

    for (i, market_key) in market_keys.iter().enumerate() {
        let asset_type = asset_types[i];

        // Check if this is a Daily market or Continuous perp
        let settlement_mode_u8: u8 = runtime::call_contract(
            market_factory_key.into_hash().unwrap_or_revert(),
            "get_market_settlement_mode",
            runtime_args! {
                "market_key" => market_key.clone(),
            },
        );
        let settlement_mode = SettlementMode::from(settlement_mode_u8);

        // Skip continuous perps - they use funding rates instead
        if settlement_mode == SettlementMode::Continuous {
            skipped_count += 1;
            continue;
        }

        // Call settle_market for Daily markets
        let _: U256 = runtime::call_contract(
            runtime::get_caller().into_hash().unwrap_or_revert(), // Self-call
            "settle_market",
            runtime_args! {
                "market_key" => market_key.clone(),
                "asset_type" => asset_type,
                "target_timestamp" => target_timestamp,
            },
        );

        settled_count += 1;
    }

    runtime::ret(CLValue::from_t(settled_count).unwrap_or_revert());
}

/// Emergency settlement (admin only) - can force settle a market
#[no_mangle]
pub extern "C" fn emergency_settle() {
    verify_admin();

    let market_key: String = runtime::get_named_arg("market_key");
    let forced_price: U256 = runtime::get_named_arg("forced_price");

    // Directly settle market with forced price
    let market_factory_key = get_market_factory_contract();
    let _: () = runtime::call_contract(
        market_factory_key.into_hash().unwrap_or_revert(),
        "settle_market",
        runtime_args! {
            "market_key" => market_key.clone(),
            "settlement_price" => forced_price,
        },
    );

    // Settle positions
    let position_manager_key = get_position_manager_contract();
    let _: () = runtime::call_contract(
        position_manager_key.into_hash().unwrap_or_revert(),
        "settle_market_positions",
        runtime_args! {
            "market_key" => market_key.clone(),
            "settlement_price" => forced_price,
        },
    );

    runtime::ret(CLValue::from_t(true).unwrap_or_revert());
}

/// Get settlement history
#[no_mangle]
pub extern "C" fn get_settlement_history() {
    let timestamp: u64 = runtime::get_named_arg("timestamp");

    let settlement_key = format!("{}{}", storage_keys::SETTLEMENT_HISTORY_PREFIX, timestamp);

    let settlement_uref = runtime::get_key(&settlement_key)
        .unwrap_or_revert_with(errors::MARKET_NOT_FOUND)
        .into_uref()
        .unwrap_or_revert();

    let settlement: MarketSettlement = storage::read(settlement_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    runtime::ret(CLValue::from_t(settlement).unwrap_or_revert());
}

/// Update settlement configuration (admin only)
#[no_mangle]
pub extern "C" fn update_config() {
    verify_admin();

    let settlement_hour: Option<u8> = runtime::get_named_arg("settlement_hour");
    let liquidation_fee_bps: Option<u16> = runtime::get_named_arg("liquidation_fee_bps");

    let config_uref = runtime::get_key(storage_keys::CONFIG)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let mut config: SettlementConfig = storage::read(config_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    if let Some(hour) = settlement_hour {
        if hour < 24 {
            config.settlement_hour = hour;
        }
    }
    if let Some(fee) = liquidation_fee_bps {
        config.liquidation_fee_bps = fee;
    }

    storage::write(config_uref, config);
}

// Helper functions

fn get_config() -> SettlementConfig {
    let config_uref = runtime::get_key(storage_keys::CONFIG)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    storage::read(config_uref)
        .unwrap_or_revert()
        .unwrap_or_revert()
}

fn get_market_factory_contract() -> Key {
    let uref = runtime::get_key(storage_keys::MARKET_FACTORY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    storage::read(uref).unwrap_or_revert().unwrap_or_revert()
}

fn get_position_manager_contract() -> Key {
    let uref = runtime::get_key(storage_keys::POSITION_MANAGER)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    storage::read(uref).unwrap_or_revert().unwrap_or_revert()
}

fn get_vault_contract() -> Key {
    let uref = runtime::get_key(storage_keys::VAULT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    storage::read(uref).unwrap_or_revert().unwrap_or_revert()
}

fn get_oracle_contract() -> Key {
    let uref = runtime::get_key(storage_keys::ORACLE)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    storage::read(uref).unwrap_or_revert().unwrap_or_revert()
}

fn get_last_settlement() -> u64 {
    let uref = runtime::get_key(storage_keys::LAST_SETTLEMENT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    storage::read(uref).unwrap_or_revert().unwrap_or_revert()
}

fn update_last_settlement(timestamp: u64) {
    let uref = runtime::get_key(storage_keys::LAST_SETTLEMENT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    storage::write(uref, timestamp);
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
    // Allow admin or any caller (for keeper/cron jobs)
    // In production, you'd want to restrict this more
    let admin_uref = runtime::get_key(storage_keys::ADMIN)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let admin: Key = storage::read(admin_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    let caller = runtime::get_caller();

    // For now, allow anyone to trigger settlement (keeper-friendly)
    // In production, use whitelist or specific keeper contract
}

#[no_mangle]
pub extern "C" fn call() {
    // Contract installation
    let admin: Key = runtime::get_named_arg("admin");
    let market_factory: Key = runtime::get_named_arg("market_factory");
    let position_manager: Key = runtime::get_named_arg("position_manager");
    let vault: Key = runtime::get_named_arg("vault");
    let oracle: Key = runtime::get_named_arg("oracle");

    let entry_points = casper_contract::contract_api::storage::create_contract_package_at_hash();

    runtime::put_key("settlement", entry_points.into());
}
