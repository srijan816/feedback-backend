import { Job } from 'bull';
import { googleDocsQueue } from '../config/queue.js';
import { query } from '../config/database.js';
import { createFeedbackDocument } from '../services/googleDocs.js';
import { GoogleDocsJobData } from '../types/index.js';
import logger from '../utils/logger.js';

/**
 * Process Google Docs creation job
 */
async function processGoogleDocsJob(job: Job<GoogleDocsJobData>) {
  const { speech_id, feedback_id, student_name, student_level, teacher_email } =
    job.data;

  logger.info('Processing Google Docs job', {
    job_id: job.id,
    speech_id,
    feedback_id,
  });

  try {
    // Get feedback and speech details
    const result = await query(
      `SELECT
         f.scores,
         f.qualitative_feedback,
         s.speaker_position,
         s.duration_seconds,
         s.created_at,
         d.motion
       FROM feedback f
       JOIN speeches s ON f.speech_id = s.id
       JOIN debates d ON s.debate_id = d.id
       WHERE f.id = $1`,
      [feedback_id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Feedback ${feedback_id} not found`);
    }

    const feedback = result.rows[0];

    // Create Google Docs document
    const docUrl = await createFeedbackDocument(
      {
        student_name,
        date: new Date(feedback.created_at).toLocaleDateString(),
        motion: feedback.motion,
        speaker_position: feedback.speaker_position,
        duration: feedback.duration_seconds,
        scores: feedback.scores,
        qualitative_feedback: feedback.qualitative_feedback,
      },
      student_level,
      teacher_email
    );

    // Update feedback with Google Docs URL
    await query(
      `UPDATE feedback
       SET google_doc_url = $1,
           google_doc_id = $2
       WHERE id = $3`,
      [
        docUrl,
        docUrl.includes('/d/') ? docUrl.split('/d/')[1]?.split('/')[0] : null,
        feedback_id,
      ]
    );

    logger.info('Google Docs created successfully', {
      speech_id,
      feedback_id,
      doc_url: docUrl,
    });

    return {
      success: true,
      doc_url: docUrl,
    };
  } catch (error) {
    logger.error('Google Docs job failed', {
      job_id: job.id,
      speech_id,
      feedback_id,
      error,
    });

    throw error;
  }
}

/**
 * Register Google Docs worker
 */
export function registerGoogleDocsWorker() {
  googleDocsQueue.process(async (job) => {
    return await processGoogleDocsJob(job);
  });

  logger.info('Google Docs worker registered');
}
