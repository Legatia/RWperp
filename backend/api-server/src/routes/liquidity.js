const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { getCached, setCached } = require('../utils/redis');
const { getLiquidityPoolStats, getUserLPInfo } = require('../services/casper-client');

/**
 * GET /api/liquidity/pool
 * Get liquidity pool statistics
 */
router.get('/pool', async (req, res, next) => {
  try {
    const cacheKey = 'liquidity:pool:stats';
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Fetch from blockchain
    const poolStats = await getLiquidityPoolStats();

    const lpTokenPrice = poolStats.total_lp_tokens > 0
      ? poolStats.total_liquidity / poolStats.total_lp_tokens
      : 1;

    // Calculate APY (simplified)
    // APY = (fees_earned / total_liquidity) * 365 * 100
    const dailyFees = poolStats.total_fees_earned / 30; // Rough estimate
    const apy = poolStats.total_liquidity > 0
      ? (dailyFees / poolStats.total_liquidity) * 365 * 100
      : 0;

    const enrichedStats = {
      totalLiquidity: poolStats.total_liquidity,
      totalLpTokens: poolStats.total_lp_tokens,
      lpTokenPrice,
      totalFeesEarned: poolStats.total_fees_earned,
      traderPnl: poolStats.trader_pnl,
      utilizationRate: poolStats.utilization_rate,
      apy,
      volume24h: poolStats.volume_24h || 0,
      lpCount: poolStats.lp_count || 0,
      lastUpdated: new Date().toISOString()
    };

    const response = {
      success: true,
      data: enrichedStats
    };

    // Cache for 30 seconds
    await setCached(cacheKey, response, 30);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching liquidity pool stats:', error);
    next(error);
  }
});

/**
 * GET /api/liquidity/:address
 * Get LP info for a user
 */
router.get('/:address', async (req, res, next) => {
  try {
    const { address } = req.params;

    if (!address || address.length < 64) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Casper address'
      });
    }

    const cacheKey = `liquidity:user:${address}`;
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Fetch user LP info
    const lpInfo = await getUserLPInfo(address);

    if (!lpInfo) {
      return res.json({
        success: true,
        address,
        data: {
          lpTokens: 0,
          depositedAmount: 0,
          currentValue: 0,
          feesEarned: 0,
          withdrawalRequests: []
        }
      });
    }

    // Get pool stats for LP token price
    const poolStats = await getLiquidityPoolStats();
    const lpTokenPrice = poolStats.total_lp_tokens > 0
      ? poolStats.total_liquidity / poolStats.total_lp_tokens
      : 1;

    const currentValue = lpInfo.lp_tokens * lpTokenPrice;
    const profitLoss = currentValue - lpInfo.deposited_amount;
    const profitLossPercentage = lpInfo.deposited_amount > 0
      ? (profitLoss / lpInfo.deposited_amount) * 100
      : 0;

    const enrichedLpInfo = {
      address: lpInfo.address,
      lpTokens: lpInfo.lp_tokens,
      depositedAmount: lpInfo.deposited_amount,
      currentValue,
      profitLoss,
      profitLossPercentage,
      feesEarned: lpInfo.fees_earned,
      depositTimestamp: lpInfo.deposit_timestamp,
      withdrawalRequests: lpInfo.withdrawal_requests || [],
      poolShare: poolStats.total_lp_tokens > 0
        ? (lpInfo.lp_tokens / poolStats.total_lp_tokens) * 100
        : 0,
      lastUpdated: new Date().toISOString()
    };

    const response = {
      success: true,
      address,
      data: enrichedLpInfo
    };

    // Cache for 10 seconds
    await setCached(cacheKey, response, 10);

    res.json(response);
  } catch (error) {
    logger.error(`Error fetching LP info for ${req.params.address}:`, error);
    next(error);
  }
});

/**
 * GET /api/liquidity/pool/history
 * Get liquidity pool history
 */
router.get('/pool/history', async (req, res, next) => {
  try {
    const { interval = '1d', limit = 30 } = req.query;

    const cacheKey = `liquidity:pool:history:${interval}:${limit}`;
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // In production, maintain historical pool data
    // For now, return mock structure
    const history = [];
    const now = Date.now();
    const intervalMs = interval === '1d' ? 86400000 : 3600000;

    for (let i = parseInt(limit) - 1; i >= 0; i--) {
      const timestamp = now - (i * intervalMs);
      history.push({
        timestamp,
        totalLiquidity: 10000000 + Math.random() * 1000000,
        totalLpTokens: 9500000 + Math.random() * 500000,
        lpTokenPrice: 1 + Math.random() * 0.1,
        utilizationRate: Math.random() * 50,
        apy: 20 + Math.random() * 30
      });
    }

    const response = {
      success: true,
      interval,
      count: history.length,
      data: history
    };

    // Cache for 5 minutes
    await setCached(cacheKey, response, 300);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching liquidity pool history:', error);
    next(error);
  }
});

module.exports = router;
