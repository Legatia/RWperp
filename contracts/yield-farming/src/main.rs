#![no_std]
#![no_main]

extern crate alloc;

use alloc::format;
use casper_contract::{
    contract_api::{runtime, storage},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{account::AccountHash, Key, U512, CLValue};

use yield_farming::{errors, storage_keys, FarmingPool, UserFarmingPosition, MiningSchedule};

/// Initialize yield farming contract
#[no_mangle]
pub extern "C" fn init() {
    let admin: Key = runtime::get_named_arg("admin");
    let reward_token: Key = runtime::get_named_arg("reward_token"); // RWP governance token

    runtime::put_key(storage_keys::ADMIN, storage::new_uref(admin).into());
    runtime::put_key("reward_token", storage::new_uref(reward_token).into());

    // Initialize mining schedule
    let schedule = MiningSchedule::default();
    runtime::put_key(storage_keys::MINING_SCHEDULE, storage::new_uref(schedule).into());

    runtime::put_key(storage_keys::TOTAL_REWARDS_DISTRIBUTED, storage::new_uref(U512::zero()).into());
}

/// Create a new farming pool
#[no_mangle]
pub extern "C" fn create_pool() {
    verify_admin();

    let pool_id: u8 = runtime::get_named_arg("pool_id");
    let name: alloc::string::String = runtime::get_named_arg("name");
    let staking_token: alloc::string::String = runtime::get_named_arg("staking_token");
    let reward_per_second: U512 = runtime::get_named_arg("reward_per_second");
    let start_time: u64 = runtime::get_named_arg("start_time");
    let end_time: u64 = runtime::get_named_arg("end_time");

    let pool = FarmingPool {
        pool_id,
        name,
        staking_token,
        reward_token: "RWP".into(),
        total_staked: U512::zero(),
        reward_per_second,
        start_time,
        end_time,
        last_reward_time: start_time,
        accumulated_reward_per_share: U512::zero(),
    };

    let pool_key = format!("{}{}", storage_keys::FARMING_POOLS_PREFIX, pool_id);
    runtime::put_key(&pool_key, storage::new_uref(pool).into());
}

/// Stake tokens in a farming pool
#[no_mangle]
pub extern "C" fn stake_in_pool() {
    let pool_id: u8 = runtime::get_named_arg("pool_id");
    let amount: U512 = runtime::get_named_arg("amount");
    let user = runtime::get_caller();

    if amount == U512::zero() {
        runtime::revert(errors::INSUFFICIENT_STAKE);
    }

    // Get pool
    let pool_key = format!("{}{}", storage_keys::FARMING_POOLS_PREFIX, pool_id);
    let pool_uref = runtime::get_key(&pool_key)
        .unwrap_or_revert_with(errors::POOL_NOT_ACTIVE)
        .into_uref()
        .unwrap_or_revert();

    let mut pool: FarmingPool = storage::read(pool_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    // Update pool
    update_pool(&mut pool);

    // Get or create user position
    let user_position_key = format!("{}{}_{:?}", storage_keys::USER_FARMING_PREFIX, pool_id, user);
    let mut position = match runtime::get_key(&user_position_key) {
        Some(key) => {
            let uref = key.into_uref().unwrap_or_revert();
            storage::read::<UserFarmingPosition>(uref)
                .unwrap_or_revert()
                .unwrap_or_revert()
        }
        None => UserFarmingPosition {
            user,
            pool_id,
            staked_amount: U512::zero(),
            reward_debt: U512::zero(),
            pending_rewards: U512::zero(),
            stake_timestamp: runtime::get_blocktime(),
        },
    };

    // Harvest existing rewards
    if position.staked_amount > U512::zero() {
        let pending = pool.calculate_pending_rewards(&position);
        position.pending_rewards += pending;
    }

    // Update position
    position.staked_amount += amount;
    position.reward_debt = (position.staked_amount * pool.accumulated_reward_per_share)
        / U512::from(1e18 as u128);

    // Update pool
    pool.total_staked += amount;

    // Save
    storage::write(pool_uref, pool);
    match runtime::get_key(&user_position_key) {
        Some(key) => {
            let uref = key.into_uref().unwrap_or_revert();
            storage::write(uref, position);
        }
        None => {
            runtime::put_key(&user_position_key, storage::new_uref(position).into());
        }
    }

    runtime::ret(CLValue::from_t(true).unwrap_or_revert());
}

/// Unstake tokens from a farming pool
#[no_mangle]
pub extern "C" fn unstake_from_pool() {
    let pool_id: u8 = runtime::get_named_arg("pool_id");
    let amount: U512 = runtime::get_named_arg("amount");
    let user = runtime::get_caller();

    // Get pool
    let pool_key = format!("{}{}", storage_keys::FARMING_POOLS_PREFIX, pool_id);
    let pool_uref = runtime::get_key(&pool_key)
        .unwrap_or_revert_with(errors::POOL_NOT_ACTIVE)
        .into_uref()
        .unwrap_or_revert();

    let mut pool: FarmingPool = storage::read(pool_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    // Update pool
    update_pool(&mut pool);

    // Get user position
    let user_position_key = format!("{}{}_{:?}", storage_keys::USER_FARMING_PREFIX, pool_id, user);
    let position_uref = runtime::get_key(&user_position_key)
        .unwrap_or_revert_with(errors::INSUFFICIENT_STAKE)
        .into_uref()
        .unwrap_or_revert();

    let mut position: UserFarmingPosition = storage::read(position_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    if amount > position.staked_amount {
        runtime::revert(errors::INSUFFICIENT_STAKE);
    }

    // Harvest rewards
    let pending = pool.calculate_pending_rewards(&position);
    position.pending_rewards += pending;

    // Update position
    position.staked_amount -= amount;
    position.reward_debt = (position.staked_amount * pool.accumulated_reward_per_share)
        / U512::from(1e18 as u128);

    // Update pool
    pool.total_staked -= amount;

    // Save
    storage::write(pool_uref, pool);
    storage::write(position_uref, position);

    runtime::ret(CLValue::from_t(amount).unwrap_or_revert());
}

/// Harvest farming rewards
#[no_mangle]
pub extern "C" fn harvest() {
    let pool_id: u8 = runtime::get_named_arg("pool_id");
    let user = runtime::get_caller();

    // Get pool
    let pool_key = format!("{}{}", storage_keys::FARMING_POOLS_PREFIX, pool_id);
    let pool_uref = runtime::get_key(&pool_key)
        .unwrap_or_revert_with(errors::POOL_NOT_ACTIVE)
        .into_uref()
        .unwrap_or_revert();

    let mut pool: FarmingPool = storage::read(pool_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    // Update pool
    update_pool(&mut pool);

    // Get user position
    let user_position_key = format!("{}{}_{:?}", storage_keys::USER_FARMING_PREFIX, pool_id, user);
    let position_uref = runtime::get_key(&user_position_key)
        .unwrap_or_revert_with(errors::INSUFFICIENT_STAKE)
        .into_uref()
        .unwrap_or_revert();

    let mut position: UserFarmingPosition = storage::read(position_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    // Calculate pending rewards
    let pending = pool.calculate_pending_rewards(&position);
    let total_rewards = position.pending_rewards + pending;

    if total_rewards == U512::zero() {
        runtime::revert(errors::REWARDS_EXHAUSTED);
    }

    // Reset pending rewards
    position.pending_rewards = U512::zero();
    position.reward_debt = (position.staked_amount * pool.accumulated_reward_per_share)
        / U512::from(1e18 as u128);

    // Update total rewards distributed
    let total_distributed_uref = runtime::get_key(storage_keys::TOTAL_REWARDS_DISTRIBUTED)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let mut total_distributed: U512 = storage::read(total_distributed_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();
    total_distributed += total_rewards;
    storage::write(total_distributed_uref, total_distributed);

    // Save
    storage::write(pool_uref, pool);
    storage::write(position_uref, position);

    // Transfer rewards to user (via governance token contract)
    // TODO: Call governance contract to transfer RWP tokens

    runtime::ret(CLValue::from_t(total_rewards).unwrap_or_revert());
}

/// Get pending rewards for a user
#[no_mangle]
pub extern "C" fn get_pending_rewards() {
    let pool_id: u8 = runtime::get_named_arg("pool_id");
    let user: AccountHash = runtime::get_named_arg("user");

    // Get pool
    let pool_key = format!("{}{}", storage_keys::FARMING_POOLS_PREFIX, pool_id);
    let pool_uref = runtime::get_key(&pool_key)
        .unwrap_or_revert_with(errors::POOL_NOT_ACTIVE)
        .into_uref()
        .unwrap_or_revert();

    let pool: FarmingPool = storage::read(pool_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    // Get user position
    let user_position_key = format!("{}{}_{:?}", storage_keys::USER_FARMING_PREFIX, pool_id, user);
    let position_uref = runtime::get_key(&user_position_key)
        .unwrap_or_revert_with(errors::INSUFFICIENT_STAKE)
        .into_uref()
        .unwrap_or_revert();

    let position: UserFarmingPosition = storage::read(position_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    let pending = pool.calculate_pending_rewards(&position);
    runtime::ret(CLValue::from_t(pending).unwrap_or_revert());
}

/// Get pool APR
#[no_mangle]
pub extern "C" fn get_pool_apr() {
    let pool_id: u8 = runtime::get_named_arg("pool_id");

    let pool_key = format!("{}{}", storage_keys::FARMING_POOLS_PREFIX, pool_id);
    let pool_uref = runtime::get_key(&pool_key)
        .unwrap_or_revert_with(errors::POOL_NOT_ACTIVE)
        .into_uref()
        .unwrap_or_revert();

    let pool: FarmingPool = storage::read(pool_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    let apr = pool.calculate_apr();
    runtime::ret(CLValue::from_t(apr).unwrap_or_revert());
}

// Helper functions

fn update_pool(pool: &mut FarmingPool) {
    let current_time = runtime::get_blocktime();

    if current_time <= pool.last_reward_time {
        return;
    }

    if pool.total_staked == U512::zero() {
        pool.last_reward_time = current_time;
        return;
    }

    // Calculate rewards since last update
    let time_elapsed = current_time - pool.last_reward_time;
    let rewards = U512::from(time_elapsed) * pool.reward_per_second;

    // Update accumulated reward per share
    let reward_per_share_increase = (rewards * U512::from(1e18 as u128)) / pool.total_staked;
    pool.accumulated_reward_per_share += reward_per_share_increase;

    pool.last_reward_time = current_time;
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
        runtime::revert(errors::INSUFFICIENT_STAKE);
    }
}

#[no_mangle]
pub extern "C" fn call() {
    let admin: Key = runtime::get_named_arg("admin");
    let reward_token: Key = runtime::get_named_arg("reward_token");

    let entry_points = casper_contract::contract_api::storage::create_contract_package_at_hash();

    runtime::put_key("yield_farming", entry_points.into());
}
