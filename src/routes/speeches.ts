import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { query } from '../config/database.js';
import { transcriptionQueue } from '../config/queue.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import {
  Speech,
  UploadSpeechResponse,
  SpeechStatusResponse,
  FeedbackResponse,
  TranscriptionJobData,
} from '../types/index.js';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.storage.path);
  },
  filename: (req, file, cb) => {
    const debateId = req.params.debateId;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `${debateId}_${timestamp}${ext}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.storage.maxUploadSizeMB * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (config.storage.allowedFormats.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          `Invalid file type. Allowed: ${config.storage.allowedFormats.join(', ')}`,
          400,
          'INVALID_FILE_TYPE'
        )
      );
    }
  },
});

/**
 * POST /api/debates/:debateId/speeches
 * Upload a speech audio file
 */
router.post(
  '/:debateId/speeches',
  upload.single('audio_file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError('Audio file required', 400, 'FILE_REQUIRED');
    }

    const debateId = req.params.debateId;
    const { speaker_name, speaker_position, duration_seconds, student_level } =
      req.body;

    if (!speaker_name || !speaker_position || !duration_seconds) {
      throw new AppError('Missing required fields', 400, 'MISSING_FIELDS');
    }

    // Verify debate exists
    const debateResult = await query('SELECT id FROM debates WHERE id = $1', [
      debateId,
    ]);
    if (debateResult.rows.length === 0) {
      throw new AppError('Debate not found', 404, 'NOT_FOUND');
    }

    // Create speech record
    const speechResult = await query<Speech>(
      `INSERT INTO speeches (
        debate_id, speaker_name, speaker_position,
        audio_file_path, duration_seconds, file_size_bytes,
        upload_status, uploaded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *`,
      [
        debateId,
        speaker_name,
        speaker_position,
        req.file.path,
        parseInt(duration_seconds),
        req.file.size,
        'uploaded',
      ]
    );

    const speech = speechResult.rows[0];

    // Queue transcription job
    const jobData: TranscriptionJobData = {
      speech_id: speech.id,
      audio_file_path: speech.audio_file_path!,
      speaker_name: speech.speaker_name,
      speaker_position: speech.speaker_position,
    };

    await transcriptionQueue.add(jobData, {
      priority: 1,
      attempts: 3,
    });

    logger.info('Speech uploaded and transcription queued', {
      speechId: speech.id,
      debateId,
      fileName: req.file.filename,
      size: req.file.size,
    });

    // iOS-compatible response with camelCase
    const response = {
      speechId: speech.id,
      status: 'uploaded',
      processingStarted: true,
      // Include legacy fields for backward compatibility
      speech_id: speech.id,
      processing_started: true,
      estimated_completion_seconds: 120,
    };

    res.status(201).json(response);
  })
);

/**
 * GET /api/speeches/:id/status
 * Get processing status of a speech (iOS-compatible format)
 */
router.get(
  '/:id/status',
  asyncHandler(async (req: Request, res: Response) => {
    const speechId = req.params.id;

    const result = await query<Speech>(
      `SELECT
        id, transcription_status, feedback_status,
        transcription_completed_at, feedback_completed_at
      FROM speeches
      WHERE id = $1`,
      [speechId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Speech not found', 404, 'NOT_FOUND');
    }

    const speech = result.rows[0];

    // Get feedback URL if complete
    let googleDocUrl: string | null = null;
    if (speech.feedback_status === 'completed') {
      const feedbackResult = await query(
        'SELECT google_doc_url FROM feedback WHERE speech_id = $1',
        [speechId]
      );
      if (feedbackResult.rows.length > 0) {
        googleDocUrl = feedbackResult.rows[0].google_doc_url;
      }
    }

    // Determine overall status for iOS app
    let status: 'pending' | 'processing' | 'complete' | 'failed' = 'pending';
    let errorMessage: string | null = null;

    if (
      speech.transcription_status === 'failed' ||
      speech.feedback_status === 'failed'
    ) {
      status = 'failed';
      errorMessage = speech.transcription_status === 'failed'
        ? 'Transcription failed'
        : 'Feedback generation failed';
    } else if (speech.feedback_status === 'completed') {
      status = 'complete';
    } else if (
      speech.transcription_status === 'processing' ||
      speech.feedback_status === 'processing'
    ) {
      status = 'processing';
    }

    // iOS-compatible response format
    const response = {
      status,
      googleDocUrl,
      errorMessage,
      // Include legacy fields for backward compatibility
      speech_id: speech.id,
      transcription_status: speech.transcription_status,
      feedback_status: speech.feedback_status,
      updated_at: new Date(),
    };

    res.json(response);
  })
);

/**
 * GET /api/speeches/:id/feedback
 * Get full feedback details
 */
router.get(
  '/:id/feedback',
  asyncHandler(async (req: Request, res: Response) => {
    const speechId = req.params.id;

    const result = await query(
      `SELECT * FROM feedback WHERE speech_id = $1`,
      [speechId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Feedback not found', 404, 'NOT_FOUND');
    }

    const feedback = result.rows[0];

    const response: FeedbackResponse = {
      speech_id: speechId,
      google_doc_url: feedback.google_doc_url,
      scores: feedback.scores,
      qualitative_feedback: feedback.qualitative_feedback,
      created_at: feedback.created_at,
    };

    res.json(response);
  })
);

export default router;
