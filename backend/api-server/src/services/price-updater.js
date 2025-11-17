const logger = require('../utils/logger');
const { getCurrentOraclePrices } = require('./casper-client');
const { setCached, getCached } = require('../utils/redis');

let priceUpdateInterval = null;

/**
 * Broadcast price updates to WebSocket clients
 */
function broadcastPriceUpdate(priceData) {
  if (!global.wss) {
    return;
  }

  const message = JSON.stringify({
    type: 'price_update',
    data: priceData,
    timestamp: new Date().toISOString()
  });

  global.wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      // Check if client is subscribed to price updates
      if (!client.subscriptions || client.subscriptions.has('prices')) {
        client.send(message);
      }
    }
  });
}

/**
 * Broadcast market updates to WebSocket clients
 */
function broadcastMarketUpdate(marketData) {
  if (!global.wss) {
    return;
  }

  const message = JSON.stringify({
    type: 'market_update',
    data: marketData,
    timestamp: new Date().toISOString()
  });

  global.wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      if (!client.subscriptions || client.subscriptions.has('markets') ||
          client.subscriptions.has(`market:${marketData.id}`)) {
        client.send(message);
      }
    }
  });
}

/**
 * Broadcast position updates to specific user
 */
function broadcastPositionUpdate(userAddress, positionData) {
  if (!global.wss) {
    return;
  }

  const message = JSON.stringify({
    type: 'position_update',
    data: positionData,
    timestamp: new Date().toISOString()
  });

  global.wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      if (client.subscriptions && client.subscriptions.has(`user:${userAddress}`)) {
        client.send(message);
      }
    }
  });
}

/**
 * Fetch and cache current prices
 */
async function updatePrices() {
  try {
    logger.info('Fetching latest oracle prices...');

    const prices = await getCurrentOraclePrices();

    // Cache prices
    await setCached('oracle_prices', prices, 60); // Cache for 60 seconds

    // Broadcast to WebSocket clients
    broadcastPriceUpdate(prices);

    logger.info(`Price update complete: ${Object.keys(prices).length} assets`);

    return prices;
  } catch (error) {
    logger.error('Error updating prices:', error);
    return null;
  }
}

/**
 * Start price update service
 */
function startPriceUpdateService() {
  // Update prices immediately
  updatePrices();

  // Then update every 30 seconds
  priceUpdateInterval = setInterval(() => {
    updatePrices();
  }, 30000);

  logger.info('Price update service started (30s interval)');
}

/**
 * Stop price update service
 */
function stopPriceUpdateService() {
  if (priceUpdateInterval) {
    clearInterval(priceUpdateInterval);
    priceUpdateInterval = null;
    logger.info('Price update service stopped');
  }
}

/**
 * Get cached prices (for API endpoints)
 */
async function getCachedPrices() {
  try {
    const cached = await getCached('oracle_prices');

    if (cached) {
      return cached;
    }

    // If no cache, fetch fresh
    return await updatePrices();
  } catch (error) {
    logger.error('Error getting cached prices:', error);
    return null;
  }
}

module.exports = {
  startPriceUpdateService,
  stopPriceUpdateService,
  updatePrices,
  getCachedPrices,
  broadcastPriceUpdate,
  broadcastMarketUpdate,
  broadcastPositionUpdate
};
