const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { getCached, setCached } = require('../utils/redis');
const {
  getAllLeaders,
  getLeader,
  getLeaderFollowers,
  getUserCopyRelationships,
  getCopiedPositions,
  getLeaderStats,
  getUserPositions
} = require('../services/social-client');

/**
 * GET /api/social/leaders
 * List all trading leaders with stats
 */
router.get('/leaders', async (req, res, next) => {
  try {
    const {
      sortBy = 'roi',            // roi, aum, followers, reputation
      timeframe = '30d',         // 7d, 30d, 90d, 1y, all
      minRoi = 0,
      minFollowers = 0,
      verified = false,
      limit = 50,
      offset = 0
    } = req.query;

    const cacheKey = `social:leaders:${sortBy}:${timeframe}:${minRoi}:${minFollowers}:${verified}:${limit}:${offset}`;
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Fetch all leaders from blockchain
    let leaders = await getAllLeaders();

    // Enrich with performance stats
    const enrichedLeaders = await Promise.all(leaders.map(async leader => {
      const stats = await getLeaderStats(leader.address, timeframe);

      // Calculate risk score (1-10, based on volatility and drawdown)
      const riskScore = calculateRiskScore(stats);

      // Get favorite markets
      const favoriteMarkets = await getFavoriteMarkets(leader.address);

      return {
        address: leader.address,
        username: await getUsername(leader.address),
        avatar: await getAvatar(leader.address),
        verified: leader.verified,

        // Financial stats
        totalFollowers: leader.total_followers,
        aum: leader.total_aum.toString(),
        performanceFee: leader.performance_fee,
        minCopyAmount: leader.min_copy_amount.toString(),

        // Performance metrics (from stats)
        roi: stats[`roi_${timeframe}`] || stats.roi_30d,
        roiByTimeframe: {
          '7d': stats.roi_7d,
          '30d': stats.roi_30d,
          '90d': stats.roi_90d,
          '1y': stats.roi_1y,
          'all': stats.roi_all
        },
        winRate: stats.win_rate,
        totalTrades: leader.total_trades,
        winningTrades: leader.winning_trades,
        avgPositionDuration: stats.avg_position_duration,
        maxDrawdown: stats.max_drawdown,
        sharpeRatio: stats.sharpe_ratio,

        // Risk metrics
        avgLeverage: stats.avg_leverage,
        riskScore,

        // Market preferences
        favoriteMarkets,
        longShortRatio: stats.long_short_ratio,

        // Recent activity
        lastTradeAt: leader.last_trade_at,
        tradesThisWeek: stats.trades_7d,
        trades30d: stats.trades_30d,

        // Reputation
        reputationScore: leader.reputation_score,
        badges: generateBadges(leader, stats),

        // Social proof
        followerGrowth: stats.follower_growth_30d || 0,
        copierProfitTotal: stats.copier_profit_total || 0,
        copierProfit30d: stats.copier_profit_30d || 0,

        // Bio
        bio: leader.bio,
        strategy: leader.strategy_description,

        createdAt: leader.created_at,
      };
    }));

    // Apply filters
    let filtered = enrichedLeaders
      .filter(l => l.roi >= parseFloat(minRoi))
      .filter(l => l.totalFollowers >= parseInt(minFollowers))
      .filter(l => !verified || l.verified);

    // Sort
    if (sortBy === 'aum') {
      filtered.sort((a, b) => BigInt(b.aum) - BigInt(a.aum));
    } else if (sortBy === 'roi') {
      filtered.sort((a, b) => b.roi - a.roi);
    } else if (sortBy === 'followers') {
      filtered.sort((a, b) => b.totalFollowers - a.totalFollowers);
    } else if (sortBy === 'reputation') {
      filtered.sort((a, b) => b.reputationScore - a.reputationScore);
    }

    // Pagination
    const total = filtered.length;
    const paginated = filtered.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    const response = {
      success: true,
      count: paginated.length,
      total,
      data: paginated,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < total
      }
    };

    // Cache for 30 seconds
    await setCached(cacheKey, response, 30);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching leaders:', error);
    next(error);
  }
});

/**
 * GET /api/social/leaders/:address
 * Get detailed leader profile
 */
router.get('/leaders/:address', async (req, res, next) => {
  try {
    const { address } = req.params;
    const { timeframe = '30d' } = req.query;

    const cacheKey = `social:leader:${address}:${timeframe}`;
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Fetch leader data
    const leader = await getLeader(address);

    if (!leader) {
      return res.status(404).json({
        success: false,
        error: 'Leader not found'
      });
    }

    // Get detailed stats
    const stats = await getLeaderStats(address, timeframe);

    // Get trade history
    const recentTrades = await getRecentTrades(address, 20);

    // Get equity curve for chart
    const equityCurve = await getEquityCurve(address, timeframe);

    // Get current positions
    const currentPositions = await getUserPositions(address);

    // Get followers
    const followers = await getLeaderFollowers(address);
    const topFollowers = followers
      .sort((a, b) => BigInt(b.allocation) - BigInt(a.allocation))
      .slice(0, 10);

    const profile = {
      ...leader,
      aum: leader.total_aum.toString(),
      minCopyAmount: leader.min_copy_amount.toString(),

      // Stats
      ...stats,
      riskScore: calculateRiskScore(stats),
      badges: generateBadges(leader, stats),

      // Trade history
      recentTrades,

      // Performance chart
      equityCurve,

      // Current positions
      currentPositions: currentPositions.map(p => ({
        id: p.id,
        market: p.asset,
        isLong: p.isLong,
        size: p.size.toString(),
        leverage: p.leverage,
        pnl: p.pnl,
        pnlPercentage: p.pnlPercentage,
        openedAt: p.openedAt
      })),

      // Follower stats
      followerStats: {
        total: leader.total_followers,
        active: followers.filter(f => f.is_active).length,
        avgCopyAmount: leader.total_followers > 0
          ? BigInt(leader.total_aum) / BigInt(leader.total_followers)
          : 0,
        totalProfits: stats.copier_profit_total || 0,
        topFollowers: topFollowers.map(f => ({
          address: f.follower,
          username: getUsername(f.follower),
          allocation: f.allocation.toString(),
          roi: f.total_profit > 0
            ? (f.total_profit / Number(f.allocation)) * 100
            : 0,
          since: f.created_at
        }))
      },

      // Market breakdown
      favoriteMarkets: await getFavoriteMarkets(address),
    };

    const response = {
      success: true,
      data: profile
    };

    // Cache for 30 seconds
    await setCached(cacheKey, response, 30);

    res.json(response);
  } catch (error) {
    logger.error(`Error fetching leader profile ${req.params.address}:`, error);
    next(error);
  }
});

/**
 * GET /api/social/my-copies/:address
 * Get user's copy relationships
 */
router.get('/my-copies/:address', async (req, res, next) => {
  try {
    const { address } = req.params;

    const cacheKey = `social:my-copies:${address}`;
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Fetch user's copy relationships
    const copies = await getUserCopyRelationships(address);

    const enriched = await Promise.all(copies.map(async copy => {
      const leaderData = await getLeader(copy.leader);
      const leaderStats = await getLeaderStats(copy.leader, '30d');

      // Get copied positions for this leader
      const copiedPositions = await getCopiedPositions(address, copy.leader);
      const activePositions = copiedPositions.filter(p => p.closed_at === 0);

      // Calculate ROI
      const roi = copy.allocation_amount > 0
        ? (copy.total_profit / Number(copy.allocation_amount)) * 100
        : 0;

      return {
        leader: copy.leader,
        leaderName: await getUsername(copy.leader),
        leaderAvatar: await getAvatar(copy.leader),
        leaderVerified: leaderData?.verified || false,

        // My allocation
        allocationAmount: copy.allocation_amount.toString(),
        allocationPercentage: copy.allocation_percentage,

        // Performance
        totalProfit: copy.total_profit,
        roi,

        // Current positions
        activePositions: activePositions.map(p => ({
          id: p.position_id,
          market: p.market_id,
          isLong: p.is_long,
          size: p.size.toString(),
          collateral: p.collateral.toString(),
          leverage: p.leverage,
          unrealizedPnl: calculateUnrealizedPnl(p)
        })),

        // Fees
        feesPaid: copy.fees_paid.toString(),

        // Risk limits
        riskLimits: copy.risk_limits,

        // Stats
        tradingDays: calculateDays(copy.created_at),
        tradesCopied: copy.trades_copied,

        // Status
        isActive: copy.is_active,
        pauseReason: copy.pause_reason,

        // Leader's recent performance
        leaderRoi30d: leaderStats.roi_30d,
        leaderWinRate: leaderStats.win_rate,

        createdAt: copy.created_at
      };
    }));

    const totalAllocated = enriched.reduce((sum, c) => sum + BigInt(c.allocationAmount), BigInt(0));
    const totalProfit = enriched.reduce((sum, c) => sum + c.totalProfit, 0);
    const totalFees = enriched.reduce((sum, c) => sum + BigInt(c.feesPaid), BigInt(0));

    const response = {
      success: true,
      address,
      totalCopies: enriched.length,
      activeCopies: enriched.filter(c => c.isActive).length,
      totalAllocated: totalAllocated.toString(),
      totalProfit,
      totalFees: totalFees.toString(),
      overallRoi: totalAllocated > 0
        ? (totalProfit / Number(totalAllocated)) * 100
        : 0,
      data: enriched
    };

    // Cache for 10 seconds
    await setCached(cacheKey, response, 10);

    res.json(response);
  } catch (error) {
    logger.error(`Error fetching copies for ${req.params.address}:`, error);
    next(error);
  }
});

/**
 * GET /api/social/discover
 * Personalized leader recommendations
 */
router.get('/discover', async (req, res, next) => {
  try {
    const { userAddress } = req.query;

    const cacheKey = `social:discover:${userAddress || 'anon'}`;
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Get all leaders for recommendations
    const allLeaders = await getAllLeaders();

    // Calculate recommendations
    const recommendations = {
      // Top performers this month
      hotTraders: await getTopPerformers(allLeaders, '30d', 10),

      // Consistent long-term winners (low drawdown, steady returns)
      consistent: await getConsistentTraders(allLeaders, 10),

      // Low risk traders
      conservative: await getLeadersByRisk(allLeaders, 'low', 10),

      // High risk, high reward
      aggressive: await getLeadersByRisk(allLeaders, 'high', 10),

      // Market specialists
      specialists: {
        gold: await getMarketSpecialists(allLeaders, 'Gold', 5),
        oil: await getMarketSpecialists(allLeaders, 'Oil', 5),
        stocks: await getMarketSpecialists(allLeaders, 'S&P500', 5),
      },

      // Rising stars (new leaders with great performance)
      risingStars: await getRisingStars(allLeaders, 10),

      // Most copied (social proof)
      mostPopular: allLeaders
        .sort((a, b) => b.total_followers - a.total_followers)
        .slice(0, 10)
        .map(l => ({
          address: l.address,
          username: getUsername(l.address),
          followers: l.total_followers,
          aum: l.total_aum.toString()
        })),
    };

    // If user address provided, add personalized recommendations
    if (userAddress) {
      const userProfile = await getUserProfile(userAddress);
      const userRiskTolerance = calculateRiskTolerance(userProfile);
      recommendations.forYou = await getPersonalizedRecommendations(
        allLeaders,
        userAddress,
        userRiskTolerance
      );
    }

    const response = {
      success: true,
      data: recommendations
    };

    // Cache for 5 minutes
    await setCached(cacheKey, response, 300);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching discover recommendations:', error);
    next(error);
  }
});

/**
 * GET /api/social/stats
 * Platform-wide social trading statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const cacheKey = 'social:platform:stats';
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    const allLeaders = await getAllLeaders();
    const allCopies = await getAllCopyRelationships();

    const totalAum = allLeaders.reduce((sum, l) => sum + BigInt(l.total_aum), BigInt(0));
    const totalCopiers = new Set(allCopies.map(c => c.follower)).size;
    const activeCopies = allCopies.filter(c => c.is_active).length;

    const stats = {
      totalLeaders: allLeaders.length,
      verifiedLeaders: allLeaders.filter(l => l.verified).length,
      totalCopiers,
      totalCopyRelationships: allCopies.length,
      activeCopyRelationships: activeCopies,
      totalAum: totalAum.toString(),
      avgAumPerLeader: allLeaders.length > 0
        ? (totalAum / BigInt(allLeaders.length)).toString()
        : '0',
      avgFollowersPerLeader: allLeaders.length > 0
        ? allLeaders.reduce((sum, l) => sum + l.total_followers, 0) / allLeaders.length
        : 0,
      totalPerformanceFeesPaid: allCopies.reduce((sum, c) => sum + BigInt(c.fees_paid), BigInt(0)).toString(),
      totalCopierProfit: allCopies.reduce((sum, c) => sum + c.total_profit, 0),
    };

    const response = {
      success: true,
      data: stats
    };

    // Cache for 1 minute
    await setCached(cacheKey, response, 60);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching social trading stats:', error);
    next(error);
  }
});

// ===== Helper Functions =====

function calculateRiskScore(stats) {
  // Risk score 1-10 (10 = highest risk)
  let score = 5; // Start at medium

  // High leverage increases risk
  if (stats.avg_leverage > 7) score += 2;
  else if (stats.avg_leverage > 5) score += 1;

  // High drawdown increases risk
  if (stats.max_drawdown > 40) score += 2;
  else if (stats.max_drawdown > 20) score += 1;

  // Low Sharpe ratio increases risk
  if (stats.sharpe_ratio < 0.5) score += 1;
  else if (stats.sharpe_ratio > 1.5) score -= 1;

  // High win rate decreases risk
  if (stats.win_rate > 70) score -= 1;
  else if (stats.win_rate < 40) score += 1;

  return Math.max(1, Math.min(10, score));
}

function generateBadges(leader, stats) {
  const badges = [];

  if (leader.verified) badges.push('Verified');
  if (leader.total_followers > 100) badges.push('Popular');
  if (leader.total_followers > 500) badges.push('Top 1%');
  if (stats.win_rate > 70) badges.push('High Win Rate');
  if (stats.sharpe_ratio > 2) badges.push('Consistent');
  if (stats.max_drawdown < 10) badges.push('Low Risk');
  if (stats.roi_30d > 50) badges.push('Hot Trader');
  if (calculateDays(leader.created_at) > 365) badges.push('Veteran');

  return badges;
}

async function getTopPerformers(leaders, timeframe, limit) {
  const enriched = await Promise.all(leaders.map(async l => {
    const stats = await getLeaderStats(l.address, timeframe);
    return {
      ...l,
      roi: stats[`roi_${timeframe}`] || stats.roi_30d
    };
  }));

  return enriched
    .sort((a, b) => b.roi - a.roi)
    .slice(0, limit)
    .map(l => ({
      address: l.address,
      username: getUsername(l.address),
      roi: l.roi,
      followers: l.total_followers
    }));
}

async function getConsistentTraders(leaders, limit) {
  const enriched = await Promise.all(leaders.map(async l => {
    const stats = await getLeaderStats(l.address, '90d');
    // Consistent = high Sharpe, low drawdown
    const consistencyScore = stats.sharpe_ratio * (1 - stats.max_drawdown / 100);
    return {
      ...l,
      consistencyScore,
      sharpeRatio: stats.sharpe_ratio,
      maxDrawdown: stats.max_drawdown
    };
  }));

  return enriched
    .sort((a, b) => b.consistencyScore - a.consistencyScore)
    .slice(0, limit)
    .map(l => ({
      address: l.address,
      username: getUsername(l.address),
      sharpeRatio: l.sharpeRatio,
      maxDrawdown: l.maxDrawdown
    }));
}

async function getLeadersByRisk(leaders, riskLevel, limit) {
  const enriched = await Promise.all(leaders.map(async l => {
    const stats = await getLeaderStats(l.address, '30d');
    return {
      ...l,
      riskScore: calculateRiskScore(stats),
      roi: stats.roi_30d
    };
  }));

  const filtered = riskLevel === 'low'
    ? enriched.filter(l => l.riskScore <= 4)
    : enriched.filter(l => l.riskScore >= 7);

  return filtered
    .sort((a, b) => b.roi - a.roi)
    .slice(0, limit)
    .map(l => ({
      address: l.address,
      username: getUsername(l.address),
      riskScore: l.riskScore,
      roi: l.roi
    }));
}

async function getMarketSpecialists(leaders, market, limit) {
  // Get leaders who trade primarily in specific market
  // Simplified for now
  return leaders.slice(0, limit).map(l => ({
    address: l.address,
    username: getUsername(l.address),
    specialization: market
  }));
}

async function getRisingStars(leaders, limit) {
  // New leaders (< 90 days) with great performance
  const newLeaders = leaders.filter(l => calculateDays(l.created_at) < 90);

  const enriched = await Promise.all(newLeaders.map(async l => {
    const stats = await getLeaderStats(l.address, '30d');
    return {
      ...l,
      roi: stats.roi_30d,
      winRate: stats.win_rate
    };
  }));

  return enriched
    .sort((a, b) => b.roi - a.roi)
    .slice(0, limit)
    .map(l => ({
      address: l.address,
      username: getUsername(l.address),
      roi: l.roi,
      daysActive: calculateDays(l.created_at)
    }));
}

async function getPersonalizedRecommendations(leaders, userAddress, userRiskTolerance) {
  // Match leaders to user's risk tolerance
  // Placeholder implementation
  return leaders.slice(0, 10).map(l => ({
    address: l.address,
    username: getUsername(l.address),
    matchScore: 85 // 0-100 match percentage
  }));
}

function calculateUnrealizedPnl(position) {
  // Calculate current PnL for open position
  // Placeholder - would need current price
  return 0;
}

function calculateDays(timestamp) {
  const now = Date.now() / 1000;
  return Math.floor((now - timestamp) / 86400);
}

function getUsername(address) {
  // In production, fetch from user profiles
  return `Trader_${address.slice(0, 8)}`;
}

function getAvatar(address) {
  // In production, fetch from user profiles
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`;
}

async function getRecentTrades(address, limit) {
  // Fetch from position history
  // Placeholder
  return [];
}

async function getEquityCurve(address, timeframe) {
  // Return equity curve data for chart
  // Placeholder
  return [];
}

async function getFavoriteMarkets(address) {
  // Get top 3 markets by volume
  // Placeholder
  return ['Gold', 'Oil', 'S&P500'];
}

async function getUserProfile(address) {
  // Get user's trading profile
  // Placeholder
  return {};
}

function calculateRiskTolerance(profile) {
  // Calculate user's risk tolerance from their trading history
  // Placeholder
  return 'medium';
}

async function getAllCopyRelationships() {
  // Fetch all copy relationships from blockchain
  // Placeholder
  return [];
}

module.exports = router;
