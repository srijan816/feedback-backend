import { createClient } from 'redis';
import config from './index.js';
import logger from '../utils/logger.js';

// Create Redis client
const redisClient = createClient({
  url: config.redis.url,
  password: config.redis.password,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Too many Redis reconnection attempts, giving up');
        return new Error('Too many retries');
      }
      return Math.min(retries * 100, 3000); // Exponential backoff, max 3s
    },
  },
});

// Event listeners
redisClient.on('connect', () => {
  logger.info('Redis client connecting...');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

redisClient.on('error', (err) => {
  logger.error('Redis client error', err);
});

redisClient.on('reconnecting', () => {
  logger.warn('Redis client reconnecting...');
});

// Connect to Redis
export async function connectRedis(): Promise<void> {
  try {
    await redisClient.connect();
    logger.info('Connected to Redis successfully');
  } catch (error) {
    logger.error('Failed to connect to Redis', error);
    throw error;
  }
}

// Disconnect from Redis
export async function disconnectRedis(): Promise<void> {
  try {
    await redisClient.quit();
    logger.info('Disconnected from Redis');
  } catch (error) {
    logger.error('Error disconnecting from Redis', error);
  }
}

export default redisClient;
