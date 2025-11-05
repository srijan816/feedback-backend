import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { query } from '../config/database.js';
import redisClient from '../config/redis.js';
import { getQueuesHealth } from '../config/queue.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /api/health
 * Basic health check
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  })
);

/**
 * GET /api/health/detailed
 * Detailed health check including database, Redis, and queues
 */
router.get(
  '/detailed',
  asyncHandler(async (req: Request, res: Response) => {
    const checks: Record<string, any> = {
      server: {
        status: 'ok',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
    };

    // Check database
    try {
      await query('SELECT 1');
      checks.database = { status: 'ok' };
    } catch (error) {
      logger.error('Database health check failed', error);
      checks.database = { status: 'error', error: String(error) };
    }

    // Check Redis
    try {
      await redisClient.ping();
      checks.redis = { status: 'ok' };
    } catch (error) {
      logger.error('Redis health check failed', error);
      checks.redis = { status: 'error', error: String(error) };
    }

    // Check queues
    try {
      const queuesHealth = await getQueuesHealth();
      checks.queues = { status: 'ok', ...queuesHealth };
    } catch (error) {
      logger.error('Queues health check failed', error);
      checks.queues = { status: 'error', error: String(error) };
    }

    const allOk = Object.values(checks).every(
      (check) => !check.status || check.status === 'ok'
    );

    res.status(allOk ? 200 : 503).json({
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    });
  })
);

export default router;
