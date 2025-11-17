/**
 * RWperp Oracle Validator Service
 *
 * Fetches real-world asset prices from multiple sources and submits to Casper blockchain.
 * Runs as a validator node in the decentralized oracle network.
 */

const cron = require('node-cron');
const { fetchAllPrices } = require('./price-fetcher');
const { submitPrices } = require('./submit-price');
const { logger } = require('./logger');

// Configuration
const SUBMISSION_SCHEDULE = process.env.SUBMISSION_SCHEDULE || '0 0 * * *'; // Daily at 00:00 UTC
const VALIDATOR_KEY_PATH = process.env.VALIDATOR_KEY_PATH;
const ORACLE_CONTRACT_HASH = process.env.ORACLE_CONTRACT_HASH;

/**
 * Main oracle submission job
 */
async function runOracleSubmission() {
  try {
    logger.info('🔄 Starting oracle price submission...');

    // 1. Fetch prices from all sources
    const prices = await fetchAllPrices();
    logger.info(`✅ Fetched ${Object.keys(prices).length} prices`);

    // 2. Submit to blockchain
    const results = await submitPrices(prices);
    logger.info(`✅ Submitted prices to blockchain`);

    // 3. Log results
    for (const [asset, result] of Object.entries(results)) {
      if (result.success) {
        logger.info(`  ✓ ${asset}: $${result.price} (deploy: ${result.deployHash})`);
      } else {
        logger.error(`  ✗ ${asset}: Failed - ${result.error}`);
      }
    }

    logger.info('✅ Oracle submission complete');
  } catch (error) {
    logger.error('❌ Oracle submission failed:', error);
  }
}

/**
 * Initialize oracle validator
 */
async function init() {
  logger.info('🚀 RWperp Oracle Validator Starting...');
  logger.info(`   Schedule: ${SUBMISSION_SCHEDULE}`);
  logger.info(`   Oracle Contract: ${ORACLE_CONTRACT_HASH}`);

  // Validate configuration
  if (!VALIDATOR_KEY_PATH) {
    logger.error('❌ VALIDATOR_KEY_PATH not set in environment');
    process.exit(1);
  }

  if (!ORACLE_CONTRACT_HASH) {
    logger.error('❌ ORACLE_CONTRACT_HASH not set in environment');
    process.exit(1);
  }

  // Schedule daily price submissions
  cron.schedule(SUBMISSION_SCHEDULE, runOracleSubmission);
  logger.info('✅ Oracle validator scheduled');

  // Run once on startup for testing
  if (process.env.RUN_ON_STARTUP === 'true') {
    logger.info('🔄 Running initial submission...');
    await runOracleSubmission();
  }

  logger.info('✅ Oracle validator running. Press Ctrl+C to stop.');
}

// Start the service
init().catch(error => {
  logger.error('Fatal error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('👋 Shutting down oracle validator...');
  process.exit(0);
});

module.exports = { runOracleSubmission };
