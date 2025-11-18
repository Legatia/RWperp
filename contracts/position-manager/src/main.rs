#![no_std]
#![no_main]

extern crate alloc;

use alloc::format;
use alloc::string::ToString;
use alloc::vec::Vec;
use casper_contract::{
    contract_api::{runtime, storage},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{account::AccountHash, runtime_args, Key, RuntimeArgs, U256, U512, CLValue};

use position_manager::{errors, storage_keys, Position, PositionSide, SettlementMode};

/// Initialize the position manager contract
#[no_mangle]
pub extern "C" fn init() {
    let admin: Key = runtime::get_named_arg("admin");
    let vault_contract: Key = runtime::get_named_arg("vault_contract");
    let market_factory: Key = runtime::get_named_arg("market_factory");

    runtime::put_key(storage_keys::ADMIN, storage::new_uref(admin).into());
    runtime::put_key(storage_keys::VAULT_CONTRACT, storage::new_uref(vault_contract).into());
    runtime::put_key(storage_keys::MARKET_FACTORY, storage::new_uref(market_factory).into());
    runtime::put_key(storage_keys::POSITIONS_COUNT, storage::new_uref(0u64).into());
}

/// Open a new long or short position
#[no_mangle]
pub extern "C" fn open_position() {
    let market_key: alloc::string::String = runtime::get_named_arg("market_key");
    let side_u8: u8 = runtime::get_named_arg("side"); // 0 = Long, 1 = Short
    let settlement_mode_u8: u8 = runtime::get_named_arg("settlement_mode"); // 0 = Daily, 1 = Continuous
    let collateral: U512 = runtime::get_named_arg("collateral");
    let leverage: u8 = runtime::get_named_arg("leverage");
    let entry_price: U256 = runtime::get_named_arg("entry_price");

    let user = runtime::get_caller();

    // Validate inputs
    if leverage < 1 || leverage > 10 {
        runtime::revert(errors::INVALID_LEVERAGE);
    }

    if collateral == U512::zero() {
        runtime::revert(errors::INVALID_COLLATERAL);
    }

    let side = match side_u8 {
        0 => PositionSide::Long,
        1 => PositionSide::Short,
        _ => runtime::revert(errors::INVALID_LEVERAGE), // Using as general invalid param
    };

    let settlement_mode = match settlement_mode_u8 {
        0 => SettlementMode::Daily,
        1 => SettlementMode::Continuous,
        _ => runtime::revert(errors::INVALID_LEVERAGE), // Using as general invalid param
    };

    // Calculate effective size
    let effective_size = collateral * U512::from(leverage);

    // TODO: Verify market is active (call market_factory)
    // TODO: Check position size limits (max 5% of pool)
    // TODO: Lock collateral in vault contract

    let now = runtime::get_blocktime();

    // Create position
    let position = Position {
        user,
        market_key: market_key.clone(),
        side,
        settlement_mode,
        collateral,
        leverage,
        effective_size,
        entry_price,
        timestamp: now,
        is_closed: false,
        accumulated_funding: 0,
        last_funding_time: now,
        funding_payments_count: 0,
    };

    // Store position
    let position_id = get_and_increment_position_count();
    let position_key = format!("{}{}", storage_keys::POSITION_PREFIX, position_id);
    runtime::put_key(&position_key, storage::new_uref(position).into());

    // Track user positions
    let user_positions_key = format!("{}{:?}", storage_keys::USER_POSITIONS_PREFIX, user);
    add_to_user_positions(user_positions_key, position_id);

    // Track market positions
    let market_positions_key = format!("{}{}", storage_keys::MARKET_POSITIONS_PREFIX, market_key);
    add_to_market_positions(market_positions_key, position_id);

    // For continuous perps, also track by asset type
    if settlement_mode as u8 == SettlementMode::Continuous as u8 {
        let asset_type: u8 = runtime::get_named_arg("asset_type");
        let perp_positions_key = format!("{}{}", storage_keys::PERP_POSITIONS_PREFIX, asset_type);
        add_to_perp_positions(perp_positions_key, position_id);
    }

    // Return position ID and liquidation price
    let liquidation_price = position.get_liquidation_price();
    runtime::ret(CLValue::from_t((position_id, liquidation_price)).unwrap_or_revert());
}

/// Close a position before settlement (early exit)
/// User can close position any time, will use current oracle price
#[no_mangle]
pub extern "C" fn close_position() {
    let position_id: u64 = runtime::get_named_arg("position_id");
    let exit_price: U256 = runtime::get_named_arg("exit_price");

    let caller = runtime::get_caller();

    // Get position
    let position_key = format!("{}{}", storage_keys::POSITION_PREFIX, position_id);
    let position_uref = runtime::get_key(&position_key)
        .unwrap_or_revert_with(errors::POSITION_NOT_FOUND)
        .into_uref()
        .unwrap_or_revert();

    let mut position: Position = storage::read(position_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    // Verify ownership
    if position.user != caller {
        runtime::revert(errors::UNAUTHORIZED);
    }

    // Verify not already closed
    if position.is_closed {
        runtime::revert(errors::POSITION_ALREADY_CLOSED);
    }

    // Check if liquidated
    if position.is_liquidated(exit_price) {
        runtime::revert(errors::POSITION_LIQUIDATED);
    }

    // Calculate PnL
    let (pnl, is_profit) = position.calculate_pnl(exit_price);

    // Close position
    position.is_closed = true;
    storage::write(position_uref, position);

    // TODO: Settle with vault contract
    // - Return collateral to user
    // - Add profit or deduct loss
    // - Take fees

    runtime::ret(CLValue::from_t((pnl, is_profit)).unwrap_or_revert());
}

/// Get position details
#[no_mangle]
pub extern "C" fn get_position() {
    let position_id: u64 = runtime::get_named_arg("position_id");

    let position_key = format!("{}{}", storage_keys::POSITION_PREFIX, position_id);
    let position_uref = runtime::get_key(&position_key)
        .unwrap_or_revert_with(errors::POSITION_NOT_FOUND)
        .into_uref()
        .unwrap_or_revert();

    let position: Position = storage::read(position_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    runtime::ret(CLValue::from_t(position).unwrap_or_revert());
}

/// Calculate current PnL for a position (includes funding for continuous perps)
#[no_mangle]
pub extern "C" fn calculate_position_pnl() {
    let position_id: u64 = runtime::get_named_arg("position_id");
    let current_price: U256 = runtime::get_named_arg("current_price");

    let position_key = format!("{}{}", storage_keys::POSITION_PREFIX, position_id);
    let position_uref = runtime::get_key(&position_key)
        .unwrap_or_revert_with(errors::POSITION_NOT_FOUND)
        .into_uref()
        .unwrap_or_revert();

    let position: Position = storage::read(position_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    let (pnl, is_profit) = position.calculate_pnl_with_funding(current_price);
    let is_liquidated = position.is_liquidated(current_price);
    let liquidation_price = position.get_liquidation_price();

    runtime::ret(
        CLValue::from_t((pnl, is_profit, is_liquidated, liquidation_price, position.accumulated_funding)).unwrap_or_revert(),
    );
}

/// Settle positions for a market (called by settlement contract)
#[no_mangle]
pub extern "C" fn settle_market_positions() {
    let market_key: alloc::string::String = runtime::get_named_arg("market_key");
    let settlement_price: U256 = runtime::get_named_arg("settlement_price");

    // TODO: Verify caller is settlement contract

    // Get all positions for this market
    let market_positions_key = format!("{}{}", storage_keys::MARKET_POSITIONS_PREFIX, market_key);

    // TODO: Iterate through all positions and settle each one
    // For each position:
    // 1. Calculate PnL
    // 2. Update vault balances
    // 3. Mark position as closed
    // 4. Distribute fees

    // For now, return success
    runtime::ret(CLValue::from_t(true).unwrap_or_revert());
}

/// Apply funding payment to a single position (for continuous perps)
/// Called by settlement contract every 8 hours
#[no_mangle]
pub extern "C" fn apply_funding_to_position() {
    let position_id: u64 = runtime::get_named_arg("position_id");
    let funding_rate: i64 = runtime::get_named_arg("funding_rate");

    // TODO: Verify caller is authorized (market_factory or admin)

    let position_key = format!("{}{}", storage_keys::POSITION_PREFIX, position_id);
    let position_uref = runtime::get_key(&position_key)
        .unwrap_or_revert_with(errors::POSITION_NOT_FOUND)
        .into_uref()
        .unwrap_or_revert();

    let mut position: Position = storage::read(position_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    let now = runtime::get_blocktime();
    position.apply_funding(funding_rate, now);

    storage::write(position_uref, position);

    runtime::ret(CLValue::from_t(true).unwrap_or_revert());
}

/// Apply funding to all positions for a perpetual market (called every 8 hours)
/// This is called by the settlement contract after funding rate is calculated
#[no_mangle]
pub extern "C" fn apply_funding_batch() {
    let asset_type: u8 = runtime::get_named_arg("asset_type");
    let funding_rate: i64 = runtime::get_named_arg("funding_rate");

    // TODO: Verify caller is market_factory or admin

    // Get all continuous perp positions for this asset
    let perp_positions_key = format!("{}{}", storage_keys::PERP_POSITIONS_PREFIX, asset_type);

    // TODO: In production, iterate through all positions efficiently
    // For now, this would be called for each position individually
    // or use dictionaries to batch process

    let now = runtime::get_blocktime();

    // Return success
    runtime::ret(CLValue::from_t((true, now)).unwrap_or_revert());
}

/// Get funding statistics for a position
#[no_mangle]
pub extern "C" fn get_position_funding() {
    let position_id: u64 = runtime::get_named_arg("position_id");

    let position_key = format!("{}{}", storage_keys::POSITION_PREFIX, position_id);
    let position_uref = runtime::get_key(&position_key)
        .unwrap_or_revert_with(errors::POSITION_NOT_FOUND)
        .into_uref()
        .unwrap_or_revert();

    let position: Position = storage::read(position_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    runtime::ret(
        CLValue::from_t((
            position.accumulated_funding,
            position.last_funding_time,
            position.funding_payments_count,
        ))
        .unwrap_or_revert(),
    );
}

// Helper functions

fn get_and_increment_position_count() -> u64 {
    let count_uref = runtime::get_key(storage_keys::POSITIONS_COUNT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let current_count: u64 = storage::read(count_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    storage::write(count_uref, current_count + 1);
    current_count
}

fn add_to_user_positions(user_positions_key: alloc::string::String, position_id: u64) {
    // Simple implementation: store as new key
    // In production, use a dictionary or vector
    let key = format!("{}_{}", user_positions_key, position_id);
    runtime::put_key(&key, storage::new_uref(position_id).into());
}

fn add_to_market_positions(market_positions_key: alloc::string::String, position_id: u64) {
    // Simple implementation: store as new key
    // In production, use a dictionary or vector
    let key = format!("{}_{}", market_positions_key, position_id);
    runtime::put_key(&key, storage::new_uref(position_id).into());
}

fn add_to_perp_positions(perp_positions_key: alloc::string::String, position_id: u64) {
    // Track continuous perp positions by asset type
    // In production, use a dictionary or vector
    let key = format!("{}_{}", perp_positions_key, position_id);
    runtime::put_key(&key, storage::new_uref(position_id).into());
}

#[no_mangle]
pub extern "C" fn call() {
    // Contract installation
    let admin: Key = runtime::get_named_arg("admin");
    let vault_contract: Key = runtime::get_named_arg("vault_contract");
    let market_factory: Key = runtime::get_named_arg("market_factory");

    let entry_points = casper_contract::contract_api::storage::create_contract_package_at_hash();

    runtime::put_key("position_manager", entry_points.into());
}
