#![no_std]

extern crate alloc;

use alloc::{string::String, vec::Vec};
use casper_contract::contract_api::runtime;
use casper_types::{U512, U256, Key, URef, account::AccountHash};

/// Represents a trading leader (signal provider)
#[derive(Clone)]
pub struct Leader {
    pub address: AccountHash,
    pub total_followers: u32,
    pub total_aum: U512,                // Assets under management
    pub performance_fee: u8,            // 10-20% of copier profits
    pub reputation_score: u64,          // 0-1000 score
    pub verified: bool,                 // Platform verified
    pub min_copy_amount: U512,          // Minimum to copy this leader
    pub max_copiers: u32,               // Maximum number of followers
    pub total_trades: u64,              // Lifetime trades
    pub winning_trades: u64,            // Profitable trades
    pub total_profit: i128,             // Net P&L in motes
    pub created_at: u64,                // Timestamp of registration
    pub last_trade_at: u64,             // Last trade timestamp
    pub bio: String,                    // Leader's bio
    pub strategy_description: String,   // Trading strategy description
}

/// Represents a copy trading relationship
#[derive(Clone)]
pub struct CopyRelationship {
    pub follower: AccountHash,
    pub leader: AccountHash,
    pub allocation_amount: U512,        // CSPR allocated to copy this leader
    pub allocation_percentage: u8,      // % of follower's total portfolio
    pub auto_rebalance: bool,           // Auto-adjust allocation
    pub risk_limits: RiskLimits,
    pub created_at: u64,
    pub total_profit: i128,             // Copier's P&L from this leader
    pub trades_copied: u64,             // Number of trades copied
    pub fees_paid: U512,                // Performance fees paid to leader
    pub is_active: bool,                // Currently copying or paused
    pub pause_reason: String,           // Why paused (if paused)
}

/// Risk management limits for copy trading
#[derive(Clone)]
pub struct RiskLimits {
    pub max_position_size: U512,        // Max collateral per trade
    pub max_leverage: u8,               // Override leader's leverage if higher
    pub stop_loss_percentage: u8,       // Auto-stop if down X%
    pub max_daily_trades: u32,          // Prevent overtrading
    pub allowed_markets: Vec<u64>,      // Empty = all markets allowed
    pub max_concurrent_positions: u32,  // Max open positions from this leader
}

/// A copied position (mirrors leader's position)
#[derive(Clone)]
pub struct CopiedPosition {
    pub position_id: String,            // Unique ID
    pub follower: AccountHash,
    pub leader: AccountHash,
    pub market_id: u64,
    pub is_long: bool,
    pub entry_price: U512,
    pub size: U512,
    pub collateral: U512,
    pub leverage: u8,
    pub liquidation_price: U512,
    pub opened_at: u64,
    pub closed_at: u64,                 // 0 if still open
    pub pnl: i128,                      // Realized P&L (if closed)
    pub leader_position_id: String,     // Reference to leader's original position
}

/// Leader statistics (calculated periodically)
#[derive(Clone)]
pub struct LeaderStats {
    pub address: AccountHash,

    // Performance metrics
    pub roi_7d: f64,
    pub roi_30d: f64,
    pub roi_90d: f64,
    pub roi_1y: f64,
    pub roi_all: f64,

    // Trading metrics
    pub win_rate: f64,                  // % of winning trades
    pub avg_win: U512,                  // Average winning trade
    pub avg_loss: U512,                 // Average losing trade
    pub profit_factor: f64,             // Gross profit / gross loss
    pub sharpe_ratio: f64,              // Risk-adjusted return
    pub max_drawdown: f64,              // Maximum % loss from peak
    pub max_drawdown_duration: u64,     // Days in drawdown

    // Risk metrics
    pub avg_leverage: f64,
    pub avg_position_duration: u64,     // Seconds
    pub risk_score: u8,                 // 1-10 (10 = highest risk)

    // Market preferences
    pub favorite_markets: Vec<u64>,     // Top 3 markets by volume
    pub long_short_ratio: f64,          // Ratio of long vs short positions

    // Recent activity
    pub trades_7d: u64,
    pub trades_30d: u64,
    pub volume_30d: U512,

    // Copier metrics
    pub follower_growth_30d: i32,       // Net follower change
    pub copier_profit_total: i128,      // Total profits of all copiers
    pub copier_profit_30d: i128,        // Copier profits last 30 days

    pub last_updated: u64,
}

/// Platform statistics
pub struct SocialTradingStats {
    pub total_leaders: u32,
    pub verified_leaders: u32,
    pub total_copiers: u32,
    pub total_copy_relationships: u32,
    pub total_aum: U512,                // Total assets under management
    pub total_copied_positions: u64,
    pub total_performance_fees: U512,
}

/// Events
pub enum SocialTradingEvent {
    LeaderRegistered {
        address: AccountHash,
        performance_fee: u8,
        min_copy_amount: U512,
    },
    LeaderVerified {
        address: AccountHash,
    },
    CopyStarted {
        follower: AccountHash,
        leader: AccountHash,
        amount: U512,
    },
    CopyStopped {
        follower: AccountHash,
        leader: AccountHash,
        reason: String,
    },
    PositionCopied {
        follower: AccountHash,
        leader: AccountHash,
        position_id: String,
        market_id: u64,
        size: U512,
    },
    PerformanceFeePaid {
        follower: AccountHash,
        leader: AccountHash,
        amount: U512,
    },
    CopyPaused {
        follower: AccountHash,
        leader: AccountHash,
        reason: String,
    },
    RiskLimitTriggered {
        follower: AccountHash,
        leader: AccountHash,
        limit_type: String,
    },
}

/// Error codes
pub mod errors {
    pub const INVALID_PERFORMANCE_FEE: u16 = 100;
    pub const INSUFFICIENT_TRADING_HISTORY: u16 = 101;
    pub const LEADER_NOT_FOUND: u16 = 102;
    pub const ALREADY_COPYING: u16 = 103;
    pub const NOT_COPYING: u16 = 104;
    pub const BELOW_MINIMUM_COPY_AMOUNT: u16 = 105;
    pub const LEADER_AT_CAPACITY: u16 = 106;
    pub const INVALID_ALLOCATION: u16 = 107;
    pub const INSUFFICIENT_BALANCE: u16 = 108;
    pub const POSITION_SIZE_EXCEEDED: u16 = 109;
    pub const LEVERAGE_EXCEEDED: u16 = 110;
    pub const DAILY_TRADE_LIMIT: u16 = 111;
    pub const MARKET_NOT_ALLOWED: u16 = 112;
    pub const MAX_POSITIONS_REACHED: u16 = 113;
    pub const STOP_LOSS_TRIGGERED: u16 = 114;
    pub const LEADER_IN_DRAWDOWN: u16 = 115;
    pub const UNAUTHORIZED: u16 = 116;
    pub const INVALID_RISK_LIMITS: u16 = 117;
    pub const COPIER_PROTECTION: u16 = 118;
}

impl Default for RiskLimits {
    fn default() -> Self {
        RiskLimits {
            max_position_size: U512::from(1_000_000_000_000u64), // 1000 CSPR
            max_leverage: 10,
            stop_loss_percentage: 20,
            max_daily_trades: 20,
            allowed_markets: Vec::new(), // Empty = all allowed
            max_concurrent_positions: 5,
        }
    }
}

impl Leader {
    pub fn new(
        address: AccountHash,
        performance_fee: u8,
        min_copy_amount: U512,
    ) -> Self {
        Leader {
            address,
            total_followers: 0,
            total_aum: U512::zero(),
            performance_fee,
            reputation_score: 500, // Start at middle
            verified: false,
            min_copy_amount,
            max_copiers: 1000,
            total_trades: 0,
            winning_trades: 0,
            total_profit: 0,
            created_at: runtime::get_blocktime().into(),
            last_trade_at: 0,
            bio: String::new(),
            strategy_description: String::new(),
        }
    }

    pub fn win_rate(&self) -> f64 {
        if self.total_trades == 0 {
            return 0.0;
        }
        (self.winning_trades as f64 / self.total_trades as f64) * 100.0
    }

    pub fn has_capacity(&self) -> bool {
        self.total_followers < self.max_copiers
    }
}

impl CopyRelationship {
    pub fn new(
        follower: AccountHash,
        leader: AccountHash,
        allocation_amount: U512,
        allocation_percentage: u8,
    ) -> Self {
        CopyRelationship {
            follower,
            leader,
            allocation_amount,
            allocation_percentage,
            auto_rebalance: true,
            risk_limits: RiskLimits::default(),
            created_at: runtime::get_blocktime().into(),
            total_profit: 0,
            trades_copied: 0,
            fees_paid: U512::zero(),
            is_active: true,
            pause_reason: String::new(),
        }
    }

    pub fn pause(&mut self, reason: String) {
        self.is_active = false;
        self.pause_reason = reason;
    }

    pub fn resume(&mut self) {
        self.is_active = true;
        self.pause_reason = String::new();
    }

    pub fn roi(&self) -> f64 {
        if self.allocation_amount == U512::zero() {
            return 0.0;
        }

        let profit_u512 = if self.total_profit >= 0 {
            U512::from(self.total_profit as u128)
        } else {
            U512::zero()
        };

        ((profit_u512.as_u128() as f64 / self.allocation_amount.as_u128() as f64) * 100.0)
    }
}

/// Helper functions for validation
pub fn validate_performance_fee(fee: u8) -> bool {
    fee >= 5 && fee <= 20  // 5-20% range
}

pub fn validate_allocation_percentage(pct: u8) -> bool {
    pct > 0 && pct <= 100
}

pub fn calculate_reputation_score(
    total_trades: u64,
    win_rate: f64,
    total_profit: i128,
    days_active: u64,
) -> u64 {
    let mut score: f64 = 0.0;

    // Win rate contribution (0-300 points)
    score += (win_rate / 100.0) * 300.0;

    // Profitability contribution (0-300 points)
    if total_profit > 0 {
        let profit_score = (total_profit as f64 / 10_000_000_000_000.0).min(300.0);
        score += profit_score;
    }

    // Experience contribution (0-300 points)
    let experience_score = (total_trades as f64).min(300.0);
    score += experience_score;

    // Longevity contribution (0-100 points)
    let longevity_score = ((days_active / 365) as f64 * 100.0).min(100.0);
    score += longevity_score;

    score.min(1000.0) as u64
}
