const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { getCached, setCached } = require('../utils/redis');
const { getUserPositions } = require('../services/casper-client');
const { getCachedPrices } = require('../services/price-updater');

/**
 * GET /api/positions/:address
 * Get all positions for a user
 */
router.get('/:address', async (req, res, next) => {
  try {
    const { address } = req.params;
    const { status } = req.query;

    // Validate address format
    if (!address || address.length < 64) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Casper address'
      });
    }

    // Try cache first
    const cacheKey = `positions:${address}:${status || 'all'}`;
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Fetch from blockchain
    let positions = await getUserPositions(address);

    if (!positions || positions.length === 0) {
      return res.json({
        success: true,
        count: 0,
        data: []
      });
    }

    // Get current prices for PnL calculation
    const prices = await getCachedPrices();

    // Enrich positions with current PnL
    positions = positions.map(position => {
      const currentPrice = prices[position.assetType] || position.entryPrice;
      const priceChange = currentPrice - position.entryPrice;

      let pnl = 0;
      let pnlPercentage = 0;

      if (position.isLong) {
        pnl = (priceChange / position.entryPrice) * position.size * position.leverage;
        pnlPercentage = (priceChange / position.entryPrice) * position.leverage * 100;
      } else {
        pnl = (-priceChange / position.entryPrice) * position.size * position.leverage;
        pnlPercentage = (-priceChange / position.entryPrice) * position.leverage * 100;
      }

      const currentValue = parseFloat(position.collateral) + pnl;
      const liquidationDistance = position.isLong
        ? ((currentPrice - position.liquidationPrice) / currentPrice) * 100
        : ((position.liquidationPrice - currentPrice) / currentPrice) * 100;

      return {
        id: position.id,
        marketId: position.marketId,
        asset: position.asset,
        assetType: position.assetType,
        isLong: position.isLong,
        entryPrice: position.entryPrice,
        currentPrice,
        size: position.size,
        collateral: position.collateral,
        leverage: position.leverage,
        liquidationPrice: position.liquidationPrice,
        pnl,
        pnlPercentage,
        currentValue,
        liquidationDistance,
        openedAt: position.openedAt,
        lastUpdated: new Date().toISOString(),
        status: position.status || 'open',
        marketKey: position.marketKey
      };
    });

    // Apply filters
    if (status) {
      positions = positions.filter(p => p.status === status);
    }

    const response = {
      success: true,
      address,
      count: positions.length,
      data: positions,
      summary: {
        totalPositions: positions.length,
        totalCollateral: positions.reduce((sum, p) => sum + parseFloat(p.collateral), 0),
        totalPnl: positions.reduce((sum, p) => sum + p.pnl, 0),
        longPositions: positions.filter(p => p.isLong).length,
        shortPositions: positions.filter(p => !p.isLong).length,
      }
    };

    // Cache for 10 seconds (positions change frequently)
    await setCached(cacheKey, response, 10);

    res.json(response);
  } catch (error) {
    logger.error(`Error fetching positions for ${req.params.address}:`, error);
    next(error);
  }
});

/**
 * GET /api/positions/:address/:positionId
 * Get specific position details
 */
router.get('/:address/:positionId', async (req, res, next) => {
  try {
    const { address, positionId } = req.params;

    const cacheKey = `position:${address}:${positionId}`;
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Fetch all user positions
    const positions = await getUserPositions(address);

    // Find specific position
    const position = positions.find(p => p.id === positionId);

    if (!position) {
      return res.status(404).json({
        success: false,
        error: 'Position not found'
      });
    }

    // Get current price
    const prices = await getCachedPrices();
    const currentPrice = prices[position.assetType] || position.entryPrice;
    const priceChange = currentPrice - position.entryPrice;

    let pnl = 0;
    let pnlPercentage = 0;

    if (position.isLong) {
      pnl = (priceChange / position.entryPrice) * position.size * position.leverage;
      pnlPercentage = (priceChange / position.entryPrice) * position.leverage * 100;
    } else {
      pnl = (-priceChange / position.entryPrice) * position.size * position.leverage;
      pnlPercentage = (-priceChange / position.entryPrice) * position.leverage * 100;
    }

    const enrichedPosition = {
      ...position,
      currentPrice,
      pnl,
      pnlPercentage,
      currentValue: parseFloat(position.collateral) + pnl,
      liquidationDistance: position.isLong
        ? ((currentPrice - position.liquidationPrice) / currentPrice) * 100
        : ((position.liquidationPrice - currentPrice) / currentPrice) * 100,
      lastUpdated: new Date().toISOString()
    };

    const response = {
      success: true,
      data: enrichedPosition
    };

    // Cache for 10 seconds
    await setCached(cacheKey, response, 10);

    res.json(response);
  } catch (error) {
    logger.error(`Error fetching position ${req.params.positionId}:`, error);
    next(error);
  }
});

/**
 * GET /api/positions/:address/history
 * Get position history for a user
 */
router.get('/:address/history', async (req, res, next) => {
  try {
    const { address } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const cacheKey = `positions:${address}:history:${limit}:${offset}`;
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // In production, you'd query historical positions from a separate database
    // or maintain position history in the contract
    // For now, return empty array

    const response = {
      success: true,
      address,
      count: 0,
      data: [],
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: 0
      }
    };

    // Cache for 5 minutes (history doesn't change often)
    await setCached(cacheKey, response, 300);

    res.json(response);
  } catch (error) {
    logger.error(`Error fetching position history for ${req.params.address}:`, error);
    next(error);
  }
});

module.exports = router;
