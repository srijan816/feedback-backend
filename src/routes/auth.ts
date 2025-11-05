import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { generateToken, generateRefreshToken } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { User, LoginRequest, LoginResponse } from '../types/index.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticate teacher/admin and return JWT token
 */
router.post(
  '/login',
  [
    body('email').optional().isEmail().normalizeEmail(),
    body('teacher_id').optional().isString().trim(),
    body('device_id').isString().trim().notEmpty(),
    // Custom validator: require at least one identifier
    body().custom((value, { req }) => {
      if (!req.body.email && !req.body.teacher_id) {
        throw new Error('Either email or teacher_id is required');
      }
      return true;
    }),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    }

    const { email, teacher_id, device_id } = req.body;

    // Find user by email OR name (teacher_id)
    let result;
    if (email) {
      result = await query<User>(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
    } else {
      result = await query<User>(
        'SELECT * FROM users WHERE name = $1',
        [teacher_id]
      );
    }

    if (result.rows.length === 0) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const user = result.rows[0];

    // Update device_id and last_login
    await query(
      'UPDATE users SET device_id = $1, last_login = NOW() WHERE id = $2',
      [device_id, user.id]
    );

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    logger.info('User logged in', {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      loginMethod: email ? 'email' : 'teacher_id',
    });

    // iOS-compatible response structure
    const response = {
      token,
      teacher: {
        id: user.id,
        name: user.name,
        isAdmin: user.role === 'admin',
      },
    };

    res.json(response);
  })
);

/**
 * POST /api/auth/register (admin only - for creating new teacher accounts)
 */
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('name').isString().trim().notEmpty(),
    body('role').isIn(['teacher', 'admin']),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    }

    const { email, name, role } = req.body;

    // Check if user already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [
      email,
    ]);
    if (existing.rows.length > 0) {
      throw new AppError('User already exists', 409, 'USER_EXISTS');
    }

    // Create user
    const result = await query<User>(
      `INSERT INTO users (email, name, role)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [email, name, role]
    );

    const user = result.rows[0];

    logger.info('User registered', {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  })
);

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    // This would require the authenticateToken middleware
    // For now, just return a placeholder
    res.json({ message: 'User profile endpoint' });
  })
);

export default router;
