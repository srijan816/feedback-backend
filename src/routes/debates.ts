import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import path from 'path';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { query, transaction } from '../config/database.js';
import { transcriptionQueue } from '../config/queue.js';
import config from '../config/index.js';
import type {
  CreateDebateRequest,
  CreateDebateResponse,
  Debate,
  DebateParticipant,
  Speech,
  TranscriptionJobData,
  DebateFormat,
} from '../types/index.js';
import logger from '../utils/logger.js';

const router = Router();

const VALID_FORMATS: DebateFormat[] = [
  'WSDC',
  'Modified WSDC',
  'BP',
  'AP',
  'Australs',
  'LD',
  'PF',
];

function normalizeDebateFormat(value: unknown): DebateFormat | '' {
  if (typeof value !== 'string') {
    return '';
  }

  const key = value.trim().toLowerCase().replace(/[\s_]+/g, ' ');

  switch (key) {
    case 'wsdc':
      return 'WSDC';
    case 'modified wsdc':
      return 'Modified WSDC';
    case 'bp':
      return 'BP';
    case 'ap':
      return 'AP';
    case 'australs':
      return 'Australs';
    case 'ld':
      return 'LD';
    case 'pf':
      return 'PF';
    default:
      return '';
  }
}

// Configure multer for speech file uploads
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
 * POST /api/debates/create
 * Create a new debate session
 */
router.post(
  '/create',
  optionalAuth, // Allow both authenticated and guest mode
  [
    body('motion').isString().trim().notEmpty(),
    body('format')
      .customSanitizer(normalizeDebateFormat)
      .custom((value) => {
        if (!value || !VALID_FORMATS.includes(value as DebateFormat)) {
          throw new Error('Invalid debate format');
        }
        return true;
      }),
    body('student_level').isIn(['primary', 'secondary']),
    body('speech_time_seconds').isInt({ min: 60, max: 600 }),
    body('teams').isObject(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    }

    const requestData: CreateDebateRequest = req.body;

    // Create debate and participants in a transaction
    const result = await transaction(async (client) => {
      // Insert debate
      const debateResult = await client.query<Debate>(
        `INSERT INTO debates (
          teacher_id, motion, format, student_level,
          speech_time_seconds, reply_time_seconds, is_guest_session
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          req.user?.id || null,
          requestData.motion,
          requestData.format,
          requestData.student_level,
          requestData.speech_time_seconds,
          requestData.reply_time_seconds || null,
          !req.user, // is_guest_session if no user
        ]
      );

      const debate = debateResult.rows[0];

      // Insert participants
      const participants: DebateParticipant[] = [];
      let speakerOrder = 1;

      for (const [team, speakers] of Object.entries(requestData.teams)) {
        if (!speakers || speakers.length === 0) continue;

        for (const speaker of speakers) {
          const participantResult = await client.query<DebateParticipant>(
            `INSERT INTO debate_participants (
              debate_id, student_id, student_name, team, position, speaker_order
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [
              debate.id,
              speaker.student_id || null,
              speaker.name,
              team,
              speaker.position,
              speakerOrder++,
            ]
          );
          participants.push(participantResult.rows[0]);
        }
      }

      return { debate, participants };
    });

    logger.info('Debate created', {
      debateId: result.debate.id,
      teacherId: req.user?.id,
      motion: requestData.motion,
      participantsCount: result.participants.length,
    });

    // iOS-compatible response with camelCase
    const response = {
      debateId: result.debate.id,
      // Include legacy fields for backward compatibility
      debate_id: result.debate.id,
      created_at: result.debate.created_at,
    };

    res.status(201).json(response);
  })
);

/**
 * POST /api/debates/:debateId/speeches
 * Upload a speech audio file for a debate
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
      speechId: speech.id.toString(),
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
 * GET /api/debates/:id
 * Get debate details with all speeches
 */
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const debateId = req.params.id;

    // Get debate info
    const debateResult = await query<Debate>(
      'SELECT * FROM debates WHERE id = $1',
      [debateId]
    );

    if (debateResult.rows.length === 0) {
      throw new AppError('Debate not found', 404, 'NOT_FOUND');
    }

    const debate = debateResult.rows[0];

    // Get speeches with feedback
    const speechesResult = await query(
      `SELECT
        s.*,
        f.google_doc_url,
        f.scores,
        t.transcript_text
      FROM speeches s
      LEFT JOIN feedback f ON s.id = f.speech_id
      LEFT JOIN transcripts t ON s.id = t.speech_id
      WHERE s.debate_id = $1
      ORDER BY s.created_at`,
      [debateId]
    );

    res.json({
      ...debate,
      speeches: speechesResult.rows,
    });
  })
);

/**
 * GET /api/teachers/:teacherId/debates
 * Get debate history for a teacher
 */
router.get(
  '/teachers/:teacherId/debates',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const teacherId = req.params.teacherId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Ensure user can only access their own debates (unless admin)
    if (req.user?.id !== teacherId && req.user?.role !== 'admin') {
      throw new AppError('Unauthorized', 403, 'FORBIDDEN');
    }

    const result = await query(
      `SELECT
        d.*,
        COUNT(s.id) as speeches_count,
        COUNT(CASE WHEN f.id IS NOT NULL THEN 1 END) as feedback_count
      FROM debates d
      LEFT JOIN speeches s ON d.id = s.debate_id
      LEFT JOIN feedback f ON s.id = f.speech_id
      WHERE d.teacher_id = $1
      GROUP BY d.id
      ORDER BY d.created_at DESC
      LIMIT $2 OFFSET $3`,
      [teacherId, limit, offset]
    );

    res.json({
      debates: result.rows,
      total: result.rowCount,
      page: Math.floor(offset / limit) + 1,
      limit,
    });
  })
);

export default router;
