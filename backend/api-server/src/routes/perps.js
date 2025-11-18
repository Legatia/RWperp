const express = require('express');
const router = express.Router();
const { CasperClient, CLPublicKey, CLValueBuilder } = require('casper-js-sdk');

// Initialize Casper client
const casperClient = new CasperClient(process.env.CASPER_NODE_URL || 'http://localhost:11101/rpc');

/**
 * @route GET /api/perps/markets
 * @desc Get all continuous perpetual markets
 * @access Public
 */
router.get('/markets', async (req, res, next) => {
  try {
    const marketFactoryHash = process.env.MARKET_FACTORY_CONTRACT_HASH;

    if (!marketFactoryHash) {
      return res.status(500).json({
        success: false,
        error: 'Market factory contract not configured',
      });
    }

    // Asset types for continuous perps (Gold, Silver, Oil, S&P500, Nasdaq)
    const perpAssets = [
      { type: 0, name: 'Gold', symbol: 'XAU/USD' },
      { type: 1, name: 'Silver', symbol: 'XAG/USD' },
      { type: 4, name: 'Oil', symbol: 'WTI/USD' },
      { type: 2, name: 'S&P 500', symbol: 'SPX' },
      { type: 3, name: 'Nasdaq', symbol: 'NDX' },
    ];

    const markets = [];

    // Fetch each perp market from contract
    for (const asset of perpAssets) {
      try {
        const stateRootHash = await casperClient.nodeClient.getStateRootHash();
        const contractData = await casperClient.nodeClient.getBlockState(
          stateRootHash,
          `hash-${marketFactoryHash}`,
          [`perp_${asset.type}`]
        );

        if (contractData && contractData.CLValue) {
          const perpData = contractData.CLValue.data;

          markets.push({
            assetType: asset.type,
            name: asset.name,
            symbol: asset.symbol,
            currentPrice: perpData.current_price || '0',
            indexPrice: perpData.index_price || '0',
            markPrice: perpData.mark_price || '0',
            fundingRate: perpData.funding_rate || 0,
            lastFundingTime: perpData.last_funding_time || 0,
            fundingInterval: perpData.funding_interval || 28800,
            totalLongOI: perpData.total_long_oi || '0',
            totalShortOI: perpData.total_short_oi || '0',
            totalLongCollateral: perpData.total_long_collateral || '0',
            totalShortCollateral: perpData.total_short_collateral || '0',
            maxLeverage: perpData.max_leverage || 10,
            isActive: perpData.is_active || false,
            createdAt: perpData.created_at || 0,
          });
        }
      } catch (error) {
        console.warn(`Failed to fetch perp market for ${asset.name}:`, error.message);
        // Add placeholder if market doesn't exist yet
        markets.push({
          assetType: asset.type,
          name: asset.name,
          symbol: asset.symbol,
          currentPrice: '0',
          fundingRate: 0,
          isActive: false,
          error: 'Market not initialized',
        });
      }
    }

    res.json({
      success: true,
      count: markets.length,
      data: markets,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/perps/funding-rate/:assetType
 * @desc Get current funding rate for a perpetual market
 * @access Public
 */
router.get('/funding-rate/:assetType', async (req, res, next) => {
  try {
    const { assetType } = req.params;
    const marketFactoryHash = process.env.MARKET_FACTORY_CONTRACT_HASH;

    if (!marketFactoryHash) {
      return res.status(500).json({
        success: false,
        error: 'Market factory contract not configured',
      });
    }

    // Call get_funding_rate on contract
    const stateRootHash = await casperClient.nodeClient.getStateRootHash();
    const contractData = await casperClient.nodeClient.getBlockState(
      stateRootHash,
      `hash-${marketFactoryHash}`,
      [`perp_${assetType}`]
    );

    if (!contractData || !contractData.CLValue) {
      return res.status(404).json({
        success: false,
        error: 'Perpetual market not found',
      });
    }

    const perpData = contractData.CLValue.data;

    // Calculate next funding time
    const lastFundingTime = perpData.last_funding_time || 0;
    const fundingInterval = perpData.funding_interval || 28800;
    const nextFundingTime = lastFundingTime + fundingInterval;
    const now = Math.floor(Date.now() / 1000);
    const timeUntilFunding = Math.max(0, nextFundingTime - now);

    // Calculate annualized funding rate
    // Funding happens 3 times per day (every 8 hours)
    const fundingRate = perpData.funding_rate || 0;
    const annualizedRate = (fundingRate / 10000) * 365 * 3; // Convert to annual %

    res.json({
      success: true,
      data: {
        assetType: parseInt(assetType),
        fundingRate: fundingRate, // In basis points
        fundingRatePercentage: (fundingRate / 100).toFixed(4), // In percentage
        annualizedRate: (annualizedRate * 100).toFixed(2), // Annual %
        lastFundingTime,
        nextFundingTime,
        timeUntilFunding,
        fundingInterval,
        premiumIndex: perpData.premium_index || 0,
        markPrice: perpData.mark_price || '0',
        indexPrice: perpData.index_price || '0',
      },
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/perps/funding-history/:assetType
 * @desc Get historical funding rates for a perpetual market
 * @access Public
 */
router.get('/funding-history/:assetType', async (req, res, next) => {
  try {
    const { assetType } = req.params;
    const { limit = 100, offset = 0 } = req.query;
    const marketFactoryHash = process.env.MARKET_FACTORY_CONTRACT_HASH;

    if (!marketFactoryHash) {
      return res.status(500).json({
        success: false,
        error: 'Market factory contract not configured',
      });
    }

    // In production, this would query historical funding rate data from storage
    // For now, return recent funding events

    const history = [];
    const now = Math.floor(Date.now() / 1000);
    const fundingInterval = 28800; // 8 hours

    // Generate last 100 funding periods (for demonstration)
    for (let i = 0; i < Math.min(limit, 100); i++) {
      const timestamp = now - (i * fundingInterval);

      try {
        const stateRootHash = await casperClient.nodeClient.getStateRootHash();
        const fundingData = await casperClient.nodeClient.getBlockState(
          stateRootHash,
          `hash-${marketFactoryHash}`,
          [`funding_${assetType}_${timestamp}`]
        );

        if (fundingData && fundingData.CLValue) {
          history.push({
            timestamp,
            fundingRate: fundingData.CLValue.data.funding_rate || 0,
            premiumIndex: fundingData.CLValue.data.premium_index || 0,
            interestRate: fundingData.CLValue.data.interest_rate || 0,
            longOI: fundingData.CLValue.data.long_oi || '0',
            shortOI: fundingData.CLValue.data.short_oi || '0',
          });
        }
      } catch (error) {
        // Skip if funding data not found for this timestamp
        continue;
      }
    }

    res.json({
      success: true,
      count: history.length,
      data: history,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/perps/price/:assetType
 * @desc Get real-time price for a perpetual market
 * @access Public
 */
router.get('/price/:assetType', async (req, res, next) => {
  try {
    const { assetType } = req.params;
    const oracleHash = process.env.ORACLE_CONTRACT_HASH;

    if (!oracleHash) {
      return res.status(500).json({
        success: false,
        error: 'Oracle contract not configured',
      });
    }

    // Get realtime price from oracle
    const stateRootHash = await casperClient.nodeClient.getStateRootHash();
    const priceData = await casperClient.nodeClient.getBlockState(
      stateRootHash,
      `hash-${oracleHash}`,
      [`realtime_price_${assetType}`]
    );

    if (!priceData || !priceData.CLValue) {
      return res.status(404).json({
        success: false,
        error: 'Price data not found',
      });
    }

    const realtimePrice = priceData.CLValue.data;

    res.json({
      success: true,
      data: {
        assetType: parseInt(assetType),
        price: realtimePrice.price || '0',
        timestamp: realtimePrice.timestamp || 0,
        updateInterval: realtimePrice.update_interval || 30,
        sequenceNumber: realtimePrice.sequence_number || 0,
        validator: realtimePrice.validator || '',
        age: Math.floor(Date.now() / 1000) - (realtimePrice.timestamp || 0),
      },
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/perps/price-history/:assetType
 * @desc Get historical prices for charting
 * @access Public
 */
router.get('/price-history/:assetType', async (req, res, next) => {
  try {
    const { assetType } = req.params;
    const { interval = '1h', limit = 100 } = req.query;

    // In production, this would query historical price data
    // For now, return mock data
    const history = [];
    const now = Math.floor(Date.now() / 1000);
    const intervalSeconds = interval === '1m' ? 60 : interval === '5m' ? 300 : interval === '1h' ? 3600 : 86400;

    for (let i = 0; i < limit; i++) {
      history.push({
        timestamp: now - (i * intervalSeconds),
        price: '0', // Would be actual price from storage
        volume: '0',
      });
    }

    res.json({
      success: true,
      interval,
      count: history.length,
      data: history.reverse(),
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/perps/positions/:address
 * @desc Get user's perpetual positions
 * @access Public
 */
router.get('/positions/:address', async (req, res, next) => {
  try {
    const { address } = req.params;
    const { status = 'open' } = req.query;
    const positionManagerHash = process.env.POSITION_MANAGER_CONTRACT_HASH;

    if (!positionManagerHash) {
      return res.status(500).json({
        success: false,
        error: 'Position manager contract not configured',
      });
    }

    // Query user positions from contract
    // In production, this would iterate through user_positions dictionary
    const positions = [];

    // Mock response for now
    res.json({
      success: true,
      count: positions.length,
      data: positions,
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/perps/stats
 * @desc Get overall perpetual markets statistics
 * @access Public
 */
router.get('/stats', async (req, res, next) => {
  try {
    const marketFactoryHash = process.env.MARKET_FACTORY_CONTRACT_HASH;

    if (!marketFactoryHash) {
      return res.status(500).json({
        success: false,
        error: 'Market factory contract not configured',
      });
    }

    // Aggregate stats across all perp markets
    let totalOI = BigInt(0);
    let totalVolume24h = BigInt(0);
    let activeMarkets = 0;

    const perpAssets = [0, 1, 2, 3, 4]; // Gold, Silver, S&P500, Nasdaq, Oil

    for (const assetType of perpAssets) {
      try {
        const stateRootHash = await casperClient.nodeClient.getStateRootHash();
        const perpData = await casperClient.nodeClient.getBlockState(
          stateRootHash,
          `hash-${marketFactoryHash}`,
          [`perp_${assetType}`]
        );

        if (perpData && perpData.CLValue && perpData.CLValue.data.is_active) {
          activeMarkets++;
          const longOI = BigInt(perpData.CLValue.data.total_long_oi || 0);
          const shortOI = BigInt(perpData.CLValue.data.total_short_oi || 0);
          totalOI += longOI + shortOI;
        }
      } catch (error) {
        continue;
      }
    }

    res.json({
      success: true,
      data: {
        totalOpenInterest: totalOI.toString(),
        totalVolume24h: totalVolume24h.toString(),
        activeMarkets,
        avgFundingRate: 0, // Calculate average across markets
        totalPositions: 0, // Count from position manager
      },
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
