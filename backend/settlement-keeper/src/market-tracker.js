/**
 * Market tracker - keeps track of active markets
 */

const { CasperClient, CLPublicKey } = require('casper-js-sdk');
const { logger } = require('./logger');

const NODE_ADDRESS = process.env.CASPER_NODE_ADDRESS || 'http://18.144.176.168:7777';
const MARKET_FACTORY_HASH = process.env.MARKET_FACTORY_HASH;

/**
 * Get list of active markets from blockchain
 */
async function getActiveMarkets() {
  try {
    // In production, would query the blockchain for active markets
    // For now, returning mock data

    const markets = [
      { key: 'gold_2024_11_17', assetType: 0, name: 'Gold' },
      { key: 'silver_2024_11_17', assetType: 1, name: 'Silver' },
      { key: 'sp500_2024_11_17', assetType: 2, name: 'S&P 500' },
      { key: 'nasdaq_2024_11_17', assetType: 3, name: 'NASDAQ' },
      { key: 'oil_2024_11_17', assetType: 4, name: 'Oil' },
    ];

    logger.debug(`Found ${markets.length} active markets`);
    return markets;
  } catch (error) {
    logger.error('Failed to get active markets:', error);
    return [];
  }
}

/**
 * Check if a market needs settlement
 */
async function needsSettlement(marketKey) {
  try {
    // Query market state from blockchain
    // Check if current time >= settlement_time
    // Return true if needs settlement

    return true; // Mock
  } catch (error) {
    logger.error(`Failed to check settlement status for ${marketKey}:`, error);
    return false;
  }
}

module.exports = {
  getActiveMarkets,
  needsSettlement
};
