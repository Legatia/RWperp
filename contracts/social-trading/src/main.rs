#![no_std]
#![no_main]

extern crate alloc;

use alloc::{string::String, vec::Vec, format};
use casper_contract::{
    contract_api::{runtime, storage, system},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{
    runtime_args, CLType, CLValue, EntryPoint, EntryPointAccess, EntryPointType,
    EntryPoints, Key, Parameter, RuntimeArgs, U512, URef, account::AccountHash, contracts::NamedKeys,
};

mod lib;
use lib::*;

const LEADERS_DICT: &str = "leaders";
const COPY_RELATIONSHIPS_DICT: &str = "copy_relationships";
const LEADER_STATS_DICT: &str = "leader_stats";
const COPIED_POSITIONS_DICT: &str = "copied_positions";
const FOLLOWER_LEADERS_DICT: &str = "follower_leaders";  // Maps follower -> list of leaders
const LEADER_FOLLOWERS_DICT: &str = "leader_followers";  // Maps leader -> list of followers

const MIN_TRADES_TO_BE_LEADER: u64 = 10;
const MIN_DAYS_TO_BE_LEADER: u64 = 30;
const MIN_ROI_TO_BE_LEADER: f64 = 5.0;  // 5% ROI minimum

/// Register as a trading leader
#[no_mangle]
pub extern "C" fn register_as_leader() {
    let caller = runtime::get_caller();
    let performance_fee: u8 = runtime::get_named_arg("performance_fee");
    let min_copy_amount: U512 = runtime::get_named_arg("min_copy_amount");
    let bio: String = runtime::get_named_arg("bio");
    let strategy_description: String = runtime::get_named_arg("strategy_description");

    // Validate performance fee (5-20%)
    if !validate_performance_fee(performance_fee) {
        runtime::revert(errors::INVALID_PERFORMANCE_FEE);
    }

    // Check if already registered
    let leaders_uref: URef = runtime::get_key(LEADERS_DICT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let leader_key = caller.to_string();
    if storage::dictionary_get::<Leader>(leaders_uref, &leader_key)
        .unwrap_or_revert()
        .is_some()
    {
        runtime::revert(errors::ALREADY_COPYING);  // Reusing error code
    }

    // Get user's trading history from position-manager
    let (total_trades, winning_trades, total_profit, first_trade_timestamp) =
        get_user_trading_history(caller);

    // Requirements to be a leader
    if total_trades < MIN_TRADES_TO_BE_LEADER {
        runtime::revert(errors::INSUFFICIENT_TRADING_HISTORY);
    }

    let days_active = calculate_days_since(first_trade_timestamp);
    if days_active < MIN_DAYS_TO_BE_LEADER {
        runtime::revert(errors::INSUFFICIENT_TRADING_HISTORY);
    }

    let win_rate = (winning_trades as f64 / total_trades as f64) * 100.0;
    let roi = calculate_roi(total_profit, total_trades);

    if roi < MIN_ROI_TO_BE_LEADER {
        runtime::revert(errors::INSUFFICIENT_TRADING_HISTORY);
    }

    // Calculate initial reputation score
    let reputation_score = calculate_reputation_score(
        total_trades,
        win_rate,
        total_profit,
        days_active,
    );

    // Create leader profile
    let mut leader = Leader::new(caller, performance_fee, min_copy_amount);
    leader.total_trades = total_trades;
    leader.winning_trades = winning_trades;
    leader.total_profit = total_profit;
    leader.reputation_score = reputation_score;
    leader.bio = bio;
    leader.strategy_description = strategy_description;
    leader.last_trade_at = runtime::get_blocktime().into();

    // Store leader
    storage::dictionary_put(leaders_uref, &leader_key, leader);

    // Initialize empty followers list
    let leader_followers_uref: URef = runtime::get_key(LEADER_FOLLOWERS_DICT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let empty_followers: Vec<AccountHash> = Vec::new();
    storage::dictionary_put(leader_followers_uref, &leader_key, empty_followers);

    // Emit event (simplified - in production use proper event system)
    runtime::put_key(&format!("event_leader_registered_{}", caller), storage::new_uref(caller).into());
}

/// Start copying a leader
#[no_mangle]
pub extern "C" fn start_copying() {
    let follower = runtime::get_caller();
    let leader: AccountHash = runtime::get_named_arg("leader");
    let amount: U512 = runtime::get_named_arg("amount");
    let allocation_percentage: u8 = runtime::get_named_arg("allocation_percentage");

    // Optional: custom risk limits
    let max_leverage: Option<u8> = runtime::get_named_arg("max_leverage");
    let stop_loss_pct: Option<u8> = runtime::get_named_arg("stop_loss_percentage");
    let allowed_markets: Option<Vec<u64>> = runtime::get_named_arg("allowed_markets");

    // Validate allocation percentage
    if !validate_allocation_percentage(allocation_percentage) {
        runtime::revert(errors::INVALID_ALLOCATION);
    }

    // Get leader data
    let leaders_uref: URef = runtime::get_key(LEADERS_DICT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let leader_key = leader.to_string();
    let mut leader_data: Leader = storage::dictionary_get(leaders_uref, &leader_key)
        .unwrap_or_revert()
        .unwrap_or_revert_with(errors::LEADER_NOT_FOUND);

    // Validations
    if amount < leader_data.min_copy_amount {
        runtime::revert(errors::BELOW_MINIMUM_COPY_AMOUNT);
    }

    if !leader_data.has_capacity() {
        runtime::revert(errors::LEADER_AT_CAPACITY);
    }

    // Check if already copying this leader
    let copy_relationships_uref: URef = runtime::get_key(COPY_RELATIONSHIPS_DICT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let relationship_key = format!("{}_{}", follower, leader);
    if storage::dictionary_get::<CopyRelationship>(copy_relationships_uref, &relationship_key)
        .unwrap_or_revert()
        .is_some()
    {
        runtime::revert(errors::ALREADY_COPYING);
    }

    // Transfer collateral from follower to social trading vault
    let vault_address = get_vault_address();
    transfer_cspr(follower, vault_address, amount);

    // Create copy relationship
    let mut relationship = CopyRelationship::new(
        follower,
        leader,
        amount,
        allocation_percentage,
    );

    // Apply custom risk limits if provided
    if let Some(leverage) = max_leverage {
        relationship.risk_limits.max_leverage = leverage;
    }
    if let Some(stop_loss) = stop_loss_pct {
        relationship.risk_limits.stop_loss_percentage = stop_loss;
    }
    if let Some(markets) = allowed_markets {
        relationship.risk_limits.allowed_markets = markets;
    }

    // Store relationship
    storage::dictionary_put(copy_relationships_uref, &relationship_key, relationship);

    // Update leader stats
    leader_data.total_followers += 1;
    leader_data.total_aum += amount;
    storage::dictionary_put(leaders_uref, &leader_key, leader_data);

    // Update follower's leaders list
    let follower_leaders_uref: URef = runtime::get_key(FOLLOWER_LEADERS_DICT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let follower_key = follower.to_string();
    let mut follower_leaders: Vec<AccountHash> = storage::dictionary_get(follower_leaders_uref, &follower_key)
        .unwrap_or_revert()
        .unwrap_or(Vec::new());
    follower_leaders.push(leader);
    storage::dictionary_put(follower_leaders_uref, &follower_key, follower_leaders);

    // Update leader's followers list
    let leader_followers_uref: URef = runtime::get_key(LEADER_FOLLOWERS_DICT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let mut followers: Vec<AccountHash> = storage::dictionary_get(leader_followers_uref, &leader_key)
        .unwrap_or_revert()
        .unwrap_or(Vec::new());
    followers.push(follower);
    storage::dictionary_put(leader_followers_uref, &leader_key, followers);

    // Emit event
    runtime::put_key(&format!("event_copy_started_{}_{}", follower, leader), storage::new_uref(amount).into());
}

/// Stop copying a leader
#[no_mangle]
pub extern "C" fn stop_copying() {
    let follower = runtime::get_caller();
    let leader: AccountHash = runtime::get_named_arg("leader");
    let reason: String = runtime::get_named_arg("reason");

    let copy_relationships_uref: URef = runtime::get_key(COPY_RELATIONSHIPS_DICT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let relationship_key = format!("{}_{}", follower, leader);
    let mut relationship: CopyRelationship = storage::dictionary_get(copy_relationships_uref, &relationship_key)
        .unwrap_or_revert()
        .unwrap_or_revert_with(errors::NOT_COPYING);

    // Close all copied positions from this leader
    close_all_copied_positions(follower, leader);

    // Calculate and settle performance fees
    if relationship.total_profit > 0 {
        settle_performance_fee(follower, leader, relationship.total_profit);
    }

    // Return remaining collateral to follower
    let remaining_balance = relationship.allocation_amount; // Simplified
    let vault_address = get_vault_address();
    transfer_cspr(vault_address, follower, remaining_balance);

    // Update leader stats
    let leaders_uref: URef = runtime::get_key(LEADERS_DICT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let leader_key = leader.to_string();
    let mut leader_data: Leader = storage::dictionary_get(leaders_uref, &leader_key)
        .unwrap_or_revert()
        .unwrap_or_revert();

    leader_data.total_followers -= 1;
    leader_data.total_aum -= relationship.allocation_amount;
    storage::dictionary_put(leaders_uref, &leader_key, leader_data);

    // Remove relationship
    relationship.is_active = false;
    relationship.pause_reason = reason.clone();
    storage::dictionary_put(copy_relationships_uref, &relationship_key, relationship);

    // Emit event
    runtime::put_key(&format!("event_copy_stopped_{}_{}", follower, leader), storage::new_uref(0u64).into());
}

/// Mirror a leader's position (called when leader opens a position)
#[no_mangle]
pub extern "C" fn mirror_position() {
    let leader = runtime::get_caller();
    let market_id: u64 = runtime::get_named_arg("market_id");
    let is_long: bool = runtime::get_named_arg("is_long");
    let leader_size: U512 = runtime::get_named_arg("size");
    let leader_collateral: U512 = runtime::get_named_arg("collateral");
    let leverage: u8 = runtime::get_named_arg("leverage");
    let entry_price: U512 = runtime::get_named_arg("entry_price");
    let leader_position_id: String = runtime::get_named_arg("position_id");

    // Get all followers of this leader
    let leader_followers_uref: URef = runtime::get_key(LEADER_FOLLOWERS_DICT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let leader_key = leader.to_string();
    let followers: Vec<AccountHash> = storage::dictionary_get(leader_followers_uref, &leader_key)
        .unwrap_or_revert()
        .unwrap_or(Vec::new());

    // Get leader's AUM for proportional calculation
    let leaders_uref: URef = runtime::get_key(LEADERS_DICT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let leader_data: Leader = storage::dictionary_get(leaders_uref, &leader_key)
        .unwrap_or_revert()
        .unwrap_or_revert();

    let copy_relationships_uref: URef = runtime::get_key(COPY_RELATIONSHIPS_DICT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    // Mirror position for each active follower
    for follower_addr in followers.iter() {
        let relationship_key = format!("{}_{}", follower_addr, leader);
        let mut relationship: CopyRelationship = match storage::dictionary_get(copy_relationships_uref, &relationship_key)
            .unwrap_or_revert()
        {
            Some(rel) => rel,
            None => continue,
        };

        // Skip if not active
        if !relationship.is_active {
            continue;
        }

        // Apply risk checks
        if !check_risk_limits(&relationship, market_id, leverage, leader_collateral) {
            continue;
        }

        // Check daily trade limit
        let trades_today = count_trades_today(*follower_addr, leader);
        if trades_today >= relationship.risk_limits.max_daily_trades {
            relationship.pause(format!("Daily trade limit ({}) reached", relationship.risk_limits.max_daily_trades));
            storage::dictionary_put(copy_relationships_uref, &relationship_key, relationship);
            continue;
        }

        // Check max concurrent positions
        let active_positions = count_active_copied_positions(*follower_addr, leader);
        if active_positions >= relationship.risk_limits.max_concurrent_positions {
            continue;
        }

        // Calculate proportional position size
        let follower_collateral = calculate_follower_collateral(
            relationship.allocation_amount,
            leader_collateral,
            leader_data.total_aum,
        );

        // Apply risk limits
        let final_leverage = u8::min(leverage, relationship.risk_limits.max_leverage);
        let max_size = follower_collateral * U512::from(final_leverage as u64);
        let final_size = U512::min(max_size, relationship.risk_limits.max_position_size);

        // Calculate liquidation price (same logic as leader)
        let liquidation_price = calculate_liquidation_price(
            entry_price,
            is_long,
            final_leverage,
        );

        // Open position for copier
        open_copied_position(
            *follower_addr,
            leader,
            market_id,
            is_long,
            entry_price,
            final_size,
            follower_collateral,
            final_leverage,
            liquidation_price,
            leader_position_id.clone(),
        );

        // Update relationship
        relationship.trades_copied += 1;
        storage::dictionary_put(copy_relationships_uref, &relationship_key, relationship);
    }
}

/// Settle performance fees (called monthly or when copying stops)
#[no_mangle]
pub extern "C" fn settle_performance_fees() {
    let follower = runtime::get_caller();
    let leader: AccountHash = runtime::get_named_arg("leader");

    let copy_relationships_uref: URef = runtime::get_key(COPY_RELATIONSHIPS_DICT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let relationship_key = format!("{}_{}", follower, leader);
    let mut relationship: CopyRelationship = storage::dictionary_get(copy_relationships_uref, &relationship_key)
        .unwrap_or_revert()
        .unwrap_or_revert_with(errors::NOT_COPYING);

    // Only settle if there's profit
    if relationship.total_profit <= 0 {
        return;
    }

    settle_performance_fee(follower, leader, relationship.total_profit);

    // Reset profit counter (fees already settled)
    relationship.total_profit = 0;
    storage::dictionary_put(copy_relationships_uref, &relationship_key, relationship);
}

/// Update risk limits for an existing copy relationship
#[no_mangle]
pub extern "C" fn update_risk_limits() {
    let follower = runtime::get_caller();
    let leader: AccountHash = runtime::get_named_arg("leader");
    let max_leverage: Option<u8> = runtime::get_named_arg("max_leverage");
    let stop_loss_pct: Option<u8> = runtime::get_named_arg("stop_loss_percentage");
    let max_position_size: Option<U512> = runtime::get_named_arg("max_position_size");
    let allowed_markets: Option<Vec<u64>> = runtime::get_named_arg("allowed_markets");

    let copy_relationships_uref: URef = runtime::get_key(COPY_RELATIONSHIPS_DICT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let relationship_key = format!("{}_{}", follower, leader);
    let mut relationship: CopyRelationship = storage::dictionary_get(copy_relationships_uref, &relationship_key)
        .unwrap_or_revert()
        .unwrap_or_revert_with(errors::NOT_COPYING);

    // Update risk limits
    if let Some(leverage) = max_leverage {
        relationship.risk_limits.max_leverage = leverage;
    }
    if let Some(stop_loss) = stop_loss_pct {
        relationship.risk_limits.stop_loss_percentage = stop_loss;
    }
    if let Some(max_size) = max_position_size {
        relationship.risk_limits.max_position_size = max_size;
    }
    if let Some(markets) = allowed_markets {
        relationship.risk_limits.allowed_markets = markets;
    }

    storage::dictionary_put(copy_relationships_uref, &relationship_key, relationship);
}

/// Pause copying (temporarily stop without closing positions)
#[no_mangle]
pub extern "C" fn pause_copying() {
    let follower = runtime::get_caller();
    let leader: AccountHash = runtime::get_named_arg("leader");
    let reason: String = runtime::get_named_arg("reason");

    let copy_relationships_uref: URef = runtime::get_key(COPY_RELATIONSHIPS_DICT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let relationship_key = format!("{}_{}", follower, leader);
    let mut relationship: CopyRelationship = storage::dictionary_get(copy_relationships_uref, &relationship_key)
        .unwrap_or_revert()
        .unwrap_or_revert_with(errors::NOT_COPYING);

    relationship.pause(reason);
    storage::dictionary_put(copy_relationships_uref, &relationship_key, relationship);
}

/// Resume copying
#[no_mangle]
pub extern "C" fn resume_copying() {
    let follower = runtime::get_caller();
    let leader: AccountHash = runtime::get_named_arg("leader");

    let copy_relationships_uref: URef = runtime::get_key(COPY_RELATIONSHIPS_DICT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let relationship_key = format!("{}_{}", follower, leader);
    let mut relationship: CopyRelationship = storage::dictionary_get(copy_relationships_uref, &relationship_key)
        .unwrap_or_revert()
        .unwrap_or_revert_with(errors::NOT_COPYING);

    relationship.resume();
    storage::dictionary_put(copy_relationships_uref, &relationship_key, relationship);
}

// ===== Helper Functions =====

fn calculate_follower_collateral(
    follower_allocation: U512,
    leader_position_collateral: U512,
    leader_total_aum: U512,
) -> U512 {
    if leader_total_aum == U512::zero() {
        return U512::zero();
    }

    // Proportional allocation
    // If leader uses 10% of AUM, follower uses 10% of allocation
    (follower_allocation * leader_position_collateral) / leader_total_aum
}

fn check_risk_limits(
    relationship: &CopyRelationship,
    market_id: u64,
    leverage: u8,
    collateral: U512,
) -> bool {
    // Check leverage limit
    if leverage > relationship.risk_limits.max_leverage {
        return false;
    }

    // Check position size limit
    if collateral > relationship.risk_limits.max_position_size {
        return false;
    }

    // Check allowed markets
    if !relationship.risk_limits.allowed_markets.is_empty() {
        if !relationship.risk_limits.allowed_markets.contains(&market_id) {
            return false;
        }
    }

    true
}

fn calculate_liquidation_price(
    entry_price: U512,
    is_long: bool,
    leverage: u8,
) -> U512 {
    let liquidation_threshold = 90u64; // 90% of collateral

    if is_long {
        // Long liquidation = entry * (1 - 0.9/leverage)
        let factor = U512::from(1000 - (900 / leverage as u64));
        (entry_price * factor) / U512::from(1000)
    } else {
        // Short liquidation = entry * (1 + 0.9/leverage)
        let factor = U512::from(1000 + (900 / leverage as u64));
        (entry_price * factor) / U512::from(1000)
    }
}

fn settle_performance_fee(
    follower: AccountHash,
    leader: AccountHash,
    profit: i128,
) {
    let leaders_uref: URef = runtime::get_key(LEADERS_DICT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let leader_key = leader.to_string();
    let leader_data: Leader = storage::dictionary_get(leaders_uref, &leader_key)
        .unwrap_or_revert()
        .unwrap_or_revert();

    let performance_fee_amount = (profit as u128 * leader_data.performance_fee as u128) / 100;
    let fee_u512 = U512::from(performance_fee_amount);

    // Transfer fee from vault to leader
    let vault_address = get_vault_address();
    transfer_cspr(vault_address, leader, fee_u512);

    // Update relationship
    let copy_relationships_uref: URef = runtime::get_key(COPY_RELATIONSHIPS_DICT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let relationship_key = format!("{}_{}", follower, leader);
    let mut relationship: CopyRelationship = storage::dictionary_get(copy_relationships_uref, &relationship_key)
        .unwrap_or_revert()
        .unwrap_or_revert();

    relationship.fees_paid += fee_u512;
    storage::dictionary_put(copy_relationships_uref, &relationship_key, relationship);
}

fn get_user_trading_history(user: AccountHash) -> (u64, u64, i128, u64) {
    // In production, query position-manager contract
    // For now, return mock data
    (50, 30, 1_000_000_000_000i128, runtime::get_blocktime().into())
}

fn calculate_days_since(timestamp: u64) -> u64 {
    let now: u64 = runtime::get_blocktime().into();
    (now - timestamp) / 86400
}

fn calculate_roi(total_profit: i128, total_trades: u64) -> f64 {
    if total_trades == 0 {
        return 0.0;
    }
    // Simplified ROI calculation
    (total_profit as f64 / 10_000_000_000_000.0) * 100.0
}

fn get_vault_address() -> AccountHash {
    // In production, get from contract named keys
    runtime::get_caller() // Placeholder
}

fn transfer_cspr(from: AccountHash, to: AccountHash, amount: U512) {
    // In production, use proper CSPR transfer
    // This is a simplified placeholder
}

fn open_copied_position(
    follower: AccountHash,
    leader: AccountHash,
    market_id: u64,
    is_long: bool,
    entry_price: U512,
    size: U512,
    collateral: U512,
    leverage: u8,
    liquidation_price: U512,
    leader_position_id: String,
) {
    // In production, call position-manager contract to open position
    // Store copied position record
    let copied_positions_uref: URef = runtime::get_key(COPIED_POSITIONS_DICT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let position_id = format!("{}_{}_{}_{}", follower, leader, market_id, runtime::get_blocktime());

    let copied_position = CopiedPosition {
        position_id: position_id.clone(),
        follower,
        leader,
        market_id,
        is_long,
        entry_price,
        size,
        collateral,
        leverage,
        liquidation_price,
        opened_at: runtime::get_blocktime().into(),
        closed_at: 0,
        pnl: 0,
        leader_position_id,
    };

    storage::dictionary_put(copied_positions_uref, &position_id, copied_position);
}

fn close_all_copied_positions(follower: AccountHash, leader: AccountHash) {
    // In production, query and close all open copied positions
    // Simplified placeholder
}

fn count_trades_today(follower: AccountHash, leader: AccountHash) -> u32 {
    // Count trades in last 24 hours
    // Placeholder
    0
}

fn count_active_copied_positions(follower: AccountHash, leader: AccountHash) -> u32 {
    // Count open positions
    // Placeholder
    0
}

// ===== Contract Installation =====

#[no_mangle]
pub extern "C" fn call() {
    // Create dictionaries
    let leaders_dict = storage::new_dictionary(LEADERS_DICT).unwrap_or_revert();
    let copy_relationships_dict = storage::new_dictionary(COPY_RELATIONSHIPS_DICT).unwrap_or_revert();
    let leader_stats_dict = storage::new_dictionary(LEADER_STATS_DICT).unwrap_or_revert();
    let copied_positions_dict = storage::new_dictionary(COPIED_POSITIONS_DICT).unwrap_or_revert();
    let follower_leaders_dict = storage::new_dictionary(FOLLOWER_LEADERS_DICT).unwrap_or_revert();
    let leader_followers_dict = storage::new_dictionary(LEADER_FOLLOWERS_DICT).unwrap_or_revert();

    // Create entry points
    let mut entry_points = EntryPoints::new();

    entry_points.add_entry_point(EntryPoint::new(
        "register_as_leader",
        vec![
            Parameter::new("performance_fee", CLType::U8),
            Parameter::new("min_copy_amount", CLType::U512),
            Parameter::new("bio", CLType::String),
            Parameter::new("strategy_description", CLType::String),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        "start_copying",
        vec![
            Parameter::new("leader", CLType::Key),
            Parameter::new("amount", CLType::U512),
            Parameter::new("allocation_percentage", CLType::U8),
            Parameter::new("max_leverage", CLType::Option(Box::new(CLType::U8))),
            Parameter::new("stop_loss_percentage", CLType::Option(Box::new(CLType::U8))),
            Parameter::new("allowed_markets", CLType::Option(Box::new(CLType::List(Box::new(CLType::U64))))),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        "stop_copying",
        vec![
            Parameter::new("leader", CLType::Key),
            Parameter::new("reason", CLType::String),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        "mirror_position",
        vec![
            Parameter::new("market_id", CLType::U64),
            Parameter::new("is_long", CLType::Bool),
            Parameter::new("size", CLType::U512),
            Parameter::new("collateral", CLType::U512),
            Parameter::new("leverage", CLType::U8),
            Parameter::new("entry_price", CLType::U512),
            Parameter::new("position_id", CLType::String),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        "settle_performance_fees",
        vec![
            Parameter::new("leader", CLType::Key),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        "update_risk_limits",
        vec![
            Parameter::new("leader", CLType::Key),
            Parameter::new("max_leverage", CLType::Option(Box::new(CLType::U8))),
            Parameter::new("stop_loss_percentage", CLType::Option(Box::new(CLType::U8))),
            Parameter::new("max_position_size", CLType::Option(Box::new(CLType::U512))),
            Parameter::new("allowed_markets", CLType::Option(Box::new(CLType::List(Box::new(CLType::U64))))),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        "pause_copying",
        vec![
            Parameter::new("leader", CLType::Key),
            Parameter::new("reason", CLType::String),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        "resume_copying",
        vec![
            Parameter::new("leader", CLType::Key),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Contract,
    ));

    // Create named keys
    let mut named_keys = NamedKeys::new();
    named_keys.insert(LEADERS_DICT.to_string(), leaders_dict.into());
    named_keys.insert(COPY_RELATIONSHIPS_DICT.to_string(), copy_relationships_dict.into());
    named_keys.insert(LEADER_STATS_DICT.to_string(), leader_stats_dict.into());
    named_keys.insert(COPIED_POSITIONS_DICT.to_string(), copied_positions_dict.into());
    named_keys.insert(FOLLOWER_LEADERS_DICT.to_string(), follower_leaders_dict.into());
    named_keys.insert(LEADER_FOLLOWERS_DICT.to_string(), leader_followers_dict.into());

    // Install contract
    let (contract_hash, _contract_version) = storage::new_contract(
        entry_points,
        Some(named_keys),
        Some("social_trading_contract_hash".to_string()),
        Some("social_trading_access_uref".to_string()),
    );

    runtime::put_key("social_trading_contract", contract_hash.into());
}
