const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { getCached, setCached } = require('../utils/redis');
const { getYieldFarmingPools, getUserFarmingPositions } = require('../services/casper-client');

/**
 * GET /api/staking/pools
 * Get all staking/farming pools
 */
router.get('/pools', async (req, res, next) => {
  try {
    const cacheKey = 'staking:pools:all';
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Fetch from blockchain
    const pools = await getYieldFarmingPools();

    // Enrich with calculated APR
    const enrichedPools = pools.map(pool => {
      // Calculate APR based on rewards per second and pool TVL
      // APR = (reward_per_second * 365 * 24 * 3600 * token_price / tvl) * 100
      const yearlyRewards = pool.reward_per_second * 365 * 24 * 3600;
      const apr = pool.total_staked > 0
        ? (yearlyRewards / pool.total_staked) * 100
        : 0;

      return {
        id: pool.id,
        name: pool.name,
        stakingToken: pool.staking_token,
        rewardToken: pool.reward_token,
        totalStaked: pool.total_staked,
        rewardPerSecond: pool.reward_per_second,
        apr,
        startTime: pool.start_time,
        endTime: pool.end_time,
        lastRewardTime: pool.last_reward_time,
        accumulatedRewardPerShare: pool.accumulated_reward_per_share,
        isActive: pool.is_active,
        minStake: pool.min_stake || 0,
        lockPeriod: pool.lock_period || 0,
        lastUpdated: new Date().toISOString()
      };
    });

    const response = {
      success: true,
      count: enrichedPools.length,
      data: enrichedPools
    };

    // Cache for 1 minute
    await setCached(cacheKey, response, 60);

    res.json(response);
  } catch (error) {
    logger.error('Error fetching staking pools:', error);
    next(error);
  }
});

/**
 * GET /api/staking/pools/:id
 * Get specific pool details
 */
router.get('/pools/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const cacheKey = `staking:pool:${id}`;
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Fetch all pools
    const pools = await getYieldFarmingPools();

    // Find specific pool
    const pool = pools.find(p => p.id === parseInt(id));

    if (!pool) {
      return res.status(404).json({
        success: false,
        error: 'Pool not found'
      });
    }

    // Calculate APR
    const yearlyRewards = pool.reward_per_second * 365 * 24 * 3600;
    const apr = pool.total_staked > 0
      ? (yearlyRewards / pool.total_staked) * 100
      : 0;

    const enrichedPool = {
      id: pool.id,
      name: pool.name,
      stakingToken: pool.staking_token,
      rewardToken: pool.reward_token,
      totalStaked: pool.total_staked,
      rewardPerSecond: pool.reward_per_second,
      apr,
      startTime: pool.start_time,
      endTime: pool.end_time,
      lastRewardTime: pool.last_reward_time,
      accumulatedRewardPerShare: pool.accumulated_reward_per_share,
      isActive: pool.is_active,
      minStake: pool.min_stake || 0,
      lockPeriod: pool.lock_period || 0,
      stakerCount: pool.staker_count || 0,
      totalRewardsDistributed: pool.total_rewards_distributed || 0,
      lastUpdated: new Date().toISOString()
    };

    const response = {
      success: true,
      data: enrichedPool
    };

    // Cache for 1 minute
    await setCached(cacheKey, response, 60);

    res.json(response);
  } catch (error) {
    logger.error(`Error fetching pool ${req.params.id}:`, error);
    next(error);
  }
});

/**
 * GET /api/staking/:address
 * Get all staking positions for a user
 */
router.get('/:address', async (req, res, next) => {
  try {
    const { address } = req.params;

    if (!address || address.length < 64) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Casper address'
      });
    }

    const cacheKey = `staking:user:${address}`;
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Fetch user positions
    const positions = await getUserFarmingPositions(address);

    if (!positions || positions.length === 0) {
      return res.json({
        success: true,
        address,
        count: 0,
        data: [],
        summary: {
          totalStaked: 0,
          totalPendingRewards: 0,
          activePositions: 0
        }
      });
    }

    // Get pool data for APR calculations
    const pools = await getYieldFarmingPools();

    // Enrich positions
    const enrichedPositions = positions.map(position => {
      const pool = pools.find(p => p.id === position.pool_id);

      // Calculate pending rewards
      // pending = (user_stake * (acc_reward_per_share - user_reward_debt)) / 1e18
      const pending = pool
        ? (position.staked_amount * (pool.accumulated_reward_per_share - position.reward_debt)) / 1e18
        : 0;

      const totalRewards = position.pending_rewards + pending;

      return {
        poolId: position.pool_id,
        poolName: pool?.name || 'Unknown',
        stakedAmount: position.staked_amount,
        stakeTimestamp: position.stake_timestamp,
        pendingRewards: totalRewards,
        rewardDebt: position.reward_debt,
        unlockTime: position.unlock_time || null,
        isLocked: position.unlock_time ? Date.now() / 1000 < position.unlock_time : false,
        lastUpdated: new Date().toISOString()
      };
    });

    const summary = {
      totalStaked: enrichedPositions.reduce((sum, p) => sum + parseFloat(p.stakedAmount), 0),
      totalPendingRewards: enrichedPositions.reduce((sum, p) => sum + p.pendingRewards, 0),
      activePositions: enrichedPositions.length
    };

    const response = {
      success: true,
      address,
      count: enrichedPositions.length,
      data: enrichedPositions,
      summary
    };

    // Cache for 10 seconds
    await setCached(cacheKey, response, 10);

    res.json(response);
  } catch (error) {
    logger.error(`Error fetching staking positions for ${req.params.address}:`, error);
    next(error);
  }
});

/**
 * GET /api/staking/:address/:poolId
 * Get specific staking position
 */
router.get('/:address/:poolId', async (req, res, next) => {
  try {
    const { address, poolId } = req.params;

    const cacheKey = `staking:user:${address}:pool:${poolId}`;
    const cached = await getCached(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    // Fetch all user positions
    const positions = await getUserFarmingPositions(address);

    // Find specific position
    const position = positions.find(p => p.pool_id === parseInt(poolId));

    if (!position) {
      return res.status(404).json({
        success: false,
        error: 'Staking position not found'
      });
    }

    // Get pool data
    const pools = await getYieldFarmingPools();
    const pool = pools.find(p => p.id === parseInt(poolId));

    // Calculate pending rewards
    const pending = pool
      ? (position.staked_amount * (pool.accumulated_reward_per_share - position.reward_debt)) / 1e18
      : 0;

    const enrichedPosition = {
      poolId: position.pool_id,
      poolName: pool?.name || 'Unknown',
      stakedAmount: position.staked_amount,
      stakeTimestamp: position.stake_timestamp,
      pendingRewards: position.pending_rewards + pending,
      rewardDebt: position.reward_debt,
      unlockTime: position.unlock_time || null,
      isLocked: position.unlock_time ? Date.now() / 1000 < position.unlock_time : false,
      apr: pool ? (pool.reward_per_second * 365 * 24 * 3600 / pool.total_staked) * 100 : 0,
      estimatedDailyRewards: pool
        ? (position.staked_amount / pool.total_staked) * pool.reward_per_second * 86400
        : 0,
      lastUpdated: new Date().toISOString()
    };

    const response = {
      success: true,
      address,
      data: enrichedPosition
    };

    // Cache for 10 seconds
    await setCached(cacheKey, response, 10);

    res.json(response);
  } catch (error) {
    logger.error(`Error fetching staking position for ${req.params.address} in pool ${req.params.poolId}:`, error);
    next(error);
  }
});

module.exports = router;
