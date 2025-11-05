import Bull from 'bull';
import config from './index.js';
import logger from '../utils/logger.js';
import {
  TranscriptionJobData,
  FeedbackJobData,
  GoogleDocsJobData,
  StorageCleanupJobData,
} from '../types/index.js';

// Queue options
const defaultQueueOptions: Bull.QueueOptions = {
  redis: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  },
  defaultJobOptions: {
    attempts: config.processing.maxRetries,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 500, // Keep last 500 failed jobs for debugging
  },
};

// Create queues
export const transcriptionQueue = new Bull<TranscriptionJobData>(
  'transcription',
  {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      timeout: config.processing.transcriptionTimeoutMinutes * 60 * 1000,
      priority: 1, // High priority
    },
  }
);

export const feedbackQueue = new Bull<FeedbackJobData>('feedback', {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    timeout: config.processing.feedbackTimeoutMinutes * 60 * 1000,
    priority: 1, // High priority
  },
});

export const googleDocsQueue = new Bull<GoogleDocsJobData>('google-docs', {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    timeout: 3 * 60 * 1000, // 3 minutes
    priority: 2, // Medium priority
  },
});

export const storageCleanupQueue = new Bull<StorageCleanupJobData>(
  'storage-cleanup',
  {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      timeout: 5 * 60 * 1000, // 5 minutes
      priority: 3, // Low priority
    },
  }
);

// Queue event handlers
function setupQueueEventHandlers(queue: Bull.Queue, queueName: string) {
  queue.on('error', (error) => {
    logger.error(`Queue ${queueName} error`, { error });
  });

  queue.on('waiting', (jobId) => {
    logger.debug(`Job ${jobId} is waiting in ${queueName}`);
  });

  queue.on('active', (job) => {
    logger.info(`Job ${job.id} started in ${queueName}`, {
      data: job.data,
    });
  });

  queue.on('completed', (job, result) => {
    logger.info(`Job ${job.id} completed in ${queueName}`, {
      duration: Date.now() - job.processedOn!,
      result,
    });
  });

  queue.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed in ${queueName}`, {
      error: err,
      attempts: job?.attemptsMade,
      data: job?.data,
    });
  });

  queue.on('stalled', (job) => {
    logger.warn(`Job ${job.id} stalled in ${queueName}`);
  });
}

// Setup event handlers for all queues
setupQueueEventHandlers(transcriptionQueue, 'transcription');
setupQueueEventHandlers(feedbackQueue, 'feedback');
setupQueueEventHandlers(googleDocsQueue, 'google-docs');
setupQueueEventHandlers(storageCleanupQueue, 'storage-cleanup');

// Graceful shutdown
export async function closeQueues(): Promise<void> {
  logger.info('Closing all queues...');
  await Promise.all([
    transcriptionQueue.close(),
    feedbackQueue.close(),
    googleDocsQueue.close(),
    storageCleanupQueue.close(),
  ]);
  logger.info('All queues closed');
}

// Health check for queues
export async function getQueuesHealth(): Promise<Record<string, any>> {
  const queues = {
    transcription: transcriptionQueue,
    feedback: feedbackQueue,
    googleDocs: googleDocsQueue,
    storageCleanup: storageCleanupQueue,
  };

  const health: Record<string, any> = {};

  for (const [name, queue] of Object.entries(queues)) {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    health[name] = {
      waiting,
      active,
      completed,
      failed,
      delayed,
      isPaused: await queue.isPaused(),
    };
  }

  return health;
}

export default {
  transcriptionQueue,
  feedbackQueue,
  googleDocsQueue,
  storageCleanupQueue,
  closeQueues,
  getQueuesHealth,
};
