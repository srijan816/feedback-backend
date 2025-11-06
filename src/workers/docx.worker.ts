import Bull from 'bull';
import path from 'path';
import { generateFeedbackDocx } from '../services/docxGenerator.js';
import { query } from '../config/database.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';

// Create DOCX generation queue
export const docxQueue = new Bull('docx-generation', {
  redis: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

interface DocxJobData {
  feedbackId: number;
}

// Process DOCX generation jobs
docxQueue.process(5, async (job: Bull.Job<DocxJobData>) => {
  const { feedbackId } = job.data;

  logger.info(`[DOCX Worker] Processing job ${job.id} for feedback ${feedbackId}`);

  try {
    // Generate DOCX file
    const filepath = await generateFeedbackDocx(feedbackId);
    const filename = path.basename(filepath);

    // Generate public URL
    const docx_url = `/uploads/docx/${filename}`;

    // Update database with DOCX path
    await query(
      `UPDATE feedback
      SET docx_url = $1
      WHERE id = $2`,
      [docx_url, feedbackId]
    );

    await query(
      `UPDATE feedback_approvals
      SET
        docx_file_path = $1,
        docx_url = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE feedback_id = $3`,
      [filepath, docx_url, feedbackId]
    );

    logger.info(
      `[DOCX Worker] Job ${job.id} completed successfully. DOCX: ${filename}`
    );

    // Emit event for WebSocket notification (if available)
    try {
      // Import dynamically to avoid circular dependencies
      const { emitToTeacher } = await import('../services/websocket.js');

      // Get teacher ID for this feedback
      const teacherResult = await query(
        `SELECT d.teacher_id
        FROM feedback f
        JOIN speeches s ON f.speech_id = s.id
        JOIN debates d ON s.debate_id = d.id
        WHERE f.id = $1`,
        [feedbackId]
      );

      if (teacherResult.rows.length > 0) {
        const teacherId = teacherResult.rows[0].teacher_id;
        emitToTeacher(teacherId, 'docx:ready', {
          feedback_id: feedbackId,
          docx_url,
          generated_at: new Date().toISOString(),
        });
      }
    } catch (wsError) {
      // WebSocket notification is optional, log but don't fail
      logger.warn('[DOCX Worker] Could not emit WebSocket event:', wsError);
    }

    return {
      filepath,
      docx_url,
      feedbackId,
    };
  } catch (error) {
    logger.error(`[DOCX Worker] Job ${job.id} failed:`, error);
    throw error;
  }
});

// Event handlers
docxQueue.on('completed', (job, result) => {
  logger.info(`[DOCX Worker] Job ${job.id} completed:`, result);
});

docxQueue.on('failed', (job, err) => {
  logger.error(`[DOCX Worker] Job ${job?.id} failed:`, err);
});

docxQueue.on('stalled', (job) => {
  logger.warn(`[DOCX Worker] Job ${job.id} stalled`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('[DOCX Worker] SIGTERM received, closing queue...');
  await docxQueue.close();
  process.exit(0);
});

logger.info('[DOCX Worker] DOCX generation worker initialized');

export default docxQueue;
