import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { query } from '../config/database.js';
import logger from '../utils/logger.js';

const router = Router();

// ============================================
// TEACHER DASHBOARD API
// ============================================

/**
 * GET /api/teachers/:teacherName/dashboard
 * Get teacher's dashboard data
 */
router.get(
  '/api/teachers/:teacherName/dashboard',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { teacherName } = req.params;

    // Get teacher ID from name
    const teacherResult = await query(
      'SELECT id FROM users WHERE name = $1',
      [teacherName]
    );

    if (teacherResult.rows.length === 0) {
      throw new AppError('Teacher not found', 404);
    }

    const teacherId = teacherResult.rows[0].id;

    // Get active debates (in progress)
    const activeDebatesResult = await query(
      `SELECT
        d.id,
        d.motion,
        d.status,
        d.created_at as started_at,
        COUNT(DISTINCT s.id) FILTER (WHERE s.feedback_status = 'completed') as speeches_completed,
        COUNT(DISTINCT dp.id) as total_speeches
      FROM debates d
      LEFT JOIN speeches s ON d.id = s.debate_id
      LEFT JOIN debate_participants dp ON d.id = dp.debate_id
      WHERE d.teacher_id = $1
        AND d.status = 'in_progress'
      GROUP BY d.id
      ORDER BY d.created_at DESC`,
      [teacherId]
    );

    // Get pending reviews (feedback awaiting approval)
    const pendingReviewsResult = await query(
      `SELECT
        f.id as feedback_id,
        s.id as speech_id,
        s.speaker_name as student_name,
        s.speaker_position as position,
        d.motion,
        f.created_at as generated_at,
        COALESCE(fd.version, 0) as edit_count,
        COALESCE(f.approval_status, 'pending_review') as status
      FROM feedback f
      JOIN speeches s ON f.speech_id = s.id
      JOIN debates d ON s.debate_id = d.id
      LEFT JOIN feedback_drafts fd ON f.id = fd.feedback_id
      WHERE d.teacher_id = $1
        AND COALESCE(f.approval_status, 'pending_review') IN ('pending_review', 'draft')
      ORDER BY f.created_at DESC
      LIMIT 10`,
      [teacherId]
    );

    // Get recent approved feedback
    const recentApprovedResult = await query(
      `SELECT
        d.id as debate_id,
        d.motion,
        d.created_at as debate_date,
        COUNT(DISTINCT f.id) as feedback_count
      FROM debates d
      JOIN speeches s ON d.id = s.debate_id
      JOIN feedback f ON s.id = f.speech_id
      WHERE d.teacher_id = $1
        AND f.approval_status = 'approved'
      GROUP BY d.id, d.motion, d.created_at
      ORDER BY d.created_at DESC
      LIMIT 5`,
      [teacherId]
    );

    // If no data, provide demo data for visualization
    const hasData = activeDebatesResult.rows.length > 0 ||
                    pendingReviewsResult.rows.length > 0 ||
                    recentApprovedResult.rows.length > 0;

    if (!hasData) {
      return res.json({
        active_debates: [],
        pending_reviews: [],
        recent_approved: [],
        demo_mode: true,
        message: 'No debates or feedback yet. Upload speeches via the iOS app to see data here.'
      });
    }

    return res.json({
      active_debates: activeDebatesResult.rows,
      pending_reviews: pendingReviewsResult.rows,
      recent_approved: recentApprovedResult.rows,
      demo_mode: false,
    });
  })
);

/**
 * GET /api/teachers/:teacherName/profile
 * Get teacher profile summary
 */
router.get(
  '/api/teachers/:teacherName/profile',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { teacherName } = req.params;

    const result = await query(
      `SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        COUNT(DISTINCT d.id) as total_debates,
        COUNT(DISTINCT f.id) FILTER (WHERE f.approval_status IN ('pending_review', 'draft')) as pending_reviews,
        COUNT(DISTINCT f.id) FILTER (WHERE f.approval_status = 'approved') as approved_feedbacks
      FROM users u
      LEFT JOIN debates d ON u.id = d.teacher_id
      LEFT JOIN speeches s ON d.id = s.debate_id
      LEFT JOIN feedback f ON s.id = f.speech_id
      WHERE u.name = $1
      GROUP BY u.id, u.name, u.email, u.role`,
      [teacherName]
    );

    if (result.rows.length === 0) {
      throw new AppError('Teacher not found', 404);
    }

    res.json(result.rows[0]);
  })
);

// ============================================
// FEEDBACK DRAFT MANAGEMENT
// ============================================

/**
 * GET /api/teachers/:teacherName/feedback/:feedbackId/draft
 * Get feedback with draft edits
 */
router.get(
  '/api/teachers/:teacherName/feedback/:feedbackId/draft',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { feedbackId } = req.params;

    // Get original feedback with debate info
    const feedbackResult = await query(
      `SELECT
        f.*,
        s.id as speech_id,
        s.speaker_name,
        s.speaker_position as position,
        d.motion,
        d.teacher_id
      FROM feedback f
      JOIN speeches s ON f.speech_id = s.id
      JOIN debates d ON s.debate_id = d.id
      WHERE f.id = $1`,
      [feedbackId]
    );

    if (feedbackResult.rows.length === 0) {
      throw new AppError('Feedback not found', 404);
    }

    const original = feedbackResult.rows[0];

    // Get draft if exists
    const draftResult = await query(
      'SELECT * FROM feedback_drafts WHERE feedback_id = $1',
      [feedbackId]
    );

    const draft = draftResult.rows[0] || null;

    res.json({
      feedback_id: parseInt(feedbackId),
      student_name: original.speaker_name,
      position: original.position,
      motion: original.motion,
      original: {
        scores: original.scores,
        qualitative_feedback:
          typeof original.qualitative_feedback === 'string'
            ? JSON.parse(original.qualitative_feedback)
            : original.qualitative_feedback,
        strategic_overview: original.strategic_overview,
      },
      draft: draft
        ? {
            edited_scores: draft.edited_scores,
            edited_qualitative_feedback: draft.edited_qualitative_feedback,
            edited_strategic_overview: draft.edited_strategic_overview,
            teacher_notes: draft.teacher_notes,
            version: draft.version,
            updated_at: draft.updated_at,
          }
        : null,
      approval_status: original.approval_status || 'pending_review',
    });
  })
);

/**
 * PUT /api/teachers/:teacherName/feedback/:feedbackId/draft
 * Save/update feedback draft
 */
router.put(
  '/api/teachers/:teacherName/feedback/:feedbackId/draft',
  authenticateToken,
  [body('edited_scores').optional().isObject(), body('teacher_notes').optional().isString()],
  asyncHandler(async (req: Request, res: Response) => {
    const { feedbackId } = req.params;
    const {
      edited_scores,
      edited_qualitative_feedback,
      edited_strategic_overview,
      teacher_notes,
    } = req.body;

    // Get teacher ID
    const teacherResult = await query(
      'SELECT id FROM users WHERE name = $1',
      [req.params.teacherName]
    );

    if (teacherResult.rows.length === 0) {
      throw new AppError('Teacher not found', 404);
    }

    const teacherId = teacherResult.rows[0].id;

    // Check if draft exists
    const existingDraft = await query(
      'SELECT id, version FROM feedback_drafts WHERE feedback_id = $1',
      [feedbackId]
    );

    if (existingDraft.rows.length > 0) {
      // Update existing draft
      const newVersion = existingDraft.rows[0].version + 1;

      const result = await query(
        `UPDATE feedback_drafts
        SET
          edited_scores = $1,
          edited_qualitative_feedback = $2,
          edited_strategic_overview = $3,
          teacher_notes = $4,
          version = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE feedback_id = $6
        RETURNING id, version, updated_at`,
        [
          edited_scores ? JSON.stringify(edited_scores) : null,
          edited_qualitative_feedback ? JSON.stringify(edited_qualitative_feedback) : null,
          edited_strategic_overview ? JSON.stringify(edited_strategic_overview) : null,
          teacher_notes,
          newVersion,
          feedbackId,
        ]
      );

      res.json({
        draft_id: result.rows[0].id,
        version: result.rows[0].version,
        saved_at: result.rows[0].updated_at,
      });
    } else {
      // Create new draft
      const result = await query(
        `INSERT INTO feedback_drafts (
          feedback_id,
          teacher_id,
          edited_scores,
          edited_qualitative_feedback,
          edited_strategic_overview,
          teacher_notes,
          version
        )
        VALUES ($1, $2, $3, $4, $5, $6, 1)
        RETURNING id, version, updated_at`,
        [
          feedbackId,
          teacherId,
          edited_scores ? JSON.stringify(edited_scores) : null,
          edited_qualitative_feedback ? JSON.stringify(edited_qualitative_feedback) : null,
          edited_strategic_overview ? JSON.stringify(edited_strategic_overview) : null,
          teacher_notes,
        ]
      );

      // Update feedback status to 'draft'
      await query(
        `UPDATE feedback SET approval_status = 'draft' WHERE id = $1`,
        [feedbackId]
      );

      res.json({
        draft_id: result.rows[0].id,
        version: result.rows[0].version,
        saved_at: result.rows[0].updated_at,
      });
    }
  })
);

/**
 * POST /api/teachers/:teacherName/feedback/:feedbackId/approve
 * Approve feedback and trigger DOCX generation
 */
router.post(
  '/api/teachers/:teacherName/feedback/:feedbackId/approve',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { feedbackId } = req.params;

    // Get teacher ID
    const teacherResult = await query(
      'SELECT id FROM users WHERE name = $1',
      [req.params.teacherName]
    );

    if (teacherResult.rows.length === 0) {
      throw new AppError('Teacher not found', 404);
    }

    const teacherId = teacherResult.rows[0].id;

    // Update approval status
    await query(
      `UPDATE feedback
      SET
        approval_status = 'approved',
        approved_at = CURRENT_TIMESTAMP
      WHERE id = $1`,
      [feedbackId]
    );

    // Create/update approval record
    const approvalResult = await query(
      `INSERT INTO feedback_approvals (
        feedback_id,
        teacher_id,
        status,
        approved_at
      )
      VALUES ($1, $2, 'approved', CURRENT_TIMESTAMP)
      ON CONFLICT (feedback_id) DO UPDATE
      SET
        status = 'approved',
        approved_at = CURRENT_TIMESTAMP
      RETURNING id`,
      [feedbackId, teacherId]
    );

    logger.info(`Feedback ${feedbackId} approved by teacher ${teacherId}`);

    // Trigger DOCX generation queue job
    try {
      const { docxQueue } = await import('../workers/docx.worker.js');
      const job = await docxQueue.add('generate', { feedbackId: parseInt(feedbackId) });
      logger.info(`DOCX generation job ${job.id} queued for feedback ${feedbackId}`);

      res.json({
        approval_id: approvalResult.rows[0].id,
        status: 'approved',
        docx_job_id: job.id.toString(),
        message: 'Feedback approved. DOCX generation in progress...',
      });
    } catch (queueError) {
      logger.error('Failed to queue DOCX generation:', queueError);
      // Still return success for approval, but note DOCX issue
      res.json({
        approval_id: approvalResult.rows[0].id,
        status: 'approved',
        message: 'Feedback approved. DOCX generation will be attempted shortly.',
      });
    }
  })
);

/**
 * GET /api/teachers/:teacherName/feedback/:feedbackId/approval-status
 * Check approval status and DOCX availability
 */
router.get(
  '/api/teachers/:teacherName/feedback/:feedbackId/approval-status',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { feedbackId } = req.params;

    const result = await query(
      `SELECT
        fa.status,
        fa.docx_url,
        fa.approved_at,
        f.approval_status,
        f.docx_url as feedback_docx_url
      FROM feedback f
      LEFT JOIN feedback_approvals fa ON f.id = fa.feedback_id
      WHERE f.id = $1`,
      [feedbackId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Feedback not found', 404);
    }

    res.json(result.rows[0]);
  })
);

// ============================================
// DEBATE NOTES MANAGEMENT
// ============================================

/**
 * POST /api/teachers/:teacherName/debates/:debateId/notes
 * Create a new note
 */
router.post(
  '/api/teachers/:teacherName/debates/:debateId/notes',
  authenticateToken,
  [
    body('speech_id').isInt(),
    body('speaker_name').isString(),
    body('note_text').isString(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    }

    const { debateId } = req.params;
    const { speech_id, speaker_name, note_text } = req.body;

    // Get teacher ID
    const teacherResult = await query(
      'SELECT id FROM users WHERE name = $1',
      [req.params.teacherName]
    );

    if (teacherResult.rows.length === 0) {
      throw new AppError('Teacher not found', 404);
    }

    const teacherId = teacherResult.rows[0].id;

    const result = await query(
      `INSERT INTO debate_notes (
        debate_id,
        teacher_id,
        speech_id,
        speaker_name,
        note_text
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at`,
      [debateId, teacherId, speech_id, speaker_name, note_text]
    );

    // Update notes count on speech
    await query(
      `UPDATE speeches
      SET teacher_notes_count = teacher_notes_count + 1
      WHERE id = $1`,
      [speech_id]
    );

    res.json({
      note_id: result.rows[0].id,
      created_at: result.rows[0].created_at,
    });
  })
);

/**
 * GET /api/teachers/:teacherName/debates/:debateId/notes
 * Get all notes for a debate
 */
router.get(
  '/api/teachers/:teacherName/debates/:debateId/notes',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { debateId } = req.params;

    // Get teacher ID
    const teacherResult = await query(
      'SELECT id FROM users WHERE name = $1',
      [req.params.teacherName]
    );

    if (teacherResult.rows.length === 0) {
      throw new AppError('Teacher not found', 404);
    }

    const teacherId = teacherResult.rows[0].id;

    const result = await query(
      `SELECT
        id as note_id,
        speech_id,
        speaker_name,
        note_text,
        created_at,
        updated_at
      FROM debate_notes
      WHERE debate_id = $1 AND teacher_id = $2
      ORDER BY created_at ASC`,
      [debateId, teacherId]
    );

    res.json({
      notes: result.rows,
    });
  })
);

/**
 * PUT /api/teachers/:teacherName/notes/:noteId
 * Update a note
 */
router.put(
  '/api/teachers/:teacherName/notes/:noteId',
  authenticateToken,
  [body('note_text').isString()],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    }

    const { noteId } = req.params;
    const { note_text } = req.body;

    // Get teacher ID
    const teacherResult = await query(
      'SELECT id FROM users WHERE name = $1',
      [req.params.teacherName]
    );

    if (teacherResult.rows.length === 0) {
      throw new AppError('Teacher not found', 404);
    }

    const teacherId = teacherResult.rows[0].id;

    const result = await query(
      `UPDATE debate_notes
      SET
        note_text = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND teacher_id = $3
      RETURNING updated_at`,
      [note_text, noteId, teacherId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Note not found', 404);
    }

    res.json({
      updated_at: result.rows[0].updated_at,
    });
  })
);

/**
 * DELETE /api/teachers/:teacherName/notes/:noteId
 * Delete a note
 */
router.delete(
  '/api/teachers/:teacherName/notes/:noteId',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { noteId } = req.params;

    // Get teacher ID
    const teacherResult = await query(
      'SELECT id FROM users WHERE name = $1',
      [req.params.teacherName]
    );

    if (teacherResult.rows.length === 0) {
      throw new AppError('Teacher not found', 404);
    }

    const teacherId = teacherResult.rows[0].id;

    // Get speech_id before deleting
    const noteResult = await query(
      'SELECT speech_id FROM debate_notes WHERE id = $1 AND teacher_id = $2',
      [noteId, teacherId]
    );

    if (noteResult.rows.length === 0) {
      throw new AppError('Note not found', 404);
    }

    const speechId = noteResult.rows[0].speech_id;

    // Delete note
    await query('DELETE FROM debate_notes WHERE id = $1 AND teacher_id = $2', [
      noteId,
      teacherId,
    ]);

    // Update notes count
    await query(
      `UPDATE speeches
      SET teacher_notes_count = GREATEST(teacher_notes_count - 1, 0)
      WHERE id = $1`,
      [speechId]
    );

    res.json({ message: 'Note deleted' });
  })
);

/**
 * GET /api/teachers/:teacherName/debates/:debateId/live
 * Get live debate data for note-taking interface
 */
router.get(
  '/api/teachers/:teacherName/debates/:debateId/live',
  authenticateToken,
  asyncHandler(async (req: Request, res: Response) => {
    const { debateId } = req.params;

    // Get debate details with participants
    const debateResult = await query(
      `SELECT
        d.*,
        json_agg(
          json_build_object(
            'student_name', dp.student_name,
            'team', dp.team,
            'position', dp.position,
            'speaker_order', dp.speaker_order
          ) ORDER BY dp.speaker_order
        ) as participants
      FROM debates d
      LEFT JOIN debate_participants dp ON d.id = dp.debate_id
      WHERE d.id = $1
      GROUP BY d.id`,
      [debateId]
    );

    if (debateResult.rows.length === 0) {
      throw new AppError('Debate not found', 404);
    }

    // Get speeches status
    const speechesResult = await query(
      `SELECT
        s.*,
        COUNT(dn.id) as notes_count
      FROM speeches s
      LEFT JOIN debate_notes dn ON s.id = dn.speech_id
      WHERE s.debate_id = $1
      GROUP BY s.id
      ORDER BY s.created_at`,
      [debateId]
    );

    res.json({
      debate: debateResult.rows[0],
      speeches: speechesResult.rows,
    });
  })
);

export default router;
