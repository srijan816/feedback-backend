import { Job } from 'bull';
import { feedbackQueue, googleDocsQueue } from '../config/queue.js';
import { query } from '../config/database.js';
import { generateFeedback } from '../services/feedback.js';
import { FeedbackJobData, GoogleDocsJobData } from '../types/index.js';
import logger from '../utils/logger.js';

/**
 * Process feedback generation job
 */
async function processFeedbackJob(job: Job<FeedbackJobData>) {
  const { speech_id, transcript_id, debate_id, motion, speaker_position, student_level } =
    job.data;

  logger.info('Processing feedback job', {
    job_id: job.id,
    speech_id,
    transcript_id,
  });

  try {
    // Update speech status
    await query(
      `UPDATE speeches
       SET feedback_status = 'processing',
           feedback_started_at = NOW()
       WHERE id = $1`,
      [speech_id]
    );

    // Get transcript and speech details
    const result = await query(
      `SELECT
         t.transcript_text,
         s.speaker_name,
         s.duration_seconds
       FROM transcripts t
       JOIN speeches s ON t.speech_id = s.id
       WHERE t.id = $1`,
      [transcript_id]
    );

    if (result.rows.length === 0) {
      throw new Error(`Transcript ${transcript_id} not found`);
    }

    const { transcript_text, speaker_name, duration_seconds } = result.rows[0];

    // TEMPORARY: Skip LLM feedback generation, use transcript as fallback
    // TODO: Re-enable after prompt engineering is complete
    logger.info('Using transcript-only fallback for feedback', { speech_id });

    // Create simple transcript-based feedback
    const transcriptFeedback = {
      scores: {
        Argumentation: 'NA',
        'Rebuttal Quality': 'NA',
        'Evidence & Examples': 'NA',
        'Speaking Rate & Clarity': 'NA',
        'Role Fulfillment': 'NA',
      },
      qualitative_feedback: {
        Transcript: [transcript_text],
        Motion: [motion],
        'Speaker Position': [speaker_position],
        Duration: [`${Math.round(duration_seconds || 0)} seconds`],
        'Note': ['Automated AI feedback is currently being configured. This is your speech transcript.'],
      },
    };

    // Generate feedback viewer URL
    const feedbackUrl = `${process.env.API_BASE_URL || 'http://localhost:12000'}/feedback/view/${speech_id}`;

    // Store feedback in database
    const feedbackInsert = await query(
      `INSERT INTO feedback (
        speech_id,
        scores,
        qualitative_feedback,
        llm_provider,
        llm_model,
        processing_time_ms,
        google_doc_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id`,
      [
        speech_id,
        JSON.stringify(transcriptFeedback.scores),
        JSON.stringify(transcriptFeedback.qualitative_feedback),
        'transcript_fallback',
        'none',
        0,
        feedbackUrl, // URL to HTML feedback viewer
      ]
    );

    const feedback_id = feedbackInsert.rows[0].id;

    // Update speech status
    await query(
      `UPDATE speeches
       SET feedback_status = 'completed',
           feedback_completed_at = NOW()
       WHERE id = $1`,
      [speech_id]
    );

    logger.info('Transcript-based feedback created successfully', {
      speech_id,
      feedback_id,
      fallback: true,
    });

    // TEMPORARY: Skip Google Docs generation for now
    // TODO: Re-enable after configuring Google Drive API
    logger.info('Skipping Google Docs generation (transcript fallback mode)', { speech_id });

    return {
      success: true,
      feedback_id,
    };
  } catch (error) {
    logger.error('Feedback job failed', {
      job_id: job.id,
      speech_id,
      error,
    });

    // Update speech status to error
    await query(
      `UPDATE speeches
       SET feedback_status = 'failed'
       WHERE id = $1`,
      [speech_id]
    );

    throw error;
  }
}

/**
 * Register feedback worker
 */
export function registerFeedbackWorker() {
  // Process 10 jobs concurrently for maximum throughput
  feedbackQueue.process(10, async (job) => {
    return await processFeedbackJob(job);
  });

  logger.info('Feedback worker registered with concurrency: 10');
}
