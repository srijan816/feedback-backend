import dotenv from 'dotenv';
import logger from '../utils/logger.js';
import { testConnection, closePool } from '../config/database.js';
import { connectRedis, disconnectRedis } from '../config/redis.js';
import { closeQueues } from '../config/queue.js';
import { registerTranscriptionWorker } from './transcription.worker.js';
import { registerFeedbackWorker } from './feedback.worker.js';
import { registerGoogleDocsWorker } from './googleDocs.worker.js';

dotenv.config();

/**
 * Start all workers
 */
async function startWorkers() {
  try {
    logger.info('Starting debate feedback workers...');

    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    // Connect to Redis
    await connectRedis();

    // Register all workers
    registerTranscriptionWorker();
    registerFeedbackWorker();
    registerGoogleDocsWorker();

    logger.info('All workers registered and ready to process jobs');
    logger.info('Workers started successfully', {
      workers: ['transcription', 'feedback', 'googleDocs'],
    });
  } catch (error) {
    logger.error('Failed to start workers', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, shutting down workers...`);

  try {
    await closeQueues();
    await disconnectRedis();
    await closePool();

    logger.info('Workers shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception in worker', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection in worker', { reason, promise });
});

// Start workers
startWorkers();
