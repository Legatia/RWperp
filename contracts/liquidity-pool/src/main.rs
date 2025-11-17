#![no_std]
#![no_main]

extern crate alloc;

use alloc::format;
use alloc::string::ToString;
use casper_contract::{
    contract_api::{runtime, storage, system},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{account::AccountHash, runtime_args, Key, RuntimeArgs, U512, CLValue};

use liquidity_pool::{errors, storage_keys, LiquidityPool, LiquidityProvider, WithdrawalRequest};

/// Initialize the liquidity pool contract
#[no_mangle]
pub extern "C" fn init() {
    let admin: Key = runtime::get_named_arg("admin");
    let vault_contract: Key = runtime::get_named_arg("vault_contract");

    runtime::put_key(storage_keys::ADMIN, storage::new_uref(admin).into());
    runtime::put_key(storage_keys::VAULT_CONTRACT, storage::new_uref(vault_contract).into());

    // Initialize pool
    let pool = LiquidityPool {
        total_liquidity: U512::zero(),
        total_lp_tokens: U512::zero(),
        total_fees_earned: U512::zero(),
        trader_pnl: 0,
        utilization_rate: 0,
    };

    runtime::put_key(storage_keys::LP_POOL, storage::new_uref(pool).into());
    runtime::put_key(storage_keys::MIN_LIQUIDITY, storage::new_uref(U512::from(10_000_000_000u64)).into()); // 10 CSPR min
    runtime::put_key(storage_keys::WITHDRAWAL_DELAY, storage::new_uref(86400u64).into()); // 24h delay
}

/// Add liquidity to the pool
/// User deposits CSPR and receives LP tokens (rwLP-CSPR)
#[no_mangle]
pub extern "C" fn add_liquidity() {
    let amount: U512 = runtime::get_named_arg("amount");
    let user = runtime::get_caller();

    // Validate amount
    let min_liquidity_uref = runtime::get_key(storage_keys::MIN_LIQUIDITY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let min_liquidity: U512 = storage::read(min_liquidity_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    if amount < min_liquidity {
        runtime::revert(errors::BELOW_MIN_DEPOSIT);
    }

    // Get current pool state
    let pool_uref = runtime::get_key(storage_keys::LP_POOL)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let mut pool: LiquidityPool = storage::read(pool_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    // Calculate LP tokens to mint
    let lp_tokens_to_mint = if pool.total_lp_tokens == U512::zero() {
        // First deposit: 1:1 ratio
        amount
    } else {
        // Subsequent deposits: proportional to pool share
        // lp_tokens = (amount / total_liquidity) * total_lp_tokens
        (amount * pool.total_lp_tokens) / pool.total_liquidity
    };

    // Update pool
    pool.total_liquidity += amount;
    pool.total_lp_tokens += lp_tokens_to_mint;
    storage::write(pool_uref, pool);

    // Get or create LP
    let mut lp = get_or_create_lp(user);
    lp.lp_tokens += lp_tokens_to_mint;
    lp.deposited_amount += amount;
    lp.deposit_timestamp = runtime::get_blocktime();
    save_lp(user, &lp);

    // Transfer CSPR from user to vault
    // TODO: Call vault contract to deposit

    runtime::ret(CLValue::from_t(lp_tokens_to_mint).unwrap_or_revert());
}

/// Request withdrawal of liquidity
/// Initiates 24h timelock before withdrawal can be executed
#[no_mangle]
pub extern "C" fn request_withdrawal() {
    let lp_tokens: U512 = runtime::get_named_arg("lp_tokens");
    let user = runtime::get_caller();

    let mut lp = get_or_create_lp(user);

    if lp_tokens > lp.lp_tokens {
        runtime::revert(errors::INSUFFICIENT_LIQUIDITY);
    }

    // Get withdrawal delay
    let delay_uref = runtime::get_key(storage_keys::WITHDRAWAL_DELAY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let withdrawal_delay: u64 = storage::read(delay_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    // Create withdrawal request
    let request = WithdrawalRequest {
        amount: lp_tokens,
        request_time: runtime::get_blocktime(),
        unlock_time: runtime::get_blocktime() + withdrawal_delay,
    };

    lp.withdrawal_requests.push(request);
    save_lp(user, &lp);

    runtime::ret(CLValue::from_t(request.unlock_time).unwrap_or_revert());
}

/// Execute withdrawal after timelock expires
#[no_mangle]
pub extern "C" fn execute_withdrawal() {
    let user = runtime::get_caller();
    let mut lp = get_or_create_lp(user);

    // Find and process mature withdrawal requests
    let current_time = runtime::get_blocktime();
    let mut total_withdrawn = U512::zero();
    let mut cspr_to_return = U512::zero();

    // Get pool for calculations
    let pool_uref = runtime::get_key(storage_keys::LP_POOL)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let mut pool: LiquidityPool = storage::read(pool_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    // Process withdrawals
    lp.withdrawal_requests.retain(|request| {
        if request.unlock_time <= current_time {
            // Calculate CSPR amount
            // cspr_amount = (lp_tokens / total_lp_tokens) * total_liquidity
            let cspr_amount = (request.amount * pool.total_liquidity) / pool.total_lp_tokens;

            total_withdrawn += request.amount;
            cspr_to_return += cspr_amount;

            // Update pool
            pool.total_lp_tokens -= request.amount;
            pool.total_liquidity -= cspr_amount;

            false // Remove this request
        } else {
            true // Keep this request
        }
    });

    if total_withdrawn == U512::zero() {
        runtime::revert(errors::WITHDRAWAL_LOCKED);
    }

    // Update LP tokens
    lp.lp_tokens -= total_withdrawn;
    save_lp(user, &lp);

    // Update pool
    storage::write(pool_uref, pool);

    // Transfer CSPR back to user via vault
    // TODO: Call vault contract

    runtime::ret(CLValue::from_t(cspr_to_return).unwrap_or_revert());
}

/// Get current LP token price
#[no_mangle]
pub extern "C" fn get_lp_price() {
    let pool_uref = runtime::get_key(storage_keys::LP_POOL)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let pool: LiquidityPool = storage::read(pool_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    let price = pool.get_lp_token_price();
    runtime::ret(CLValue::from_t(price).unwrap_or_revert());
}

/// Get LP APY
#[no_mangle]
pub extern "C" fn get_lp_apy() {
    let pool_uref = runtime::get_key(storage_keys::LP_POOL)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let pool: LiquidityPool = storage::read(pool_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    let apy = pool.get_lp_apy();
    runtime::ret(CLValue::from_t(apy).unwrap_or_revert());
}

/// Update pool with trading fees (called by vault/settlement)
#[no_mangle]
pub extern "C" fn add_fees() {
    verify_authorized();

    let fee_amount: U512 = runtime::get_named_arg("fee_amount");

    let pool_uref = runtime::get_key(storage_keys::LP_POOL)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let mut pool: LiquidityPool = storage::read(pool_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    pool.total_fees_earned += fee_amount;
    pool.total_liquidity += fee_amount; // Fees increase pool value

    storage::write(pool_uref, pool);
}

/// Update pool with trader PnL (called by settlement)
#[no_mangle]
pub extern "C" fn update_trader_pnl() {
    verify_authorized();

    let pnl: i128 = runtime::get_named_arg("pnl");

    let pool_uref = runtime::get_key(storage_keys::LP_POOL)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let mut pool: LiquidityPool = storage::read(pool_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    pool.trader_pnl += pnl;

    // Update liquidity based on PnL
    if pnl >= 0 {
        // Traders won, pool lost
        let loss = U512::from(pnl.abs() as u128);
        if loss > pool.total_liquidity {
            pool.total_liquidity = U512::zero(); // Pool wiped
        } else {
            pool.total_liquidity -= loss;
        }
    } else {
        // Traders lost, pool won
        let gain = U512::from(pnl.abs() as u128);
        pool.total_liquidity += gain;
    }

    storage::write(pool_uref, pool);
}

/// Get LP information
#[no_mangle]
pub extern "C" fn get_lp_info() {
    let user: AccountHash = runtime::get_named_arg("user");
    let lp = get_or_create_lp(user);

    runtime::ret(CLValue::from_t(lp).unwrap_or_revert());
}

// Helper functions

fn get_or_create_lp(user: AccountHash) -> LiquidityProvider {
    let lp_key = format!("{}{:?}", storage_keys::LIQUIDITY_PROVIDERS_PREFIX, user);

    match runtime::get_key(&lp_key) {
        Some(key) => {
            let uref = key.into_uref().unwrap_or_revert();
            storage::read(uref).unwrap_or_revert().unwrap_or_revert()
        }
        None => LiquidityProvider {
            address: user,
            lp_tokens: U512::zero(),
            deposited_amount: U512::zero(),
            deposit_timestamp: runtime::get_blocktime(),
            fees_earned: U512::zero(),
            withdrawal_requests: alloc::vec::Vec::new(),
        },
    }
}

fn save_lp(user: AccountHash, lp: &LiquidityProvider) {
    let lp_key = format!("{}{:?}", storage_keys::LIQUIDITY_PROVIDERS_PREFIX, user);

    match runtime::get_key(&lp_key) {
        Some(key) => {
            let uref = key.into_uref().unwrap_or_revert();
            storage::write(uref, lp);
        }
        None => {
            runtime::put_key(&lp_key, storage::new_uref(lp).into());
        }
    }
}

fn verify_authorized() {
    // Allow vault, settlement, or admin
    let admin_uref = runtime::get_key(storage_keys::ADMIN)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let admin: Key = storage::read(admin_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    let caller = runtime::get_caller();
    if caller != admin.into_account().unwrap_or_revert() {
        // TODO: Check if caller is vault or settlement contract
    }
}

#[no_mangle]
pub extern "C" fn call() {
    let admin: Key = runtime::get_named_arg("admin");
    let vault_contract: Key = runtime::get_named_arg("vault_contract");

    let entry_points = casper_contract::contract_api::storage::create_contract_package_at_hash();

    runtime::put_key("liquidity_pool", entry_points.into());
}
