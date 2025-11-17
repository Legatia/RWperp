#![no_std]

extern crate alloc;

use alloc::string::String;
use casper_types::{account::AccountHash, U512};

/// Yield Farming / Liquidity Mining
/// Users stake LP tokens to earn RWP governance tokens

pub struct FarmingPool {
    pub pool_id: u8,
    pub name: String,
    pub staking_token: String,        // rwLP-CSPR, rwLP-USDC, etc.
    pub reward_token: String,         // RWP
    pub total_staked: U512,
    pub reward_per_second: U512,
    pub start_time: u64,
    pub end_time: u64,
    pub last_reward_time: u64,
    pub accumulated_reward_per_share: U512,
}

pub struct UserFarmingPosition {
    pub user: AccountHash,
    pub pool_id: u8,
    pub staked_amount: U512,
    pub reward_debt: U512,
    pub pending_rewards: U512,
    pub stake_timestamp: u64,
}

/// Multiple farming pools for different strategies
pub enum FarmingPoolType {
    /// Stake rwLP-CSPR tokens (LP tokens from providing liquidity)
    LiquidityProvider,

    /// Stake RWP tokens (governance token)
    GovernanceStaking,

    /// Stake position NFTs (keep positions open longer = more rewards)
    PositionStaking,

    /// Boosted pools (stake both LP + RWP for 2x rewards)
    BoostedLP,
}

impl FarmingPool {
    /// Calculate pending rewards for a user
    pub fn calculate_pending_rewards(&self, user_position: &UserFarmingPosition) -> U512 {
        if user_position.staked_amount == U512::zero() {
            return U512::zero();
        }

        let accumulated = self.accumulated_reward_per_share;
        let user_share = user_position.staked_amount * accumulated / U512::from(1e18 as u128);

        if user_share > user_position.reward_debt {
            user_share - user_position.reward_debt
        } else {
            U512::zero()
        }
    }

    /// Calculate APR for farming pool
    pub fn calculate_apr(&self) -> u64 {
        if self.total_staked == U512::zero() {
            return 0;
        }

        // APR = (rewards_per_year / total_staked) * 100
        let rewards_per_year = self.reward_per_second * U512::from(31_536_000u64); // seconds in year
        let apr = (rewards_per_year * U512::from(100)) / self.total_staked;

        apr.as_u64()
    }
}

/// Liquidity Mining Schedule
pub struct MiningSchedule {
    // Year 1: High rewards to bootstrap
    pub year_1_rewards_per_day: U512,  // 50,000 RWP/day

    // Year 2: Reduced
    pub year_2_rewards_per_day: U512,  // 25,000 RWP/day

    // Year 3: Further reduced
    pub year_3_rewards_per_day: U512,  // 12,500 RWP/day

    // Year 4+: Sustainable
    pub year_4_rewards_per_day: U512,  // 6,250 RWP/day
}

impl Default for MiningSchedule {
    fn default() -> Self {
        let decimals = U512::from(1_000_000_000u64);

        Self {
            year_1_rewards_per_day: U512::from(50_000u64) * decimals,
            year_2_rewards_per_day: U512::from(25_000u64) * decimals,
            year_3_rewards_per_day: U512::from(12_500u64) * decimals,
            year_4_rewards_per_day: U512::from(6_250u64) * decimals,
        }
    }
}

/// Boosted rewards system
pub struct BoostMultiplier {
    pub base_multiplier: u16,         // 100 = 1x
    pub rwp_stake_bonus: u16,         // +50 = 1.5x if you stake RWP too
    pub lock_time_bonus: u16,         // +25 = 1.75x for 6mo+ lock
    pub volume_bonus: u16,            // +25 = 2x for high traders
}

pub mod storage_keys {
    pub const FARMING_POOLS_PREFIX: &str = "farm_pool_";
    pub const USER_FARMING_PREFIX: &str = "user_farm_";
    pub const MINING_SCHEDULE: &str = "mining_schedule";
    pub const TOTAL_REWARDS_DISTRIBUTED: &str = "total_rewards_distributed";
}

pub mod errors {
    pub const INSUFFICIENT_STAKE: u16 = 701;
    pub const POOL_NOT_ACTIVE: u16 = 702;
    pub const REWARDS_EXHAUSTED: u16 = 703;
}
