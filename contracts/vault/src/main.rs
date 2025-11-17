#![no_std]
#![no_main]

extern crate alloc;

use alloc::format;
use casper_contract::{
    contract_api::{runtime, storage, system},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{account::AccountHash, runtime_args, Key, RuntimeArgs, U512, CLValue};

use vault::{errors, storage_keys, CollateralType, InsuranceFund, UserAccount};

/// Initialize the vault contract
#[no_mangle]
pub extern "C" fn init() {
    let admin: Key = runtime::get_named_arg("admin");
    let position_manager: Key = runtime::get_named_arg("position_manager");
    let settlement_contract: Key = runtime::get_named_arg("settlement_contract");
    let stablecoin_contract: Key = runtime::get_named_arg("stablecoin_contract");

    runtime::put_key(storage_keys::ADMIN, storage::new_uref(admin).into());
    runtime::put_key(storage_keys::POSITION_MANAGER, storage::new_uref(position_manager).into());
    runtime::put_key(storage_keys::SETTLEMENT_CONTRACT, storage::new_uref(settlement_contract).into());
    runtime::put_key(storage_keys::STABLECOIN_CONTRACT, storage::new_uref(stablecoin_contract).into());
    runtime::put_key(storage_keys::PAUSED, storage::new_uref(false).into());

    runtime::put_key(storage_keys::TOTAL_CSPR_DEPOSITED, storage::new_uref(U512::zero()).into());
    runtime::put_key(storage_keys::TOTAL_STABLECOIN_DEPOSITED, storage::new_uref(U512::zero()).into());

    let insurance_fund = InsuranceFund::default();
    runtime::put_key(storage_keys::INSURANCE_FUND, storage::new_uref(insurance_fund).into());
}

/// Deposit CSPR into the vault
#[no_mangle]
pub extern "C" fn deposit_cspr() {
    check_not_paused();

    let amount: U512 = runtime::get_named_arg("amount");
    let user = runtime::get_caller();

    if amount == U512::zero() {
        runtime::revert(errors::INVALID_AMOUNT);
    }

    // Transfer CSPR from user to contract
    // TODO: Implement actual CSPR transfer using system contract
    // system::transfer_from_purse_to_purse(user_purse, contract_purse, amount, None)
    //     .unwrap_or_revert_with(errors::TRANSFER_FAILED);

    // Get or create user account
    let mut user_account = get_or_create_user_account(user);

    // Update balances
    user_account.cspr_balance += amount;
    user_account.total_deposited += amount;

    // Store updated account
    save_user_account(user, &user_account);

    // Update total deposited
    update_total_deposited(CollateralType::CSPR, amount);

    runtime::ret(CLValue::from_t(user_account.cspr_balance).unwrap_or_revert());
}

/// Deposit stablecoin into the vault
#[no_mangle]
pub extern "C" fn deposit_stablecoin() {
    check_not_paused();

    let amount: U512 = runtime::get_named_arg("amount");
    let user = runtime::get_caller();

    if amount == U512::zero() {
        runtime::revert(errors::INVALID_AMOUNT);
    }

    // TODO: Transfer stablecoin from user using ERC20-like contract
    // Call stablecoin contract's transfer_from function

    // Get or create user account
    let mut user_account = get_or_create_user_account(user);

    // Update balances
    user_account.stablecoin_balance += amount;
    user_account.total_deposited += amount;

    // Store updated account
    save_user_account(user, &user_account);

    // Update total deposited
    update_total_deposited(CollateralType::Stablecoin, amount);

    runtime::ret(CLValue::from_t(user_account.stablecoin_balance).unwrap_or_revert());
}

/// Withdraw CSPR from the vault
#[no_mangle]
pub extern "C" fn withdraw_cspr() {
    check_not_paused();

    let amount: U512 = runtime::get_named_arg("amount");
    let user = runtime::get_caller();

    if amount == U512::zero() {
        runtime::revert(errors::INVALID_AMOUNT);
    }

    // Get user account
    let mut user_account = get_or_create_user_account(user);

    // Calculate available balance (total - locked)
    let available = user_account.cspr_balance - user_account.locked_collateral;

    if amount > available {
        runtime::revert(errors::INSUFFICIENT_BALANCE);
    }

    // Update balances
    user_account.cspr_balance -= amount;
    user_account.total_withdrawn += amount;

    // Store updated account
    save_user_account(user, &user_account);

    // TODO: Transfer CSPR to user
    // system::transfer_from_purse_to_purse(contract_purse, user_purse, amount, None)
    //     .unwrap_or_revert_with(errors::TRANSFER_FAILED);

    runtime::ret(CLValue::from_t(user_account.cspr_balance).unwrap_or_revert());
}

/// Lock collateral for a position (called by position manager)
#[no_mangle]
pub extern "C" fn lock_collateral() {
    verify_position_manager();

    let user: AccountHash = runtime::get_named_arg("user");
    let amount: U512 = runtime::get_named_arg("amount");
    let collateral_type_u8: u8 = runtime::get_named_arg("collateral_type");

    let collateral_type = match collateral_type_u8 {
        0 => CollateralType::CSPR,
        1 => CollateralType::Stablecoin,
        _ => runtime::revert(errors::INVALID_AMOUNT),
    };

    let mut user_account = get_or_create_user_account(user);

    // Check sufficient balance
    let balance = match collateral_type {
        CollateralType::CSPR => user_account.cspr_balance,
        CollateralType::Stablecoin => user_account.stablecoin_balance,
    };

    if amount > balance - user_account.locked_collateral {
        runtime::revert(errors::INSUFFICIENT_BALANCE);
    }

    // Lock collateral
    user_account.locked_collateral += amount;

    save_user_account(user, &user_account);

    runtime::ret(CLValue::from_t(true).unwrap_or_revert());
}

/// Unlock collateral and apply PnL (called by settlement contract)
#[no_mangle]
pub extern "C" fn unlock_and_settle() {
    verify_settlement_contract();

    let user: AccountHash = runtime::get_named_arg("user");
    let locked_amount: U512 = runtime::get_named_arg("locked_amount");
    let pnl_amount: U512 = runtime::get_named_arg("pnl_amount");
    let is_profit: bool = runtime::get_named_arg("is_profit");
    let collateral_type_u8: u8 = runtime::get_named_arg("collateral_type");

    let collateral_type = match collateral_type_u8 {
        0 => CollateralType::CSPR,
        1 => CollateralType::Stablecoin,
        _ => runtime::revert(errors::INVALID_AMOUNT),
    };

    let mut user_account = get_or_create_user_account(user);

    // Unlock collateral
    if locked_amount > user_account.locked_collateral {
        runtime::revert(errors::INSUFFICIENT_LOCKED_COLLATERAL);
    }
    user_account.locked_collateral -= locked_amount;

    // Apply PnL
    if is_profit {
        // Add profit
        match collateral_type {
            CollateralType::CSPR => user_account.cspr_balance += pnl_amount,
            CollateralType::Stablecoin => user_account.stablecoin_balance += pnl_amount,
        }
        user_account.realized_pnl += pnl_amount.as_u128() as i128;
    } else {
        // Deduct loss
        match collateral_type {
            CollateralType::CSPR => {
                if pnl_amount > user_account.cspr_balance {
                    // Underwater - insurance fund covers
                    user_account.cspr_balance = U512::zero();
                } else {
                    user_account.cspr_balance -= pnl_amount;
                }
            }
            CollateralType::Stablecoin => {
                if pnl_amount > user_account.stablecoin_balance {
                    user_account.stablecoin_balance = U512::zero();
                } else {
                    user_account.stablecoin_balance -= pnl_amount;
                }
            }
        }
        user_account.realized_pnl -= pnl_amount.as_u128() as i128;
    }

    save_user_account(user, &user_account);

    runtime::ret(CLValue::from_t(true).unwrap_or_revert());
}

/// Get user account balance
#[no_mangle]
pub extern "C" fn get_balance() {
    let user: AccountHash = runtime::get_named_arg("user");
    let user_account = get_or_create_user_account(user);

    runtime::ret(CLValue::from_t(user_account).unwrap_or_revert());
}

/// Add funds to insurance fund (from fees)
#[no_mangle]
pub extern "C" fn add_to_insurance_fund() {
    verify_authorized();

    let amount: U512 = runtime::get_named_arg("amount");
    let collateral_type_u8: u8 = runtime::get_named_arg("collateral_type");

    let insurance_fund_uref = runtime::get_key(storage_keys::INSURANCE_FUND)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let mut insurance_fund: InsuranceFund = storage::read(insurance_fund_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    match collateral_type_u8 {
        0 => insurance_fund.cspr_balance += amount,
        1 => insurance_fund.stablecoin_balance += amount,
        _ => runtime::revert(errors::INVALID_AMOUNT),
    }

    storage::write(insurance_fund_uref, insurance_fund);
}

/// Emergency pause (admin only)
#[no_mangle]
pub extern "C" fn pause() {
    verify_admin();

    let paused_uref = runtime::get_key(storage_keys::PAUSED)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    storage::write(paused_uref, true);
}

/// Unpause (admin only)
#[no_mangle]
pub extern "C" fn unpause() {
    verify_admin();

    let paused_uref = runtime::get_key(storage_keys::PAUSED)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    storage::write(paused_uref, false);
}

// Helper functions

fn get_or_create_user_account(user: AccountHash) -> UserAccount {
    let account_key = format!("{}{:?}", storage_keys::USER_ACCOUNT_PREFIX, user);

    match runtime::get_key(&account_key) {
        Some(key) => {
            let uref = key.into_uref().unwrap_or_revert();
            storage::read(uref).unwrap_or_revert().unwrap_or_revert()
        }
        None => UserAccount {
            user,
            cspr_balance: U512::zero(),
            stablecoin_balance: U512::zero(),
            locked_collateral: U512::zero(),
            total_deposited: U512::zero(),
            total_withdrawn: U512::zero(),
            realized_pnl: 0,
        },
    }
}

fn save_user_account(user: AccountHash, account: &UserAccount) {
    let account_key = format!("{}{:?}", storage_keys::USER_ACCOUNT_PREFIX, user);

    match runtime::get_key(&account_key) {
        Some(key) => {
            let uref = key.into_uref().unwrap_or_revert();
            storage::write(uref, account);
        }
        None => {
            runtime::put_key(&account_key, storage::new_uref(account).into());
        }
    }
}

fn update_total_deposited(collateral_type: CollateralType, amount: U512) {
    let key = match collateral_type {
        CollateralType::CSPR => storage_keys::TOTAL_CSPR_DEPOSITED,
        CollateralType::Stablecoin => storage_keys::TOTAL_STABLECOIN_DEPOSITED,
    };

    let uref = runtime::get_key(key)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let current: U512 = storage::read(uref).unwrap_or_revert().unwrap_or_revert();
    storage::write(uref, current + amount);
}

fn check_not_paused() {
    let paused_uref = runtime::get_key(storage_keys::PAUSED)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let paused: bool = storage::read(paused_uref).unwrap_or_revert().unwrap_or_revert();

    if paused {
        runtime::revert(errors::VAULT_PAUSED);
    }
}

fn verify_admin() {
    let admin_uref = runtime::get_key(storage_keys::ADMIN)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let admin: Key = storage::read(admin_uref).unwrap_or_revert().unwrap_or_revert();

    if runtime::get_caller() != admin.into_account().unwrap_or_revert() {
        runtime::revert(errors::UNAUTHORIZED);
    }
}

fn verify_position_manager() {
    let pm_uref = runtime::get_key(storage_keys::POSITION_MANAGER)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let position_manager: Key = storage::read(pm_uref).unwrap_or_revert().unwrap_or_revert();

    if runtime::get_caller() != position_manager.into_account().unwrap_or_revert() {
        runtime::revert(errors::UNAUTHORIZED);
    }
}

fn verify_settlement_contract() {
    let sc_uref = runtime::get_key(storage_keys::SETTLEMENT_CONTRACT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let settlement_contract: Key = storage::read(sc_uref).unwrap_or_revert().unwrap_or_revert();

    if runtime::get_caller() != settlement_contract.into_account().unwrap_or_revert() {
        runtime::revert(errors::UNAUTHORIZED);
    }
}

fn verify_authorized() {
    // Allow admin, position_manager, or settlement_contract
    let caller = runtime::get_caller();

    let admin_uref = runtime::get_key(storage_keys::ADMIN).unwrap_or_revert().into_uref().unwrap_or_revert();
    let admin: Key = storage::read(admin_uref).unwrap_or_revert().unwrap_or_revert();

    let pm_uref = runtime::get_key(storage_keys::POSITION_MANAGER).unwrap_or_revert().into_uref().unwrap_or_revert();
    let pm: Key = storage::read(pm_uref).unwrap_or_revert().unwrap_or_revert();

    let sc_uref = runtime::get_key(storage_keys::SETTLEMENT_CONTRACT).unwrap_or_revert().into_uref().unwrap_or_revert();
    let sc: Key = storage::read(sc_uref).unwrap_or_revert().unwrap_or_revert();

    if caller != admin.into_account().unwrap_or_revert()
       && caller != pm.into_account().unwrap_or_revert()
       && caller != sc.into_account().unwrap_or_revert() {
        runtime::revert(errors::UNAUTHORIZED);
    }
}

#[no_mangle]
pub extern "C" fn call() {
    // Contract installation
    let admin: Key = runtime::get_named_arg("admin");
    let position_manager: Key = runtime::get_named_arg("position_manager");
    let settlement_contract: Key = runtime::get_named_arg("settlement_contract");
    let stablecoin_contract: Key = runtime::get_named_arg("stablecoin_contract");

    let entry_points = casper_contract::contract_api::storage::create_contract_package_at_hash();

    runtime::put_key("vault", entry_points.into());
}
