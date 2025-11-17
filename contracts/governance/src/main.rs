#![no_std]
#![no_main]

extern crate alloc;

use alloc::{format, string::String};
use casper_contract::{
    contract_api::{runtime, storage},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{account::AccountHash, Key, U512, CLValue};

use governance::{errors, storage_keys, GovernanceToken, Proposal, ProposalType, StakedPosition, TokenDistribution};

/// Initialize governance contract
#[no_mangle]
pub extern "C" fn init() {
    let admin: Key = runtime::get_named_arg("admin");

    runtime::put_key(storage_keys::ADMIN, storage::new_uref(admin).into());

    // Initialize token with distribution
    let distribution = TokenDistribution::default();
    let total_supply = distribution.liquidity_mining
        + distribution.team
        + distribution.treasury
        + distribution.early_lps
        + distribution.community;

    let token = GovernanceToken {
        total_supply,
        circulating_supply: U512::zero(), // Vested over time
        staked_supply: U512::zero(),
    };

    runtime::put_key(storage_keys::GOVERNANCE_TOKEN, storage::new_uref(token).into());
    runtime::put_key(storage_keys::TREASURY, storage::new_uref(distribution.treasury).into());

    // Voting parameters
    runtime::put_key(storage_keys::VOTING_DELAY, storage::new_uref(259200u64).into()); // 3 days
    runtime::put_key(storage_keys::VOTING_PERIOD, storage::new_uref(604800u64).into()); // 7 days
}

/// Stake RWP tokens for voting power
#[no_mangle]
pub extern "C" fn stake() {
    let amount: U512 = runtime::get_named_arg("amount");
    let lock_period: u64 = runtime::get_named_arg("lock_period"); // seconds
    let user = runtime::get_caller();

    if amount == U512::zero() {
        runtime::revert(errors::INSUFFICIENT_VOTING_POWER);
    }

    // Get or create staked position
    let position_key = format!("{}{:?}", storage_keys::STAKED_POSITIONS_PREFIX, user);
    let mut position = match runtime::get_key(&position_key) {
        Some(key) => {
            let uref = key.into_uref().unwrap_or_revert();
            storage::read::<StakedPosition>(uref).unwrap_or_revert().unwrap_or_revert()
        }
        None => StakedPosition {
            user,
            staked_amount: U512::zero(),
            stake_timestamp: runtime::get_blocktime(),
            lock_period,
            rewards_earned: U512::zero(),
            voting_power: U512::zero(),
        },
    };

    // Update position
    position.staked_amount += amount;
    position.lock_period = lock_period;
    position.stake_timestamp = runtime::get_blocktime();
    position.voting_power = position.calculate_voting_power();

    // Save position
    match runtime::get_key(&position_key) {
        Some(key) => {
            let uref = key.into_uref().unwrap_or_revert();
            storage::write(uref, position);
        }
        None => {
            runtime::put_key(&position_key, storage::new_uref(position).into());
        }
    }

    // Update total staked
    let token_uref = runtime::get_key(storage_keys::GOVERNANCE_TOKEN)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let mut token: GovernanceToken = storage::read(token_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();
    token.staked_supply += amount;
    storage::write(token_uref, token);

    runtime::ret(CLValue::from_t(position.voting_power).unwrap_or_revert());
}

/// Unstake RWP tokens (after lock period)
#[no_mangle]
pub extern "C" fn unstake() {
    let amount: U512 = runtime::get_named_arg("amount");
    let user = runtime::get_caller();

    let position_key = format!("{}{:?}", storage_keys::STAKED_POSITIONS_PREFIX, user);
    let position_uref = runtime::get_key(&position_key)
        .unwrap_or_revert_with(errors::INSUFFICIENT_VOTING_POWER)
        .into_uref()
        .unwrap_or_revert();

    let mut position: StakedPosition = storage::read(position_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    // Check lock period
    let current_time = runtime::get_blocktime();
    if current_time < position.stake_timestamp + position.lock_period {
        runtime::revert(errors::TOKENS_LOCKED);
    }

    if amount > position.staked_amount {
        runtime::revert(errors::INSUFFICIENT_VOTING_POWER);
    }

    // Update position
    position.staked_amount -= amount;
    position.voting_power = position.calculate_voting_power();
    storage::write(position_uref, position);

    // Update total staked
    let token_uref = runtime::get_key(storage_keys::GOVERNANCE_TOKEN)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let mut token: GovernanceToken = storage::read(token_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();
    token.staked_supply -= amount;
    storage::write(token_uref, token);

    runtime::ret(CLValue::from_t(amount).unwrap_or_revert());
}

/// Create a governance proposal
#[no_mangle]
pub extern "C" fn create_proposal() {
    let title: String = runtime::get_named_arg("title");
    let description: String = runtime::get_named_arg("description");
    let proposal_type_u8: u8 = runtime::get_named_arg("proposal_type");
    let user = runtime::get_caller();

    // Check voting power (need min 10,000 RWP staked)
    let position_key = format!("{}{:?}", storage_keys::STAKED_POSITIONS_PREFIX, user);
    let position_uref = runtime::get_key(&position_key)
        .unwrap_or_revert_with(errors::INSUFFICIENT_VOTING_POWER)
        .into_uref()
        .unwrap_or_revert();

    let position: StakedPosition = storage::read(position_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    let min_stake = U512::from(10_000u64) * U512::from(1_000_000_000u64); // 10k RWP
    if position.voting_power < min_stake {
        runtime::revert(errors::INSUFFICIENT_VOTING_POWER);
    }

    // Get voting parameters
    let voting_delay_uref = runtime::get_key(storage_keys::VOTING_DELAY)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let voting_delay: u64 = storage::read(voting_delay_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    let voting_period_uref = runtime::get_key(storage_keys::VOTING_PERIOD)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let voting_period: u64 = storage::read(voting_period_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    // Get token for quorum calculation
    let token_uref = runtime::get_key(storage_keys::GOVERNANCE_TOKEN)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();
    let token: GovernanceToken = storage::read(token_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    // Create proposal
    let proposal_id = get_next_proposal_id();
    let current_time = runtime::get_blocktime();

    let proposal_type = match proposal_type_u8 {
        0 => ProposalType::AddMarket,
        1 => ProposalType::UpdateFees,
        2 => ProposalType::UpdateLeverage,
        3 => ProposalType::UpdateOracle,
        4 => ProposalType::Treasury,
        5 => ProposalType::Emergency,
        _ => runtime::revert(errors::INSUFFICIENT_VOTING_POWER),
    };

    let proposal = Proposal {
        id: proposal_id,
        proposer: user,
        title,
        description,
        proposal_type,
        votes_for: U512::zero(),
        votes_against: U512::zero(),
        start_time: current_time + voting_delay,
        end_time: current_time + voting_delay + voting_period,
        executed: false,
        quorum_required: token.total_supply / U512::from(10), // 10% quorum
    };

    // Store proposal
    let proposal_key = format!("{}{}", storage_keys::PROPOSALS_PREFIX, proposal_id);
    runtime::put_key(&proposal_key, storage::new_uref(proposal).into());

    runtime::ret(CLValue::from_t(proposal_id).unwrap_or_revert());
}

/// Vote on a proposal
#[no_mangle]
pub extern "C" fn vote() {
    let proposal_id: u64 = runtime::get_named_arg("proposal_id");
    let support: bool = runtime::get_named_arg("support"); // true = for, false = against
    let user = runtime::get_caller();

    // Get proposal
    let proposal_key = format!("{}{}", storage_keys::PROPOSALS_PREFIX, proposal_id);
    let proposal_uref = runtime::get_key(&proposal_key)
        .unwrap_or_revert_with(errors::PROPOSAL_NOT_ACTIVE)
        .into_uref()
        .unwrap_or_revert();

    let mut proposal: Proposal = storage::read(proposal_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    // Check if proposal is active
    let current_time = runtime::get_blocktime();
    if current_time < proposal.start_time || current_time > proposal.end_time {
        runtime::revert(errors::PROPOSAL_NOT_ACTIVE);
    }

    // Get user's voting power
    let position_key = format!("{}{:?}", storage_keys::STAKED_POSITIONS_PREFIX, user);
    let position_uref = runtime::get_key(&position_key)
        .unwrap_or_revert_with(errors::INSUFFICIENT_VOTING_POWER)
        .into_uref()
        .unwrap_or_revert();

    let position: StakedPosition = storage::read(position_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    // TODO: Check if already voted (use mapping)

    // Add vote
    if support {
        proposal.votes_for += position.voting_power;
    } else {
        proposal.votes_against += position.voting_power;
    }

    storage::write(proposal_uref, proposal);

    runtime::ret(CLValue::from_t(true).unwrap_or_revert());
}

/// Execute a proposal (if passed)
#[no_mangle]
pub extern "C" fn execute_proposal() {
    let proposal_id: u64 = runtime::get_named_arg("proposal_id");

    let proposal_key = format!("{}{}", storage_keys::PROPOSALS_PREFIX, proposal_id);
    let proposal_uref = runtime::get_key(&proposal_key)
        .unwrap_or_revert_with(errors::PROPOSAL_NOT_ACTIVE)
        .into_uref()
        .unwrap_or_revert();

    let mut proposal: Proposal = storage::read(proposal_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    // Check if voting period ended
    let current_time = runtime::get_blocktime();
    if current_time <= proposal.end_time {
        runtime::revert(errors::PROPOSAL_NOT_ACTIVE);
    }

    // Check if already executed
    if proposal.executed {
        runtime::revert(errors::PROPOSAL_NOT_ACTIVE);
    }

    // Check if passed (quorum met + more for than against)
    let total_votes = proposal.votes_for + proposal.votes_against;
    if total_votes < proposal.quorum_required {
        runtime::revert(errors::QUORUM_NOT_REACHED);
    }

    if proposal.votes_for <= proposal.votes_against {
        runtime::revert(errors::QUORUM_NOT_REACHED);
    }

    // Mark as executed
    proposal.executed = true;
    storage::write(proposal_uref, proposal);

    // TODO: Execute the actual proposal action based on proposal_type

    runtime::ret(CLValue::from_t(true).unwrap_or_revert());
}

/// Get proposal details
#[no_mangle]
pub extern "C" fn get_proposal() {
    let proposal_id: u64 = runtime::get_named_arg("proposal_id");

    let proposal_key = format!("{}{}", storage_keys::PROPOSALS_PREFIX, proposal_id);
    let proposal_uref = runtime::get_key(&proposal_key)
        .unwrap_or_revert_with(errors::PROPOSAL_NOT_ACTIVE)
        .into_uref()
        .unwrap_or_revert();

    let proposal: Proposal = storage::read(proposal_uref)
        .unwrap_or_revert()
        .unwrap_or_revert();

    runtime::ret(CLValue::from_t(proposal).unwrap_or_revert());
}

// Helper functions

fn get_next_proposal_id() -> u64 {
    // Simple counter implementation
    let key = "proposal_counter";
    match runtime::get_key(key) {
        Some(k) => {
            let uref = k.into_uref().unwrap_or_revert();
            let current: u64 = storage::read(uref).unwrap_or_revert().unwrap_or_revert();
            storage::write(uref, current + 1);
            current
        }
        None => {
            runtime::put_key(key, storage::new_uref(1u64).into());
            0
        }
    }
}

#[no_mangle]
pub extern "C" fn call() {
    let admin: Key = runtime::get_named_arg("admin");

    let entry_points = casper_contract::contract_api::storage::create_contract_package_at_hash();

    runtime::put_key("governance", entry_points.into());
}
