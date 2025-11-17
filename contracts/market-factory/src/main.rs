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

use market_factory::{errors, storage_keys, DailyMarket, MarketConfig, RWAssetType};

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
