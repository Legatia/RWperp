const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { getCached, setCached } = require('../utils/redis');
const {
  getAllMarkets,
  getLiquidityPoolStats,
  getGovernanceProposals,
  getYieldFarmingPools,
  getCurrentOraclePrices
} = require('../services/casper-client');

/**
 * GET /api/stats/platform
 * Get overall platform statistics
 */
router.get('/platform', async (req, res, next) => {
  try {
    const cacheKey = 'stats:platform';
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Fetch data from multiple sources
    const [markets, poolStats, proposals, farmingPools, prices] = await Promise.all([
      getAllMarkets(),
      getLiquidityPoolStats(),
      getGovernanceProposals(),
      getYieldFarmingPools(),
      getCurrentOraclePrices()
    ]);

    // Calculate total volume across all markets
    const totalVolume = markets.reduce((sum, m) => sum + (m.volume || 0), 0);

    // Calculate total open interest
    const totalOpenInterest = markets.reduce((sum, m) => sum + (m.openInterest || 0), 0);

    // Calculate total value locked (pool + staked in farming)
    const totalFarmingTVL = farmingPools.reduce((sum, p) => sum + parseFloat(p.total_staked || 0), 0);
    const totalTVL = parseFloat(poolStats.total_liquidity || 0) + totalFarmingTVL;

    // Calculate active proposals
    const now = Date.now() / 1000;
    const activeProposals = proposals.filter(p =>
      now >= p.start_time && now <= p.end_time
    ).length;

    const platformStats = {
      // Trading stats
      totalVolume24h: totalVolume,
      totalVolume7d: totalVolume * 7, // Simplified
      totalOpenInterest,
      activeMarkets: markets.filter(m => m.status === 'active').length,
      totalMarkets: markets.length,

      // Liquidity stats
      totalValueLocked: totalTVL,
      liquidityPoolTVL: poolStats.total_liquidity,
      farmingTVL: totalFarmingTVL,
      lpTokenPrice: poolStats.total_lp_tokens > 0
        ? poolStats.total_liquidity / poolStats.total_lp_tokens
        : 1,

      // Governance stats
      totalProposals: proposals.length,
      activeProposals,
      totalRWPStaked: poolStats.total_lp_tokens || 0,

      // Farming stats
      activeFarmingPools: farmingPools.filter(p => p.is_active).length,
      totalFarmingPools: farmingPools.length,

      // Protocol fees
      totalFeesCollected: poolStats.total_fees_earned || 0,
      fees24h: (poolStats.total_fees_earned || 0) / 30, // Rough estimate

      // Trader stats
      totalTraderPnL: poolStats.trader_pnl || 0,
      lpPnL: -(poolStats.trader_pnl || 0), // LP PnL is inverse of trader PnL

      // Utilization
      poolUtilization: poolStats.utilization_rate || 0,

      lastUpdated: new Date().toISOString()
    };

    const response = {
      success: true,
      data: platformStats
    };

    // Cache for 1 minute
    await setCached(cacheKey, response, 60);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching platform stats:', error);
    next(error);
  }
});

/**
 * GET /api/stats/markets
 * Get aggregated market statistics
 */
router.get('/markets', async (req, res, next) => {
  try {
    const cacheKey = 'stats:markets';
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    const markets = await getAllMarkets();
    const prices = await getCurrentOraclePrices();

    // Aggregate by asset type
    const assetTypes = ['Gold', 'Silver', 'Oil', 'S&P500', 'Nasdaq', 'Bitcoin'];

    const aggregated = assetTypes.map((asset, index) => {
      const assetMarkets = markets.filter(m => m.assetType === index);

      const totalVolume = assetMarkets.reduce((sum, m) => sum + (m.volume || 0), 0);
      const totalOpenInterest = assetMarkets.reduce((sum, m) => sum + (m.openInterest || 0), 0);

      return {
        asset,
        assetType: index,
        currentPrice: prices[index] || null,
        markets: assetMarkets.length,
        volume24h: totalVolume,
        openInterest: totalOpenInterest,
        avgLongShortRatio: assetMarkets.length > 0
          ? assetMarkets.reduce((sum, m) => sum + (m.longShortRatio || 0.5), 0) / assetMarkets.length
          : 0.5
      };
    });

    const response = {
      success: true,
      count: aggregated.length,
      data: aggregated
    };

    // Cache for 1 minute
    await setCached(cacheKey, response, 60);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching market stats:', error);
    next(error);
  }
});

/**
 * GET /api/stats/leaderboard
 * Get trader leaderboard
 */
router.get('/leaderboard', async (req, res, next) => {
  try {
    const { period = '7d', limit = 10 } = req.query;

    const cacheKey = `stats:leaderboard:${period}:${limit}`;
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // In production, you'd maintain a leaderboard table or query position history
    // For now, return empty structure
    const leaderboard = [];

    const response = {
      success: true,
      period,
      count: leaderboard.length,
      data: leaderboard
    };

    // Cache for 5 minutes
    await setCached(cacheKey, response, 300);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching leaderboard:', error);
    next(error);
  }
});

/**
 * GET /api/stats/treasury
 * Get treasury statistics
 */
router.get('/treasury', async (req, res, next) => {
  try {
    const cacheKey = 'stats:treasury';
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    const poolStats = await getLiquidityPoolStats();

    // Treasury gets 20% of trading fees
    const treasuryBalance = (poolStats.total_fees_earned || 0) * 0.2;

    const treasuryStats = {
      balance: treasuryBalance,
      feesCollected24h: ((poolStats.total_fees_earned || 0) / 30) * 0.2,
      feesCollected7d: ((poolStats.total_fees_earned || 0) / 30) * 7 * 0.2,
      totalFeesAllTime: treasuryBalance,
      allocations: {
        development: treasuryBalance * 0.4,
        marketing: treasuryBalance * 0.3,
        operations: treasuryBalance * 0.2,
        reserve: treasuryBalance * 0.1
      },
      lastUpdated: new Date().toISOString()
    };

    const response = {
      success: true,
      data: treasuryStats
    };

    // Cache for 5 minutes
    await setCached(cacheKey, response, 300);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching treasury stats:', error);
    next(error);
  }
});

/**
 * GET /api/stats/analytics
 * Get detailed analytics
 */
router.get('/analytics', async (req, res, next) => {
  try {
    const { timeframe = '24h' } = req.query;

    const cacheKey = `stats:analytics:${timeframe}`;
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    const [markets, poolStats] = await Promise.all([
      getAllMarkets(),
      getLiquidityPoolStats()
    ]);

    const analytics = {
      trading: {
        totalVolume: markets.reduce((sum, m) => sum + (m.volume || 0), 0),
        numberOfTrades: markets.reduce((sum, m) => sum + (m.trades || 0), 0),
        averageTradeSize: 0, // Calculate from trades
        liquidations: markets.reduce((sum, m) => sum + (m.liquidations24h || 0), 0),
      },
      liquidity: {
        totalLiquidity: poolStats.total_liquidity,
        utilizationRate: poolStats.utilization_rate,
        lpCount: poolStats.lp_count || 0,
        averageLpSize: poolStats.lp_count > 0
          ? poolStats.total_liquidity / poolStats.lp_count
          : 0,
      },
      users: {
        totalUsers: 0, // Would need separate tracking
        activeTraders24h: 0,
        newUsers24h: 0,
      },
      markets: {
        mostTradedAsset: null, // Calculate from volumes
        mostVolatileAsset: null,
        highestOpenInterest: null,
      },
      lastUpdated: new Date().toISOString()
    };

    // Find most traded asset
    if (markets.length > 0) {
      const sorted = [...markets].sort((a, b) => (b.volume || 0) - (a.volume || 0));
      analytics.markets.mostTradedAsset = sorted[0]?.asset || null;

      const sortedOI = [...markets].sort((a, b) => (b.openInterest || 0) - (a.openInterest || 0));
      analytics.markets.highestOpenInterest = sortedOI[0]?.asset || null;
    }

    const response = {
      success: true,
      timeframe,
      data: analytics
    };

    // Cache for 2 minutes
    await setCached(cacheKey, response, 120);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching analytics:', error);
    next(error);
  }
});

module.exports = router;
