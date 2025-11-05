import { Job } from 'bull';
import { transcriptionQueue, feedbackQueue } from '../config/queue.js';
import { query, transaction } from '../config/database.js';
import { transcribeAudio, getDebateKeyTerms } from '../services/transcription.js';
import { TranscriptionJobData, FeedbackJobData } from '../types/index.js';
import logger from '../utils/logger.js';

/**
 * Process transcription job
 */
async function processTranscriptionJob(job: Job<TranscriptionJobData>) {
  const { speech_id, audio_file_path, speaker_position } = job.data;

  logger.info('Processing transcription job', {
    job_id: job.id,
    speech_id,
    audio_file_path,
  });

  try {
    // Update speech status to processing
    await query(
      `UPDATE speeches
       SET transcription_status = 'processing',
           transcription_started_at = NOW()
       WHERE id = $1`,
      [speech_id]
    );

    // Get speech and debate details for context
    const speechResult = await query(
      `SELECT s.*, d.student_level, d.motion, d.id as debate_id
       FROM speeches s
       JOIN debates d ON s.debate_id = d.id
       WHERE s.id = $1`,
      [speech_id]
    );

    if (speechResult.rows.length === 0) {
      throw new Error(`Speech ${speech_id} not found`);
    }

    const speech = speechResult.rows[0];

    // Get debate-specific key terms for better accuracy
    const keyterms = getDebateKeyTerms(speech.student_level);

    // Transcribe audio using AssemblyAI Slam-1
    const result = await transcribeAudio(
      audio_file_path,
      {
        duration_seconds: speech.duration_seconds,
        keyterms,
        enableDiarization: false, // Single speaker transcription for individual speeches
      }
    );

    // Store transcription and words in transaction
    await transaction(async (client) => {
      // Insert transcript
      const transcriptResult = await client.query(
        `INSERT INTO transcripts (
          speech_id, transcript_text, word_count, speaking_rate,
          api_provider, api_model, processing_time_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [
          speech_id,
          result.transcript_text,
          result.word_count,
          result.speaking_rate,
          result.api_provider,
          result.api_model,
          result.processing_time_ms,
        ]
      );

      const transcript_id = transcriptResult.rows[0].id;

      // Insert word-level timestamps
      for (let i = 0; i < result.words.length; i++) {
        const word = result.words[i];
        await client.query(
          `INSERT INTO transcript_words (
            transcript_id, word_index, text, start_ms, end_ms, confidence, speaker
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            transcript_id,
            i,
            word.text,
            word.start_ms,
            word.end_ms,
            word.confidence,
            word.speaker || null,
          ]
        );
      }

      // Update speech status
      await client.query(
        `UPDATE speeches
         SET transcription_status = 'completed',
             transcription_completed_at = NOW()
         WHERE id = $1`,
        [speech_id]
      );

      logger.info('Transcription completed', {
        speech_id,
        transcript_id,
        word_count: result.word_count,
        speaking_rate: result.speaking_rate,
      });

      // Queue feedback generation job
      const feedbackJobData: FeedbackJobData = {
        speech_id,
        transcript_id,
        debate_id: speech.debate_id,
        motion: speech.motion,
        speaker_position,
        student_level: speech.student_level,
      };

      await feedbackQueue.add(feedbackJobData, {
        priority: 1,
        attempts: 3,
      });

      logger.info('Feedback job queued', { speech_id, transcript_id });
    });

    return {
      success: true,
      transcript_id: speech_id,
      word_count: result.word_count,
    };
  } catch (error) {
    logger.error('Transcription job failed', {
      job_id: job.id,
      speech_id,
      error,
    });

    // Update speech status to error
    await query(
      `UPDATE speeches
       SET transcription_status = 'failed'
       WHERE id = $1`,
      [speech_id]
    );

    throw error;
  }
}

/**
 * Register transcription worker
 */
export function registerTranscriptionWorker() {
  transcriptionQueue.process(async (job) => {
    return await processTranscriptionJob(job);
  });

  logger.info('Transcription worker registered');
}
