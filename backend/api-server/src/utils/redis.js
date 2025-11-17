const redis = require('redis');
const logger = require('./logger');

let redisClient = null;

/**
 * Initialize Redis client
 */
async function initializeRedis() {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection failed after 10 attempts');
            return new Error('Redis reconnection limit exceeded');
          }
          return retries * 500; // Exponential backoff
        }
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis client reconnecting');
    });

    await redisClient.connect();

    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    throw error;
  }
}

/**
 * Get Redis client
 */
function getRedisClient() {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initializeRedis() first.');
  }
  return redisClient;
}

/**
 * Get cached data
 */
async function getCached(key) {
  try {
    const client = getRedisClient();
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Error getting cached data for key ${key}:`, error);
    return null;
  }
}

/**
 * Set cached data
 */
async function setCached(key, value, ttlSeconds = null) {
  try {
    const client = getRedisClient();
    const serialized = JSON.stringify(value);

    if (ttlSeconds) {
      await client.setEx(key, ttlSeconds, serialized);
    } else {
      const defaultTTL = parseInt(process.env.REDIS_TTL) || 300; // 5 minutes default
      await client.setEx(key, defaultTTL, serialized);
    }

    return true;
  } catch (error) {
    logger.error(`Error setting cached data for key ${key}:`, error);
    return false;
  }
}

/**
 * Delete cached data
 */
async function deleteCached(key) {
  try {
    const client = getRedisClient();
    await client.del(key);
    return true;
  } catch (error) {
    logger.error(`Error deleting cached data for key ${key}:`, error);
    return false;
  }
}

/**
 * Delete all cached data matching a pattern
 */
async function deleteCachedPattern(pattern) {
  try {
    const client = getRedisClient();
    const keys = await client.keys(pattern);

    if (keys.length > 0) {
      await client.del(keys);
    }

    return keys.length;
  } catch (error) {
    logger.error(`Error deleting cached data for pattern ${pattern}:`, error);
    return 0;
  }
}

/**
 * Increment counter
 */
async function incrementCounter(key, amount = 1) {
  try {
    const client = getRedisClient();
    return await client.incrBy(key, amount);
  } catch (error) {
    logger.error(`Error incrementing counter ${key}:`, error);
    return null;
  }
}

/**
 * Close Redis connection
 */
async function closeRedis() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}

module.exports = {
  initializeRedis,
  getRedisClient,
  getCached,
  setCached,
  deleteCached,
  deleteCachedPattern,
  incrementCounter,
  closeRedis
};
