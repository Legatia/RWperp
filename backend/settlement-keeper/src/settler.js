/**
 * Settlement logic - interacts with Casper blockchain
 */

const { CasperClient, CLPublicKey, DeployUtil, RuntimeArgs, CLValueBuilder } = require('casper-js-sdk');
const { logger } = require('./logger');

const NODE_ADDRESS = process.env.CASPER_NODE_ADDRESS || 'http://18.144.176.168:7777';
const CHAIN_NAME = process.env.CASPER_CHAIN_NAME || 'casper-test';
const SETTLEMENT_CONTRACT_HASH = process.env.SETTLEMENT_CONTRACT_HASH;

/**
 * Settle all active markets
 */
async function settleAllMarkets(markets) {
  try {
    const client = new CasperClient(NODE_ADDRESS);
    const targetTimestamp = Math.floor(Date.now() / 1000);

    // Extract market keys and asset types
    const marketKeys = markets.map(m => m.key);
    const assetTypes = markets.map(m => m.assetType);

    logger.info(`📤 Settling ${markets.length} markets...`);

    // Build runtime arguments
    const runtimeArgs = RuntimeArgs.fromMap({
      market_keys: CLValueBuilder.list(marketKeys.map(k => CLValueBuilder.string(k))),
      asset_types: CLValueBuilder.list(assetTypes.map(t => CLValueBuilder.u8(t))),
      target_timestamp: CLValueBuilder.u64(targetTimestamp)
    });

    // Create deploy
    const deploy = DeployUtil.makeDeploy(
      new DeployUtil.DeployParams(
        CLPublicKey.fromHex(/* keeper public key */),
        CHAIN_NAME,
        1,
        1800000
      ),
      DeployUtil.ExecutableDeployItem.newStoredContractByHash(
        Buffer.from(SETTLEMENT_CONTRACT_HASH, 'hex'),
        'settle_all_markets',
        runtimeArgs
      ),
      DeployUtil.standardPayment(10000000000) // 10 CSPR for settlement
    );

    // Sign and send
    const signedDeploy = deploy; // Would need actual signing
    const deployHash = await client.putDeploy(signedDeploy);

    logger.info(`✅ Settlement deploy sent: ${deployHash}`);

    // Wait for execution (optional)
    // const result = await client.waitForDeploy(signedDeploy, 180000);

    return {
      success: true,
      deployHash,
      settledCount: markets.length
    };
  } catch (error) {
    logger.error('Settlement failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Settle a single market (for manual intervention)
 */
async function settleSingleMarket(marketKey, assetType) {
  try {
    const client = new CasperClient(NODE_ADDRESS);
    const targetTimestamp = Math.floor(Date.now() / 1000);

    const runtimeArgs = RuntimeArgs.fromMap({
      market_key: CLValueBuilder.string(marketKey),
      asset_type: CLValueBuilder.u8(assetType),
      target_timestamp: CLValueBuilder.u64(targetTimestamp)
    });

    const deploy = DeployUtil.makeDeploy(
      new DeployUtil.DeployParams(
        CLPublicKey.fromHex(/* keeper public key */),
        CHAIN_NAME,
        1,
        1800000
      ),
      DeployUtil.ExecutableDeployItem.newStoredContractByHash(
        Buffer.from(SETTLEMENT_CONTRACT_HASH, 'hex'),
        'settle_market',
        runtimeArgs
      ),
      DeployUtil.standardPayment(5000000000)
    );

    const signedDeploy = deploy;
    const deployHash = await client.putDeploy(signedDeploy);

    logger.info(`✅ Single market settlement: ${deployHash}`);

    return {
      success: true,
      deployHash
    };
  } catch (error) {
    logger.error('Single market settlement failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  settleAllMarkets,
  settleSingleMarket
};
