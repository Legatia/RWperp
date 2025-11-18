#!/usr/bin/env node
/**
 * Funding Keeper Service
 *
 * Triggers funding rate calculations and payments every 8 hours
 * for continuous perpetual markets.
 *
 * Funding Times: 00:00, 08:00, 16:00 UTC
 *
 * Process:
 * 1. Calculate funding rate for each perp market
 * 2. Call pay_funding() on market-factory
 * 3. Call apply_funding_batch() on position-manager
 * 4. Log funding events
 *
 * Usage:
 *   node funding-keeper.js
 *
 * Environment Variables:
 *   MARKET_FACTORY_CONTRACT_HASH - Market factory contract hash
 *   POSITION_MANAGER_CONTRACT_HASH - Position manager contract hash
 *   KEEPER_PRIVATE_KEY_PATH - Keeper's private key
 *   CASPER_NODE_URL - Casper node RPC URL
 */

const { CasperClient, CLPublicKey, DeployUtil, CLValueBuilder, RuntimeArgs } = require('casper-js-sdk');
const { Keys } = require('casper-js-sdk');
const cron = require('node-cron');

// Configuration
const config = {
  marketFactoryContractHash: process.env.MARKET_FACTORY_CONTRACT_HASH,
  positionManagerContractHash: process.env.POSITION_MANAGER_CONTRACT_HASH,
  keeperPrivateKeyPath: process.env.KEEPER_PRIVATE_KEY_PATH,
  casperNodeUrl: process.env.CASPER_NODE_URL || 'http://localhost:11101/rpc',
  chainName: process.env.CASPER_CHAIN_NAME || 'casper-test',
  gasPrice: 1,
  ttl: 1800000, // 30 minutes
  fundingInterval: 28800, // 8 hours in seconds
};

// Asset types for continuous perps
const PERP_ASSETS = [
  { type: 0, name: 'Gold', symbol: 'XAU/USD' },
  { type: 1, name: 'Silver', symbol: 'XAG/USD' },
  { type: 2, name: 'S&P 500', symbol: 'SPX' },
  { type: 3, name: 'Nasdaq 100', symbol: 'NDX' },
  { type: 4, name: 'Crude Oil (WTI)', symbol: 'WTI' },
];

// Casper client
let casperClient;
let keeperKeys;

// Funding history
const fundingHistory = [];

/**
 * Initialize service
 */
async function initialize() {
  console.log('🚀 Initializing Funding Keeper Service...');
  console.log(`Chain: ${config.chainName}`);
  console.log(`Node: ${config.casperNodeUrl}`);
  console.log(`Funding Interval: ${config.fundingInterval}s (8 hours)`);
  console.log(`Funding Times: 00:00, 08:00, 16:00 UTC`);
  console.log('');

  // Initialize Casper client
  casperClient = new CasperClient(config.casperNodeUrl);

  // Load keeper keys
  if (config.keeperPrivateKeyPath) {
    keeperKeys = Keys.Ed25519.loadKeyPairFromPrivateFile(config.keeperPrivateKeyPath);
    console.log(`✓ Loaded keeper keys: ${keeperKeys.publicKey.toHex()}`);
  } else {
    console.warn('⚠ No keeper private key provided. Running in simulation mode.');
  }

  console.log('✓ Funding Keeper Service initialized\n');
}

/**
 * Check if it's time for funding (00:00, 08:00, 16:00 UTC)
 */
function isFundingTime() {
  const now = new Date();
  const hours = now.getUTCHours();
  return hours % 8 === 0 && now.getUTCMinutes() === 0;
}

/**
 * Get next funding time
 */
function getNextFundingTime() {
  const now = new Date();
  const currentHour = now.getUTCHours();

  let nextHour;
  if (currentHour < 8) nextHour = 8;
  else if (currentHour < 16) nextHour = 16;
  else nextHour = 24; // 00:00 next day

  const next = new Date(now);
  next.setUTCHours(nextHour === 24 ? 0 : nextHour, 0, 0, 0);
  if (nextHour === 24) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next;
}

/**
 * Call pay_funding on market-factory contract
 */
async function payFunding(assetType) {
  if (!keeperKeys) {
    console.log(`[SIMULATION] Would call pay_funding for asset ${assetType}`);
    return { success: true, deployHash: 'simulation', fundingRate: 0 };
  }

  try {
    const args = RuntimeArgs.fromMap({
      asset_type: CLValueBuilder.u8(assetType),
    });

    const deploy = DeployUtil.makeDeploy(
      new DeployUtil.DeployParams(
        keeperKeys.publicKey,
        config.chainName,
        config.gasPrice,
        config.ttl
      ),
      DeployUtil.ExecutableDeployItem.newStoredContractByHash(
        Uint8Array.from(Buffer.from(config.marketFactoryContractHash, 'hex')),
        'pay_funding',
        args
      ),
      DeployUtil.standardPayment(5000000000) // 5 CSPR
    );

    const signedDeploy = deploy.sign([keeperKeys]);
    const deployHash = await casperClient.putDeploy(signedDeploy);

    console.log(`  ✓ pay_funding() called for asset ${assetType} (deploy: ${deployHash})`);

    // Wait for deploy to finalize
    await new Promise(resolve => setTimeout(resolve, 5000));

    // TODO: Fetch funding rate from deploy result
    const fundingRate = 0; // Placeholder

    return { success: true, deployHash, fundingRate };
  } catch (error) {
    console.error(`  ✗ Failed to call pay_funding for asset ${assetType}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Apply funding to all positions for an asset
 */
async function applyFundingBatch(assetType, fundingRate) {
  if (!keeperKeys) {
    console.log(`[SIMULATION] Would call apply_funding_batch for asset ${assetType} with rate ${fundingRate}`);
    return { success: true, deployHash: 'simulation' };
  }

  try {
    const args = RuntimeArgs.fromMap({
      asset_type: CLValueBuilder.u8(assetType),
      funding_rate: CLValueBuilder.i64(fundingRate),
    });

    const deploy = DeployUtil.makeDeploy(
      new DeployUtil.DeployParams(
        keeperKeys.publicKey,
        config.chainName,
        config.gasPrice,
        config.ttl
      ),
      DeployUtil.ExecutableDeployItem.newStoredContractByHash(
        Uint8Array.from(Buffer.from(config.positionManagerContractHash, 'hex')),
        'apply_funding_batch',
        args
      ),
      DeployUtil.standardPayment(10000000000) // 10 CSPR (more gas for batch operation)
    );

    const signedDeploy = deploy.sign([keeperKeys]);
    const deployHash = await casperClient.putDeploy(signedDeploy);

    console.log(`  ✓ apply_funding_batch() called for asset ${assetType} (deploy: ${deployHash})`);

    return { success: true, deployHash };
  } catch (error) {
    console.error(`  ✗ Failed to call apply_funding_batch for asset ${assetType}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Execute funding for a single asset
 */
async function executeFundingForAsset(asset) {
  console.log(`\n💰 Processing funding for ${asset.name} (${asset.symbol})...`);

  // Step 1: Calculate and pay funding
  const fundingResult = await payFunding(asset.type);

  if (!fundingResult.success) {
    console.error(`  ✗ Funding failed for ${asset.name}`);
    return { asset: asset.name, success: false };
  }

  const fundingRate = fundingResult.fundingRate;
  console.log(`  📊 Funding Rate: ${fundingRate} bps (${(fundingRate / 100).toFixed(4)}%)`);

  // Step 2: Apply funding to all positions
  const batchResult = await applyFundingBatch(asset.type, fundingRate);

  if (!batchResult.success) {
    console.error(`  ✗ Batch funding application failed for ${asset.name}`);
    return { asset: asset.name, success: false, fundingRate };
  }

  console.log(`  ✓ Funding complete for ${asset.name}`);

  return {
    asset: asset.name,
    assetType: asset.type,
    success: true,
    fundingRate,
    timestamp: Date.now(),
  };
}

/**
 * Execute funding for all perpetual markets
 */
async function executeFundingCycle() {
  const startTime = Date.now();

  console.log('\n========================================');
  console.log('🔄 FUNDING CYCLE STARTED');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('========================================\n');

  const results = [];

  // Process each asset sequentially to avoid gas conflicts
  for (const asset of PERP_ASSETS) {
    const result = await executeFundingForAsset(asset);
    results.push(result);

    // Wait between assets to avoid nonce conflicts
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Log summary
  const successCount = results.filter(r => r.success).length;
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n========================================');
  console.log('✅ FUNDING CYCLE COMPLETE');
  console.log(`Duration: ${duration}s`);
  console.log(`Success: ${successCount}/${PERP_ASSETS.length} assets`);
  console.log('========================================\n');

  // Store in history
  fundingHistory.push({
    timestamp: startTime,
    results,
    duration: parseFloat(duration),
  });

  // Keep only last 30 entries
  if (fundingHistory.length > 30) {
    fundingHistory.shift();
  }

  // Log next funding time
  const nextFunding = getNextFundingTime();
  console.log(`⏰ Next funding: ${nextFunding.toISOString()}\n`);

  return results;
}

/**
 * Check and execute funding if needed
 */
async function checkAndExecuteFunding() {
  const now = new Date();
  const hours = now.getUTCHours();
  const minutes = now.getUTCMinutes();

  // Execute at 00:00, 08:00, 16:00 UTC
  if (minutes === 0 && (hours === 0 || hours === 8 || hours === 16)) {
    await executeFundingCycle();
  }
}

/**
 * Main service loop
 */
async function main() {
  await initialize();

  console.log('🔄 Starting Funding Keeper Service...\n');

  // Show next funding time
  const nextFunding = getNextFundingTime();
  console.log(`⏰ Next funding: ${nextFunding.toISOString()}\n`);

  // Option 1: Use cron for precise timing (recommended)
  if (process.env.USE_CRON !== 'false') {
    console.log('📅 Using cron scheduler (00:00, 08:00, 16:00 UTC)');

    // Run at 00:00 UTC
    cron.schedule('0 0 * * *', async () => {
      await executeFundingCycle();
    }, {
      timezone: 'UTC'
    });

    // Run at 08:00 UTC
    cron.schedule('0 8 * * *', async () => {
      await executeFundingCycle();
    }, {
      timezone: 'UTC'
    });

    // Run at 16:00 UTC
    cron.schedule('0 16 * * *', async () => {
      await executeFundingCycle();
    }, {
      timezone: 'UTC'
    });

    console.log('✓ Cron jobs scheduled\n');
  } else {
    // Option 2: Simple interval check (fallback)
    console.log('📅 Using interval checker (checks every minute)');

    setInterval(async () => {
      await checkAndExecuteFunding();
    }, 60000); // Check every minute

    console.log('✓ Interval checker started\n');
  }

  console.log('✓ Funding Keeper Service running');
  console.log('Press Ctrl+C to stop\n');

  // Optionally run immediately for testing
  if (process.env.RUN_IMMEDIATELY === 'true') {
    console.log('⚡ Running funding cycle immediately (test mode)...\n');
    await executeFundingCycle();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping Funding Keeper Service...');
  console.log(`Total funding cycles executed: ${fundingHistory.length}`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n🛑 Stopping Funding Keeper Service...');
  console.log(`Total funding cycles executed: ${fundingHistory.length}`);
  process.exit(0);
});

// Start service
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { executeFundingCycle, executeFundingForAsset, PERP_ASSETS };
