import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { generateToken } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { User } from '../types/index.js';

const router = Router();

/**
 * GET /api/admin-token
 * Quick endpoint to get admin token (for development/admin access)
 * In production, you should secure this with additional authentication
 */
router.get(
  '/admin-token',
  asyncHandler(async (req: Request, res: Response) => {
    // Get first admin user
    const result = await query<User>(
      "SELECT * FROM users WHERE role = 'admin' LIMIT 1"
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        error: 'No admin user found. Please create an admin user first.',
        hint: 'You can create one using: POST /api/auth/register'
      });
      return;
    }

    const adminUser = result.rows[0];
    const token = generateToken(adminUser);

    res.json({
      token,
      user: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role
      },
      hint: 'Copy this token and paste it when the admin page asks for authentication'
    });
  })
);

/**
 * POST /api/admin-token/create-admin
 * Create a default admin user if none exists
 */
router.post(
  '/admin-token/create-admin',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, name } = req.body;

    const adminEmail = email || 'admin@genalphai.com';
    const adminName = name || 'Admin';

    // Check if admin already exists
    const existing = await query<User>(
      "SELECT * FROM users WHERE email = $1 OR role = 'admin'",
      [adminEmail]
    );

    if (existing.rows.length > 0) {
      const token = generateToken(existing.rows[0]);
      res.json({
        message: 'Admin user already exists',
        token,
        user: {
          id: existing.rows[0].id,
          name: existing.rows[0].name,
          email: existing.rows[0].email
        }
      });
      return;
    }

    // Create new admin user
    const result = await query<User>(
      `INSERT INTO users (email, name, role, institution)
       VALUES ($1, $2, 'admin', 'capstone')
       RETURNING *`,
      [adminEmail, adminName]
    );

    const newAdmin = result.rows[0];
    const token = generateToken(newAdmin);

    res.json({
      message: 'Admin user created successfully',
      token,
      user: {
        id: newAdmin.id,
        name: newAdmin.name,
        email: newAdmin.email
      }
    });
  })
);

export default router;
