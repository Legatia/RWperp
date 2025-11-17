#![no_std]

extern crate alloc;

use alloc::string::String;
use alloc::vec::Vec;
use casper_types::{account::AccountHash, U256, U512};

/// RWP Governance Token
/// - Vote on protocol changes
/// - Stake for revenue share
/// - Create new markets
/// - Adjust parameters

pub struct GovernanceToken {
    pub total_supply: U512,           // 100M RWP tokens
    pub circulating_supply: U512,
    pub staked_supply: U512,
}

pub struct Proposal {
    pub id: u64,
    pub proposer: AccountHash,
    pub title: String,
    pub description: String,
    pub proposal_type: ProposalType,
    pub votes_for: U512,
    pub votes_against: U512,
    pub start_time: u64,
    pub end_time: u64,
    pub executed: bool,
    pub quorum_required: U512,        // Min votes needed
}

#[repr(u8)]
#[derive(Clone, Copy)]
pub enum ProposalType {
    AddMarket = 0,                    // Add new RWA market
    UpdateFees = 1,                   // Change trading fees
    UpdateLeverage = 2,               // Change max leverage
    UpdateOracle = 3,                 // Add/remove oracle validators
    Treasury = 4,                     // Treasury management
    Emergency = 5,                    // Emergency actions
}

pub struct StakedPosition {
    pub user: AccountHash,
    pub staked_amount: U512,
    pub stake_timestamp: u64,
    pub lock_period: u64,             // Lock for higher rewards
    pub rewards_earned: U512,
    pub voting_power: U512,           // Staked amount * time multiplier
}

/// Token distribution
pub struct TokenDistribution {
    // Fair launch distribution
    pub liquidity_mining: U512,       // 40% - 40M tokens
    pub team: U512,                   // 15% - 15M tokens (4yr vest)
    pub treasury: U512,               // 20% - 20M tokens
    pub early_lps: U512,              // 15% - 15M tokens (6mo vest)
    pub community: U512,              // 10% - 10M tokens (airdrops)
}

impl Default for TokenDistribution {
    fn default() -> Self {
        let total = U512::from(100_000_000u64) * U512::from(1_000_000_000u64); // 100M with 9 decimals

        Self {
            liquidity_mining: total * U512::from(40) / U512::from(100),
            team: total * U512::from(15) / U512::from(100),
            treasury: total * U512::from(20) / U512::from(100),
            early_lps: total * U512::from(15) / U512::from(100),
            community: total * U512::from(10) / U512::from(100),
        }
    }
}

/// Voting power calculation
impl StakedPosition {
    pub fn calculate_voting_power(&self) -> U512 {
        let base_power = self.staked_amount;

        // Time multiplier: longer lock = more voting power
        let multiplier = match self.lock_period {
            0..=86400 => 100,           // 1 day = 1x
            86401..=604800 => 125,      // 1 week = 1.25x
            604801..=2592000 => 150,    // 1 month = 1.5x
            2592001..=7776000 => 200,   // 3 months = 2x
            7776001..=15552000 => 250,  // 6 months = 2.5x
            _ => 300,                   // 1 year = 3x
        };

        base_power * U512::from(multiplier) / U512::from(100)
    }
}

pub mod storage_keys {
    pub const GOVERNANCE_TOKEN: &str = "rwp_token";
    pub const PROPOSALS_PREFIX: &str = "proposal_";
    pub const STAKED_POSITIONS_PREFIX: &str = "staked_";
    pub const TREASURY: &str = "treasury";
    pub const VOTING_DELAY: &str = "voting_delay";
    pub const VOTING_PERIOD: &str = "voting_period";
}

pub mod errors {
    pub const INSUFFICIENT_VOTING_POWER: u16 = 601;
    pub const PROPOSAL_NOT_ACTIVE: u16 = 602;
    pub const QUORUM_NOT_REACHED: u16 = 603;
    pub const ALREADY_VOTED: u16 = 604;
    pub const TOKENS_LOCKED: u16 = 605;
}
