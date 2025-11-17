/**
 * RWperp Settlement Keeper Bot
 *
 * Triggers daily market settlements at 00:00 UTC.
 * Ensures all positions are settled and new markets are created.
 */

const cron = require('node-cron');
const { settleAllMarkets } = require('./settler');
const { logger } = require('./logger');
const { getActiveMarkets } = require('./market-tracker');

// Configuration
const SETTLEMENT_SCHEDULE = process.env.SETTLEMENT_SCHEDULE || '5 0 * * *'; // 00:05 UTC (5 min after markets close)
const KEEPER_KEY_PATH = process.env.KEEPER_KEY_PATH;
const SETTLEMENT_CONTRACT_HASH = process.env.SETTLEMENT_CONTRACT_HASH;

/**
 * Main settlement job
 */
async function runDailySettlement() {
  try {
    logger.info('🔄 Starting daily settlement process...');

    // 1. Get list of active markets
    const markets = await getActiveMarkets();
    logger.info(`Found ${markets.length} active markets to settle`);

    if (markets.length === 0) {
      logger.warn('No active markets found - skipping settlement');
      return;
    }

    // 2. Trigger settlement
    const result = await settleAllMarkets(markets);

    if (result.success) {
      logger.info('✅ Settlement complete!');
      logger.info(`   Markets settled: ${result.settledCount}`);
      logger.info(`   Deploy hash: ${result.deployHash}`);
      logger.info(`   Gas used: ${result.gasUsed || 'N/A'}`);
    } else {
      logger.error('❌ Settlement failed:', result.error);

      // Retry logic
      logger.info('🔄 Retrying in 5 minutes...');
      setTimeout(runDailySettlement, 5 * 60 * 1000);
    }
  } catch (error) {
    logger.error('❌ Settlement error:', error);
  }
}

/**
 * Health check - verify keeper is ready
 */
async function healthCheck() {
  try {
    if (!KEEPER_KEY_PATH) {
      throw new Error('KEEPER_KEY_PATH not configured');
    }

    if (!SETTLEMENT_CONTRACT_HASH) {
      throw new Error('SETTLEMENT_CONTRACT_HASH not configured');
    }

    logger.info('✅ Health check passed');
    return true;
  } catch (error) {
    logger.error('❌ Health check failed:', error.message);
    return false;
  }
}

/**
 * Initialize settlement keeper
 */
async function init() {
  logger.info('🚀 RWperp Settlement Keeper Starting...');
  logger.info(`   Schedule: ${SETTLEMENT_SCHEDULE}`);
  logger.info(`   Settlement Contract: ${SETTLEMENT_CONTRACT_HASH}`);

  // Health check
  const healthy = await healthCheck();
  if (!healthy) {
    logger.error('❌ Keeper not healthy - exiting');
    process.exit(1);
  }

  // Schedule daily settlements
  cron.schedule(SETTLEMENT_SCHEDULE, runDailySettlement);
  logger.info('✅ Settlement keeper scheduled');

  // Run once on startup for testing
  if (process.env.RUN_ON_STARTUP === 'true') {
    logger.info('🔄 Running initial settlement...');
    await runDailySettlement();
  }

  logger.info('✅ Settlement keeper running. Press Ctrl+C to stop.');
}

// Start the service
init().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('👋 Shutting down settlement keeper...');
  process.exit(0);
});

module.exports = { runDailySettlement };
