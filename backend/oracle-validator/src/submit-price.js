/**
 * Submit prices to Casper blockchain oracle contract
 */

const { CasperClient, CLPublicKey, DeployUtil, CLValueBuilder, RuntimeArgs } = require('casper-js-sdk');
const fs = require('fs');
const { logger } = require('./logger');

// Configuration
const NODE_ADDRESS = process.env.CASPER_NODE_ADDRESS || 'http://18.144.176.168:7777';
const CHAIN_NAME = process.env.CASPER_CHAIN_NAME || 'casper-test';
const ORACLE_CONTRACT_HASH = process.env.ORACLE_CONTRACT_HASH;
const VALIDATOR_KEY_PATH = process.env.VALIDATOR_KEY_PATH;

// Asset type mapping (matches smart contract)
const ASSET_TYPES = {
  gold: 0,
  silver: 1,
  sp500: 2,
  nasdaq: 3,
  oil: 4,
  ushousing: 5,
  platinum: 6
};

/**
 * Load validator's private key
 */
function loadValidatorKey() {
  try {
    const keyPairPEM = fs.readFileSync(VALIDATOR_KEY_PATH, 'utf8');
    const privateKey = keyPairPEM; // Simplified - would need actual parsing
    return privateKey;
  } catch (error) {
    logger.error('Failed to load validator key:', error.message);
    throw error;
  }
}

/**
 * Submit a price for a single asset
 */
async function submitAssetPrice(client, assetName, price, targetTimestamp) {
  try {
    const assetType = ASSET_TYPES[assetName];
    if (assetType === undefined) {
      throw new Error(`Unknown asset: ${assetName}`);
    }

    // Convert price to fixed-point (multiply by 1e9 for 9 decimals)
    const priceU256 = Math.floor(price * 1e9);

    // Build runtime arguments
    const runtimeArgs = RuntimeArgs.fromMap({
      asset_type: CLValueBuilder.u8(assetType),
      price: CLValueBuilder.u256(priceU256),
      data_sources: CLValueBuilder.u8(7), // Bitmap: 0b111 = 3 sources
      target_timestamp: CLValueBuilder.u64(targetTimestamp)
    });

    // Create deploy
    const deploy = DeployUtil.makeDeploy(
      new DeployUtil.DeployParams(
        CLPublicKey.fromHex(/* validator public key */),
        CHAIN_NAME,
        1, // Gas price
        1800000 // TTL (30 minutes)
      ),
      DeployUtil.ExecutableDeployItem.newStoredContractByHash(
        Buffer.from(ORACLE_CONTRACT_HASH, 'hex'),
        'submit_price',
        runtimeArgs
      ),
      DeployUtil.standardPayment(3000000000) // 3 CSPR payment
    );

    // Sign deploy
    const signedDeploy = deploy; // Would need actual signing

    // Send to network
    const deployHash = await client.putDeploy(signedDeploy);

    logger.info(`✅ Submitted ${assetName} price: $${price} (deploy: ${deployHash})`);

    return {
      success: true,
      deployHash,
      price
    };
  } catch (error) {
    logger.error(`❌ Failed to submit ${assetName} price:`, error.message);
    return {
      success: false,
      error: error.message,
      price
    };
  }
}

/**
 * Submit all prices to blockchain
 */
async function submitPrices(prices) {
  const client = new CasperClient(NODE_ADDRESS);
  const targetTimestamp = Math.floor(Date.now() / 1000);

  logger.info('📤 Submitting prices to Casper blockchain...');

  const results = {};

  for (const [assetName, price] of Object.entries(prices)) {
    results[assetName] = await submitAssetPrice(
      client,
      assetName,
      price,
      targetTimestamp
    );

    // Wait 2 seconds between submissions to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  return results;
}

module.exports = {
  submitPrices,
  submitAssetPrice
};
