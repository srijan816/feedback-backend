import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { PromptTemplate, Rubric } from '../types/index.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /api/prompts
 * Get all active prompt templates
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const studentLevel = req.query.student_level as string;

    let queryText = `
      SELECT * FROM prompt_templates
      WHERE is_active = true
    `;
    const params: any[] = [];

    if (studentLevel) {
      queryText += ` AND (student_level = $1 OR student_level = 'both')`;
      params.push(studentLevel);
    }

    queryText += ` ORDER BY name, version DESC`;

    const result = await query<PromptTemplate>(queryText, params);

    res.json({
      prompts: result.rows,
    });
  })
);

/**
 * GET /api/prompts/rubrics
 * Get all active rubrics
 */
router.get(
  '/rubrics',
  asyncHandler(async (req: Request, res: Response) => {
    const studentLevel = req.query.student_level as string;

    let queryText = `
      SELECT * FROM rubrics
      WHERE is_active = true
    `;
    const params: any[] = [];

    if (studentLevel) {
      queryText += ` AND (student_level = $1 OR student_level = 'both')`;
      params.push(studentLevel);
    }

    queryText += ` ORDER BY display_order, category`;

    const result = await query<Rubric>(queryText, params);

    res.json({
      rubrics: result.rows,
    });
  })
);

/**
 * POST /api/prompts
 * Create new prompt template (admin only)
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  [
    body('name').isString().trim().notEmpty(),
    body('student_level').isIn(['primary', 'secondary', 'both']),
    body('template_type').isIn(['scoring', 'qualitative', 'full', 'context']),
    body('prompt_text').isString().trim().notEmpty(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    }

    const { name, student_level, template_type, prompt_text, variables } =
      req.body;

    const result = await query<PromptTemplate>(
      `INSERT INTO prompt_templates (
        name, student_level, template_type, prompt_text, variables, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        name,
        student_level,
        template_type,
        prompt_text,
        variables || null,
        req.user?.id,
      ]
    );

    logger.info('Prompt template created', {
      promptId: result.rows[0].id,
      name,
      createdBy: req.user?.id,
    });

    res.status(201).json(result.rows[0]);
  })
);

/**
 * PUT /api/prompts/:id
 * Update prompt template (creates new version)
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  [body('prompt_text').isString().trim().notEmpty()],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    }

    const promptId = req.params.id;
    const { prompt_text, is_active } = req.body;

    // Get current prompt
    const currentResult = await query<PromptTemplate>(
      'SELECT * FROM prompt_templates WHERE id = $1',
      [promptId]
    );

    if (currentResult.rows.length === 0) {
      throw new AppError('Prompt not found', 404, 'NOT_FOUND');
    }

    const current = currentResult.rows[0];

    // Create new version
    const newVersion = current.version + 1;
    const result = await query<PromptTemplate>(
      `INSERT INTO prompt_templates (
        name, student_level, template_type, prompt_text,
        variables, version, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        current.name,
        current.student_level,
        current.template_type,
        prompt_text,
        current.variables,
        newVersion,
        req.user?.id,
      ]
    );

    // Optionally deactivate old version
    if (is_active) {
      await query(
        'UPDATE prompt_templates SET is_active = false WHERE id = $1',
        [promptId]
      );
    }

    logger.info('Prompt template updated', {
      oldId: promptId,
      newId: result.rows[0].id,
      version: newVersion,
    });

    res.json(result.rows[0]);
  })
);

export default router;
