import redisClient from '../config/redis.js';
import logger from '../utils/logger.js';

/**
 * Cache service for hot data (rubrics, prompts, etc.)
 *
 * This dramatically reduces database queries by caching frequently accessed data
 * in Redis with TTL-based expiration.
 */

const CACHE_TTL = {
  RUBRICS: 3600, // 1 hour (rubrics change infrequently)
  PROMPTS: 3600, // 1 hour (prompts change infrequently)
  SPEECH_DATA: 300, // 5 minutes (speech data is more dynamic)
};

/**
 * Get data from cache
 */
export async function getFromCache<T>(key: string): Promise<T | null> {
  try {
    const cached = await redisClient.get(key);
    if (cached) {
      logger.debug('Cache HIT', { key });
      return JSON.parse(cached) as T;
    }
    logger.debug('Cache MISS', { key });
    return null;
  } catch (error) {
    logger.error('Cache get error', { error, key });
    return null; // Fail gracefully - don't break if Redis is down
  }
}

/**
 * Set data in cache with TTL
 */
export async function setInCache(
  key: string,
  data: any,
  ttl: number
): Promise<void> {
  try {
    await redisClient.setEx(key, ttl, JSON.stringify(data));
    logger.debug('Cache SET', { key, ttl });
  } catch (error) {
    logger.error('Cache set error', { error, key });
    // Fail gracefully - don't break if Redis is down
  }
}

/**
 * Invalidate cache by key pattern
 */
export async function invalidateCache(pattern: string): Promise<void> {
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.info('Cache invalidated', { pattern, count: keys.length });
    }
  } catch (error) {
    logger.error('Cache invalidation error', { error, pattern });
  }
}

/**
 * Cache key generators
 */
export const CacheKeys = {
  rubrics: (studentLevel: string) => `rubrics:${studentLevel}`,
  prompt: (studentLevel: string) => `prompt:${studentLevel}`,
  speechTimestamp: (speechId: string) => `speech:timestamp:${speechId}`,
  priorSpeeches: (debateId: string, speechId: string) =>
    `prior:${debateId}:${speechId}`,
};

/**
 * Cache TTL values
 */
export { CACHE_TTL };

export default {
  getFromCache,
  setInCache,
  invalidateCache,
  CacheKeys,
  CACHE_TTL,
};
