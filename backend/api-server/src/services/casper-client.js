const { CasperClient, CLPublicKey, CLValueBuilder, RuntimeArgs, Contracts } = require('casper-js-sdk');
const logger = require('../utils/logger');

let casperClient = null;
let contractClients = {};

/**
 * Initialize Casper client and contract instances
 */
async function initializeCasperClient() {
  try {
    const nodeUrl = process.env.CASPER_NODE_URL || 'http://localhost:11101/rpc';
    const networkName = process.env.CASPER_NETWORK_NAME || 'casper-test';

    casperClient = new CasperClient(nodeUrl);

    logger.info(`Casper client initialized: ${nodeUrl} (${networkName})`);

    // Initialize contract clients
    initializeContractClients();

    return casperClient;
  } catch (error) {
    logger.error('Failed to initialize Casper client:', error);
    throw error;
  }
}

/**
 * Initialize contract client instances
 */
function initializeContractClients() {
  const contracts = {
    vault: process.env.VAULT_CONTRACT_HASH,
    positionManager: process.env.POSITION_MANAGER_CONTRACT_HASH,
    marketFactory: process.env.MARKET_FACTORY_CONTRACT_HASH,
    oracle: process.env.ORACLE_CONTRACT_HASH,
    settlement: process.env.SETTLEMENT_CONTRACT_HASH,
    liquidityPool: process.env.LIQUIDITY_POOL_CONTRACT_HASH,
    governance: process.env.GOVERNANCE_CONTRACT_HASH,
    yieldFarming: process.env.YIELD_FARMING_CONTRACT_HASH,
  };

  for (const [name, hash] of Object.entries(contracts)) {
    if (hash && hash !== 'hash-xxxxx') {
      contractClients[name] = new Contracts.Contract(casperClient);
      contractClients[name].setContractHash(hash);
      logger.info(`Contract client initialized: ${name}`);
    } else {
      logger.warn(`Contract hash not configured: ${name}`);
    }
  }
}

/**
 * Get Casper client instance
 */
function getCasperClient() {
  if (!casperClient) {
    throw new Error('Casper client not initialized. Call initializeCasperClient() first.');
  }
  return casperClient;
}

/**
 * Get contract client by name
 */
function getContractClient(contractName) {
  if (!contractClients[contractName]) {
    throw new Error(`Contract client not found: ${contractName}`);
  }
  return contractClients[contractName];
}

/**
 * Query contract state
 */
async function queryContractState(contractHash, key) {
  try {
    const client = getCasperClient();
    const stateRootHash = await client.nodeClient.getStateRootHash();

    const result = await client.nodeClient.getBlockState(
      stateRootHash,
      contractHash,
      [key]
    );

    return result;
  } catch (error) {
    logger.error(`Error querying contract state (${contractHash}, ${key}):`, error);
    throw error;
  }
}

/**
 * Query contract dictionary
 */
async function queryContractDictionary(contractHash, dictionaryName, key) {
  try {
    const client = getCasperClient();
    const stateRootHash = await client.nodeClient.getStateRootHash();

    const result = await client.nodeClient.getDictionaryItemByName(
      stateRootHash,
      contractHash,
      dictionaryName,
      key
    );

    return result;
  } catch (error) {
    logger.error(`Error querying contract dictionary (${contractHash}, ${dictionaryName}, ${key}):`, error);
    return null; // Return null instead of throwing for missing dictionary items
  }
}

/**
 * Get all markets
 */
async function getAllMarkets() {
  try {
    const marketFactoryHash = process.env.MARKET_FACTORY_CONTRACT_HASH;

    // Query active markets
    const activeMarkets = await queryContractState(marketFactoryHash, 'active_markets');

    const markets = [];

    // For each market, fetch full details
    // This is a simplified version - in production you'd query each market's state
    const assetTypes = ['Gold', 'Silver', 'Oil', 'S&P500', 'Nasdaq', 'Bitcoin'];

    for (let i = 0; i < assetTypes.length; i++) {
      const marketKey = `market_${assetTypes[i]}_${getCurrentDayTimestamp()}`;

      try {
        const marketData = await queryContractDictionary(
          marketFactoryHash,
          'markets',
          marketKey
        );

        if (marketData) {
          markets.push({
            id: i + 1,
            asset: assetTypes[i],
            marketKey,
            data: marketData
          });
        }
      } catch (error) {
        logger.warn(`Market not found: ${marketKey}`);
      }
    }

    return markets;
  } catch (error) {
    logger.error('Error fetching all markets:', error);
    throw error;
  }
}

/**
 * Get market by ID
 */
async function getMarketById(marketId) {
  try {
    const marketFactoryHash = process.env.MARKET_FACTORY_CONTRACT_HASH;

    const marketData = await queryContractDictionary(
      marketFactoryHash,
      'markets',
      marketId
    );

    return marketData;
  } catch (error) {
    logger.error(`Error fetching market ${marketId}:`, error);
    throw error;
  }
}

/**
 * Get user positions
 */
async function getUserPositions(userAddress) {
  try {
    const positionManagerHash = process.env.POSITION_MANAGER_CONTRACT_HASH;

    // Query user's positions from dictionary
    const positions = await queryContractDictionary(
      positionManagerHash,
      'user_positions',
      userAddress
    );

    return positions || [];
  } catch (error) {
    logger.error(`Error fetching positions for ${userAddress}:`, error);
    throw error;
  }
}

/**
 * Get liquidity pool stats
 */
async function getLiquidityPoolStats() {
  try {
    const liquidityPoolHash = process.env.LIQUIDITY_POOL_CONTRACT_HASH;

    const poolData = await queryContractState(liquidityPoolHash, 'lp_pool');

    return poolData;
  } catch (error) {
    logger.error('Error fetching liquidity pool stats:', error);
    throw error;
  }
}

/**
 * Get user LP info
 */
async function getUserLPInfo(userAddress) {
  try {
    const liquidityPoolHash = process.env.LIQUIDITY_POOL_CONTRACT_HASH;

    const lpInfo = await queryContractDictionary(
      liquidityPoolHash,
      'liquidity_providers',
      userAddress
    );

    return lpInfo;
  } catch (error) {
    logger.error(`Error fetching LP info for ${userAddress}:`, error);
    throw error;
  }
}

/**
 * Get governance proposals
 */
async function getGovernanceProposals() {
  try {
    const governanceHash = process.env.GOVERNANCE_CONTRACT_HASH;

    // In production, you'd query a counter to get total proposals
    // For now, attempt to fetch first 100 proposals
    const proposals = [];

    for (let i = 0; i < 100; i++) {
      try {
        const proposal = await queryContractDictionary(
          governanceHash,
          'proposals',
          i.toString()
        );

        if (proposal) {
          proposals.push({
            id: i,
            ...proposal
          });
        } else {
          break; // No more proposals
        }
      } catch (error) {
        break; // No more proposals
      }
    }

    return proposals;
  } catch (error) {
    logger.error('Error fetching governance proposals:', error);
    throw error;
  }
}

/**
 * Get user staking info
 */
async function getUserStakingInfo(userAddress) {
  try {
    const governanceHash = process.env.GOVERNANCE_CONTRACT_HASH;

    const stakingInfo = await queryContractDictionary(
      governanceHash,
      'staked_positions',
      userAddress
    );

    return stakingInfo;
  } catch (error) {
    logger.error(`Error fetching staking info for ${userAddress}:`, error);
    throw error;
  }
}

/**
 * Get yield farming pools
 */
async function getYieldFarmingPools() {
  try {
    const yieldFarmingHash = process.env.YIELD_FARMING_CONTRACT_HASH;

    // Fetch pool count and then each pool
    const pools = [];

    for (let i = 0; i < 10; i++) { // Assuming max 10 pools
      try {
        const pool = await queryContractDictionary(
          yieldFarmingHash,
          'pools',
          i.toString()
        );

        if (pool) {
          pools.push({
            id: i,
            ...pool
          });
        } else {
          break;
        }
      } catch (error) {
        break;
      }
    }

    return pools;
  } catch (error) {
    logger.error('Error fetching yield farming pools:', error);
    throw error;
  }
}

/**
 * Get user farming positions
 */
async function getUserFarmingPositions(userAddress) {
  try {
    const yieldFarmingHash = process.env.YIELD_FARMING_CONTRACT_HASH;

    const positions = await queryContractDictionary(
      yieldFarmingHash,
      'user_positions',
      userAddress
    );

    return positions || [];
  } catch (error) {
    logger.error(`Error fetching farming positions for ${userAddress}:`, error);
    throw error;
  }
}

/**
 * Get current oracle prices
 */
async function getCurrentOraclePrices() {
  try {
    const oracleHash = process.env.ORACLE_CONTRACT_HASH;

    const assetTypes = [0, 1, 2, 3, 4, 5]; // Gold, Silver, Oil, S&P500, Nasdaq, Bitcoin
    const prices = {};

    for (const assetType of assetTypes) {
      try {
        const price = await queryContractDictionary(
          oracleHash,
          'latest_prices',
          assetType.toString()
        );

        if (price) {
          prices[assetType] = price;
        }
      } catch (error) {
        logger.warn(`No price found for asset type ${assetType}`);
      }
    }

    return prices;
  } catch (error) {
    logger.error('Error fetching oracle prices:', error);
    throw error;
  }
}

/**
 * Helper: Get current day timestamp (00:00 UTC)
 */
function getCurrentDayTimestamp() {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return Math.floor(now.getTime() / 1000);
}

module.exports = {
  initializeCasperClient,
  getCasperClient,
  getContractClient,
  queryContractState,
  queryContractDictionary,
  getAllMarkets,
  getMarketById,
  getUserPositions,
  getLiquidityPoolStats,
  getUserLPInfo,
  getGovernanceProposals,
  getUserStakingInfo,
  getYieldFarmingPools,
  getUserFarmingPositions,
  getCurrentOraclePrices,
  getCurrentDayTimestamp
};
