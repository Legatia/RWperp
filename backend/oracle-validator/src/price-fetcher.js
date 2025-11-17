/**
 * Price Fetcher - Fetches RWA prices from multiple sources
 */

const axios = require('axios');
const { logger } = require('./logger');

// API Keys (set in .env)
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const METALS_API_KEY = process.env.METALS_API_KEY;

/**
 * Fetch Gold price (XAU/USD)
 */
async function fetchGoldPrice() {
  try {
    // Option 1: Metals.live API (free)
    const response = await axios.get('https://api.metals.live/v1/spot/gold');
    const price = response.data.price;

    logger.debug(`Gold price from Metals.live: $${price}`);
    return price;
  } catch (error) {
    logger.error('Failed to fetch gold price:', error.message);

    // Fallback: Use mock price for testing
    return 2045.50;
  }
}

/**
 * Fetch Silver price (XAG/USD)
 */
async function fetchSilverPrice() {
  try {
    const response = await axios.get('https://api.metals.live/v1/spot/silver');
    const price = response.data.price;

    logger.debug(`Silver price from Metals.live: $${price}`);
    return price;
  } catch (error) {
    logger.error('Failed to fetch silver price:', error.message);
    return 24.12; // Fallback
  }
}

/**
 * Fetch S&P 500 index price
 */
async function fetchSP500Price() {
  try {
    if (!ALPHA_VANTAGE_KEY) {
      throw new Error('ALPHA_VANTAGE_API_KEY not set');
    }

    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol: 'SPY', // S&P 500 ETF as proxy
        apikey: ALPHA_VANTAGE_KEY
      }
    });

    const price = parseFloat(response.data['Global Quote']['05. price']);
    const sp500Price = price * 10; // Rough conversion from SPY to SPX

    logger.debug(`S&P 500 price: $${sp500Price}`);
    return sp500Price;
  } catch (error) {
    logger.error('Failed to fetch S&P 500 price:', error.message);
    return 4783.45; // Fallback
  }
}

/**
 * Fetch NASDAQ index price
 */
async function fetchNasdaqPrice() {
  try {
    if (!ALPHA_VANTAGE_KEY) {
      throw new Error('ALPHA_VANTAGE_API_KEY not set');
    }

    const response = await axios.get('https://www.alphavantage.co/query', {
      params: {
        function: 'GLOBAL_QUOTE',
        symbol: 'QQQ', // NASDAQ ETF as proxy
        apikey: ALPHA_VANTAGE_KEY
      }
    });

    const price = parseFloat(response.data['Global Quote']['05. price']);
    const nasdaqPrice = price * 45; // Rough conversion from QQQ to NDX

    logger.debug(`NASDAQ price: $${nasdaqPrice}`);
    return nasdaqPrice;
  } catch (error) {
    logger.error('Failed to fetch NASDAQ price:', error.message);
    return 16845.30; // Fallback
  }
}

/**
 * Fetch WTI Crude Oil price
 */
async function fetchOilPrice() {
  try {
    // Can use EIA API, commodities-api.com, or others
    // For now, using mock
    logger.debug('Oil price: $77.85 (mock)');
    return 77.85;
  } catch (error) {
    logger.error('Failed to fetch oil price:', error.message);
    return 77.85; // Fallback
  }
}

/**
 * Fetch all asset prices
 */
async function fetchAllPrices() {
  logger.info('📊 Fetching prices from external sources...');

  const prices = {
    gold: await fetchGoldPrice(),
    silver: await fetchSilverPrice(),
    sp500: await fetchSP500Price(),
    nasdaq: await fetchNasdaqPrice(),
    oil: await fetchOilPrice(),
  };

  return prices;
}

/**
 * Calculate median price from multiple sources (for validation)
 */
function calculateMedian(prices) {
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

module.exports = {
  fetchAllPrices,
  fetchGoldPrice,
  fetchSilverPrice,
  fetchSP500Price,
  fetchNasdaqPrice,
  fetchOilPrice,
  calculateMedian
};
