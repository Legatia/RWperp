const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { getCached, setCached } = require('../utils/redis');
const { getAllMarkets, getMarketById } = require('../services/casper-client');
const { getCachedPrices } = require('../services/price-updater');

/**
 * GET /api/markets
 * Get all available markets
 */
router.get('/', async (req, res, next) => {
  try {
    const { status, asset, sortBy } = req.query;

    // Try to get from cache first
    const cacheKey = `markets:all:${status || 'all'}:${asset || 'all'}:${sortBy || 'default'}`;
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Fetch from blockchain
    let markets = await getAllMarkets();

    // Get current prices
    const prices = await getCachedPrices();

    // Enrich markets with current prices and calculated fields
    markets = markets.map(market => {
      const currentPrice = prices[market.assetType] || null;

      return {
        id: market.id,
        asset: market.asset,
        assetType: market.assetType,
        marketKey: market.marketKey,
        settlementTime: market.settlementTime,
        startPrice: market.startPrice,
        currentPrice,
        priceChange: currentPrice && market.startPrice
          ? ((currentPrice - market.startPrice) / market.startPrice) * 100
          : 0,
        volume24h: market.volume || 0,
        openInterest: market.openInterest || 0,
        longShortRatio: market.longPositions && market.shortPositions
          ? market.longPositions / (market.longPositions + market.shortPositions)
          : 0.5,
        status: market.status || 'active',
        createdAt: market.createdAt,
        updatedAt: new Date().toISOString()
      };
    });

    // Apply filters
    if (status) {
      markets = markets.filter(m => m.status === status);
    }

    if (asset) {
      markets = markets.filter(m =>
        m.asset.toLowerCase().includes(asset.toLowerCase())
      );
    }

    // Apply sorting
    if (sortBy === 'volume') {
      markets.sort((a, b) => b.volume24h - a.volume24h);
    } else if (sortBy === 'change') {
      markets.sort((a, b) => Math.abs(b.priceChange) - Math.abs(a.priceChange));
    }

    const response = {
      success: true,
      count: markets.length,
      data: markets
    };

    // Cache for 30 seconds
    await setCached(cacheKey, response, 30);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching markets:', error);
    next(error);
  }
});

/**
 * GET /api/markets/:id
 * Get market by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Try cache first
    const cacheKey = `market:${id}`;
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Fetch from blockchain
    const market = await getMarketById(id);

    if (!market) {
      return res.status(404).json({
        success: false,
        error: 'Market not found'
      });
    }

    // Get current price
    const prices = await getCachedPrices();
    const currentPrice = prices[market.assetType] || null;

    const enrichedMarket = {
      id: market.id,
      asset: market.asset,
      assetType: market.assetType,
      marketKey: market.marketKey,
      settlementTime: market.settlementTime,
      startPrice: market.startPrice,
      currentPrice,
      priceChange: currentPrice && market.startPrice
        ? ((currentPrice - market.startPrice) / market.startPrice) * 100
        : 0,
      volume24h: market.volume || 0,
      openInterest: market.openInterest || 0,
      longPositions: market.longPositions || 0,
      shortPositions: market.shortPositions || 0,
      longShortRatio: market.longPositions && market.shortPositions
        ? market.longPositions / (market.longPositions + market.shortPositions)
        : 0.5,
      totalLongs: market.totalLongs || 0,
      totalShorts: market.totalShorts || 0,
      status: market.status || 'active',
      maxLeverage: 10,
      tradingFee: 0.002, // 0.2%
      minPositionSize: '10000000000', // 10 CSPR
      maxPositionSize: market.maxPositionSize,
      settlementHistory: market.settlementHistory || [],
      createdAt: market.createdAt,
      updatedAt: new Date().toISOString()
    };

    const response = {
      success: true,
      data: enrichedMarket
    };

    // Cache for 30 seconds
    await setCached(cacheKey, response, 30);

    res.json(response);
  } catch (error) {
    logger.error(`Error fetching market ${req.params.id}:`, error);
    next(error);
  }
});

/**
 * GET /api/markets/:id/history
 * Get market price history
 */
router.get('/:id/history', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { interval = '1h', limit = 100 } = req.query;

    // Try cache first
    const cacheKey = `market:${id}:history:${interval}:${limit}`;
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // In production, you'd query historical price data from the oracle contract
    // or maintain a separate time-series database
    // For now, return mock data structure

    const history = [];
    const now = Date.now();
    const intervalMs = interval === '1h' ? 3600000 :
                       interval === '4h' ? 14400000 :
                       interval === '1d' ? 86400000 : 3600000;

    for (let i = parseInt(limit) - 1; i >= 0; i--) {
      const timestamp = now - (i * intervalMs);
      history.push({
        timestamp,
        price: 2000 + Math.random() * 100, // Mock price
        volume: Math.random() * 1000000,
        high: 2050 + Math.random() * 50,
        low: 1950 + Math.random() * 50,
        open: 2000 + Math.random() * 100,
        close: 2000 + Math.random() * 100
      });
    }

    const response = {
      success: true,
      marketId: id,
      interval,
      count: history.length,
      data: history
    };

    // Cache for 5 minutes
    await setCached(cacheKey, response, 300);

    res.json(response);
  } catch (error) {
    logger.error(`Error fetching market history for ${req.params.id}:`, error);
    next(error);
  }
});

/**
 * GET /api/markets/:id/stats
 * Get market statistics
 */
router.get('/:id/stats', async (req, res, next) => {
  try {
    const { id } = req.params;

    const cacheKey = `market:${id}:stats`;
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Fetch market data
    const market = await getMarketById(id);

    if (!market) {
      return res.status(404).json({
        success: false,
        error: 'Market not found'
      });
    }

    const stats = {
      volume24h: market.volume || 0,
      volume7d: market.volume7d || 0,
      trades24h: market.trades24h || 0,
      openInterest: market.openInterest || 0,
      longShortRatio: market.longPositions && market.shortPositions
        ? market.longPositions / (market.longPositions + market.shortPositions)
        : 0.5,
      avgLeverage: market.avgLeverage || 5,
      liquidations24h: market.liquidations24h || 0,
      fundingRate: 0, // Not applicable for daily settled markets
      nextSettlement: market.settlementTime,
      highPrice24h: market.highPrice24h || market.currentPrice,
      lowPrice24h: market.lowPrice24h || market.currentPrice,
    };

    const response = {
      success: true,
      marketId: id,
      data: stats
    };

    // Cache for 1 minute
    await setCached(cacheKey, response, 60);

    res.json(response);
  } catch (error) {
    logger.error(`Error fetching market stats for ${req.params.id}:`, error);
    next(error);
  }
});

module.exports = router;
