const logger = require('../utils/logger');
const { queryContractState, queryContractDictionary, getCasperClient } = require('./casper-client');

/**
 * Get all registered leaders
 */
async function getAllLeaders() {
  try {
    const socialTradingHash = process.env.SOCIAL_TRADING_CONTRACT_HASH;

    if (!socialTradingHash || socialTradingHash === 'hash-xxxxx') {
      logger.warn('Social trading contract not deployed, returning mock data');
      return getMockLeaders();
    }

    // In production, query the leaders dictionary
    // For now, return mock data
    return getMockLeaders();
  } catch (error) {
    logger.error('Error fetching all leaders:', error);
    return getMockLeaders();
  }
}

/**
 * Get specific leader by address
 */
async function getLeader(address) {
  try {
    const socialTradingHash = process.env.SOCIAL_TRADING_CONTRACT_HASH;

    if (!socialTradingHash || socialTradingHash === 'hash-xxxxx') {
      const leaders = getMockLeaders();
      return leaders.find(l => l.address === address);
    }

    const leaderData = await queryContractDictionary(
      socialTradingHash,
      'leaders',
      address
    );

    return leaderData;
  } catch (error) {
    logger.error(`Error fetching leader ${address}:`, error);
    return null;
  }
}

/**
 * Get leader's followers
 */
async function getLeaderFollowers(leaderAddress) {
  try {
    const socialTradingHash = process.env.SOCIAL_TRADING_CONTRACT_HASH;

    if (!socialTradingHash || socialTradingHash === 'hash-xxxxx') {
      return [];
    }

    const followers = await queryContractDictionary(
      socialTradingHash,
      'leader_followers',
      leaderAddress
    );

    return followers || [];
  } catch (error) {
    logger.error(`Error fetching followers for ${leaderAddress}:`, error);
    return [];
  }
}

/**
 * Get user's copy relationships
 */
async function getUserCopyRelationships(userAddress) {
  try {
    const socialTradingHash = process.env.SOCIAL_TRADING_CONTRACT_HASH;

    if (!socialTradingHash || socialTradingHash === 'hash-xxxxx') {
      return getMockCopyRelationships(userAddress);
    }

    // Get list of leaders user is copying
    const followingLeaders = await queryContractDictionary(
      socialTradingHash,
      'follower_leaders',
      userAddress
    );

    if (!followingLeaders || followingLeaders.length === 0) {
      return [];
    }

    // Fetch each copy relationship
    const relationships = [];
    for (const leaderAddress of followingLeaders) {
      const relationshipKey = `${userAddress}_${leaderAddress}`;
      const relationship = await queryContractDictionary(
        socialTradingHash,
        'copy_relationships',
        relationshipKey
      );

      if (relationship) {
        relationships.push(relationship);
      }
    }

    return relationships;
  } catch (error) {
    logger.error(`Error fetching copy relationships for ${userAddress}:`, error);
    return getMockCopyRelationships(userAddress);
  }
}

/**
 * Get copied positions for a follower from specific leader
 */
async function getCopiedPositions(followerAddress, leaderAddress) {
  try {
    const socialTradingHash = process.env.SOCIAL_TRADING_CONTRACT_HASH;

    if (!socialTradingHash || socialTradingHash === 'hash-xxxxx') {
      return [];
    }

    // In production, query copied_positions dictionary filtered by follower and leader
    // For now, return empty array
    return [];
  } catch (error) {
    logger.error(`Error fetching copied positions for ${followerAddress} from ${leaderAddress}:`, error);
    return [];
  }
}

/**
 * Get leader statistics for timeframe
 */
async function getLeaderStats(leaderAddress, timeframe = '30d') {
  try {
    const socialTradingHash = process.env.SOCIAL_TRADING_CONTRACT_HASH;

    if (!socialTradingHash || socialTradingHash === 'hash-xxxxx') {
      return getMockLeaderStats(leaderAddress, timeframe);
    }

    const stats = await queryContractDictionary(
      socialTradingHash,
      'leader_stats',
      leaderAddress
    );

    return stats || getMockLeaderStats(leaderAddress, timeframe);
  } catch (error) {
    logger.error(`Error fetching stats for ${leaderAddress}:`, error);
    return getMockLeaderStats(leaderAddress, timeframe);
  }
}

// ===== Mock Data for Development =====

function getMockLeaders() {
  return [
    {
      address: 'account-hash-leader1000000000000000000000000000000000000000000000000000000',
      total_followers: 245,
      total_aum: '125000000000000', // 125k CSPR
      performance_fee: 15,
      reputation_score: 850,
      verified: true,
      min_copy_amount: '10000000000', // 10 CSPR
      max_copiers: 1000,
      total_trades: 387,
      winning_trades: 268,
      total_profit: 45000000000000, // 45k CSPR profit
      created_at: Math.floor(Date.now() / 1000) - (180 * 86400), // 180 days ago
      last_trade_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      bio: 'Commodity specialist with 10+ years experience. Focus on gold and oil markets with conservative risk management.',
      strategy_description: 'Trend-following strategy using moving averages and momentum indicators. Typically holds positions 3-7 days.'
    },
    {
      address: 'account-hash-leader2000000000000000000000000000000000000000000000000000000',
      total_followers: 412,
      total_aum: '285000000000000', // 285k CSPR
      performance_fee: 12,
      reputation_score: 920,
      verified: true,
      min_copy_amount: '20000000000', // 20 CSPR
      max_copiers: 1000,
      total_trades: 892,
      winning_trades: 623,
      total_profit: 98000000000000, // 98k CSPR profit
      created_at: Math.floor(Date.now() / 1000) - (365 * 86400), // 1 year ago
      last_trade_at: Math.floor(Date.now() / 1000) - 7200,
      bio: 'Professional day trader specializing in stock index futures. High volume, high accuracy.',
      strategy_description: 'Scalping and day trading S&P500 and Nasdaq. Multiple trades daily with tight stop-losses.'
    },
    {
      address: 'account-hash-leader3000000000000000000000000000000000000000000000000000000',
      total_followers: 89,
      total_aum: '42000000000000', // 42k CSPR
      performance_fee: 20,
      reputation_score: 720,
      verified: false,
      min_copy_amount: '5000000000', // 5 CSPR
      max_copiers: 1000,
      total_trades: 156,
      winning_trades: 112,
      total_profit: 28000000000000, // 28k CSPR profit
      created_at: Math.floor(Date.now() / 1000) - (60 * 86400), // 60 days ago
      last_trade_at: Math.floor(Date.now() / 1000) - 14400,
      bio: 'Aggressive trader seeking high returns. Not for the faint of heart!',
      strategy_description: 'High leverage momentum trading. Looking for 20%+ moves in 1-3 days.'
    },
    {
      address: 'account-hash-leader4000000000000000000000000000000000000000000000000000000',
      total_followers: 178,
      total_aum: '95000000000000', // 95k CSPR
      performance_fee: 10,
      reputation_score: 780,
      verified: true,
      min_copy_amount: '15000000000', // 15 CSPR
      max_copiers: 1000,
      total_trades: 234,
      winning_trades: 175,
      total_profit: 35000000000000, // 35k CSPR profit
      created_at: Math.floor(Date.now() / 1000) - (150 * 86400), // 150 days ago
      last_trade_at: Math.floor(Date.now() / 1000) - 1800,
      bio: 'Conservative long-term investor. Low risk, steady returns.',
      strategy_description: 'Value-based investing in gold and silver. Hold positions for weeks to months.'
    },
    {
      address: 'account-hash-leader5000000000000000000000000000000000000000000000000000000',
      total_followers: 523,
      total_aum: '415000000000000', // 415k CSPR
      performance_fee: 18,
      reputation_score: 950,
      verified: true,
      min_copy_amount: '25000000000', // 25 CSPR
      max_copiers: 1000,
      total_trades: 1245,
      winning_trades: 898,
      total_profit: 152000000000000, // 152k CSPR profit
      created_at: Math.floor(Date.now() / 1000) - (450 * 86400), // 450 days ago
      last_trade_at: Math.floor(Date.now() / 1000) - 900,
      bio: 'Veteran trader with proven track record. Diversified across all RWA markets.',
      strategy_description: 'Multi-strategy approach combining technical analysis, fundamentals, and market sentiment.'
    }
  ];
}

function getMockLeaderStats(address, timeframe) {
  // Generate realistic stats based on timeframe
  const baseStats = {
    roi_7d: 3.2 + Math.random() * 5,
    roi_30d: 12.5 + Math.random() * 15,
    roi_90d: 28.4 + Math.random() * 25,
    roi_1y: 65.8 + Math.random() * 40,
    roi_all: 85.2 + Math.random() * 50,
    win_rate: 0.62 + Math.random() * 0.15, // 62-77%
    avg_win: '2500000000000', // 2.5k CSPR
    avg_loss: '1200000000000', // 1.2k CSPR
    profit_factor: 1.8 + Math.random() * 1.0,
    sharpe_ratio: 1.2 + Math.random() * 1.5,
    max_drawdown: 8 + Math.random() * 15,
    max_drawdown_duration: 3 + Math.floor(Math.random() * 10), // days
    avg_leverage: 4 + Math.random() * 4,
    avg_position_duration: 86400 * (2 + Math.random() * 5), // 2-7 days
    risk_score: 3 + Math.floor(Math.random() * 5),
    favorite_markets: [0, 2, 3], // Gold, Oil, S&P500
    long_short_ratio: 0.5 + Math.random() * 0.3,
    trades_7d: 5 + Math.floor(Math.random() * 10),
    trades_30d: 25 + Math.floor(Math.random() * 30),
    volume_30d: '45000000000000', // 45k CSPR
    follower_growth_30d: -5 + Math.floor(Math.random() * 30),
    copier_profit_total: 25000000000000 + Math.floor(Math.random() * 50000000000000),
    copier_profit_30d: 5000000000000 + Math.floor(Math.random() * 10000000000000),
    last_updated: Math.floor(Date.now() / 1000)
  };

  return baseStats;
}

function getMockCopyRelationships(userAddress) {
  return [
    {
      follower: userAddress,
      leader: 'account-hash-leader1000000000000000000000000000000000000000000000000000000',
      allocation_amount: '50000000000000', // 50k CSPR
      allocation_percentage: 40,
      auto_rebalance: true,
      risk_limits: {
        max_position_size: '10000000000000', // 10k CSPR
        max_leverage: 8,
        stop_loss_percentage: 20,
        max_daily_trades: 15,
        allowed_markets: [],
        max_concurrent_positions: 5
      },
      created_at: Math.floor(Date.now() / 1000) - (30 * 86400), // 30 days ago
      total_profit: 6500000000000, // 6.5k CSPR profit
      trades_copied: 42,
      fees_paid: '975000000000', // 975 CSPR in fees
      is_active: true,
      pause_reason: ''
    },
    {
      follower: userAddress,
      leader: 'account-hash-leader2000000000000000000000000000000000000000000000000000000',
      allocation_amount: '30000000000000', // 30k CSPR
      allocation_percentage: 25,
      auto_rebalance: true,
      risk_limits: {
        max_position_size: '8000000000000',
        max_leverage: 10,
        stop_loss_percentage: 15,
        max_daily_trades: 20,
        allowed_markets: [3, 4], // S&P500, Nasdaq only
        max_concurrent_positions: 3
      },
      created_at: Math.floor(Date.now() / 1000) - (15 * 86400), // 15 days ago
      total_profit: 4200000000000, // 4.2k CSPR profit
      trades_copied: 28,
      fees_paid: '504000000000', // 504 CSPR in fees
      is_active: true,
      pause_reason: ''
    }
  ];
}

module.exports = {
  getAllLeaders,
  getLeader,
  getLeaderFollowers,
  getUserCopyRelationships,
  getCopiedPositions,
  getLeaderStats
};
