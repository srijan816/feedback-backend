import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import {
  parseMotionFile,
  saveMotions,
  getAllMotions,
  getCurrentUnitInfo,
  calculateCurrentUnit,
  getMotionForStudent,
  determineCategory,
} from '../services/motionService.js';
import logger from '../utils/logger.js';

const router = Router();

// Configure multer for file upload
const upload = multer({
  dest: 'uploads/temp/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx, .xls, and .csv files are allowed'));
    }
  },
});

/**
 * POST /api/motions/upload
 * Upload and parse motion data file
 */
router.post(
  '/upload',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError('No file uploaded', 400, 'NO_FILE');
    }

    const tempFilePath = req.file.path;

    try {
      logger.info('Processing motion file upload', {
        originalName: req.file.originalname,
        size: req.file.size,
      });

      // Parse the Excel file
      const motions = parseMotionFile(tempFilePath);

      // Validate that we got some data
      const categoryCount = Object.keys(motions).length;
      if (categoryCount === 0) {
        throw new AppError(
          'No motion data found in file. Please check the file format.',
          400,
          'INVALID_FILE_FORMAT'
        );
      }

      // Save to JSON
      saveMotions(motions);

      // Clean up temp file
      fs.unlinkSync(tempFilePath);

      logger.info('Motion data uploaded successfully', {
        categories: categoryCount,
        uploadedBy: req.user?.id,
      });

      res.json({
        success: true,
        message: 'Motion data uploaded successfully',
        categories: Object.keys(motions),
        categoryCount,
        sampleData: Object.fromEntries(
          Object.entries(motions).slice(0, 2).map(([cat, units]) => [
            cat,
            Object.keys(units).slice(0, 3),
          ])
        ),
      });
    } catch (error) {
      // Clean up temp file on error
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

      if (error instanceof AppError) {
        throw error;
      }

      logger.error('Failed to process motion file', { error });
      throw new AppError(
        'Failed to process motion file. Please check the file format.',
        400,
        'FILE_PROCESSING_ERROR'
      );
    }
  })
);

/**
 * GET /api/motions
 * Get all motion data (admin only)
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const motions = getAllMotions();

    res.json({
      motions,
      categories: Object.keys(motions),
      categoryCount: Object.keys(motions).length,
    });
  })
);

/**
 * GET /api/motions/current
 * Get current unit information (public endpoint)
 */
router.get(
  '/current',
  asyncHandler(async (req: Request, res: Response) => {
    const unitInfo = getCurrentUnitInfo();

    res.json(unitInfo);
  })
);

/**
 * GET /api/motions/test
 * Test motion retrieval for different categories (public endpoint)
 */
router.get(
  '/test',
  asyncHandler(async (req: Request, res: Response) => {
    const currentUnit = calculateCurrentUnit();
    const categories = [
      'G3-4 PSD I',
      'G3-4 PSD II',
      'G5-6 PSD I',
      'G5-6 PSD II',
      'G7-9 PSD I',
      'G7-12 PSD II',
      'G7-12 PSD III',
    ];

    const testResults = categories.map((cat) => ({
      category: cat,
      motion: getMotionForStudent(cat),
    }));

    res.json({
      currentUnit,
      unitInfo: getCurrentUnitInfo(),
      testResults,
    });
  })
);

/**
 * POST /api/motions/query
 * Query motion for specific grade and date (public endpoint)
 */
router.post(
  '/query',
  asyncHandler(async (req: Request, res: Response) => {
    const { grade, date } = req.body;

    const queryDate = date ? new Date(date) : new Date();
    const category = determineCategory(grade);
    const unit = calculateCurrentUnit(queryDate);
    const motion = getMotionForStudent(grade, queryDate);

    res.json({
      grade,
      category,
      unit,
      motion,
      date: queryDate.toISOString(),
    });
  })
);

/**
 * GET /api/motions/template
 * Download CSV template for motion data
 */
router.get('/template', (req: Request, res: Response) => {
  const templatePath = path.join(process.cwd(), 'data', 'motion_template.csv');
  res.download(templatePath, 'motion_template.csv');
});

/**
 * GET /api/motions/all
 * Get all motion data for editing (public endpoint)
 */
router.get(
  '/all',
  asyncHandler(async (req: Request, res: Response) => {
    const motions = getAllMotions();
    res.json(motions);
  })
);

/**
 * POST /api/motions/save
 * Save motion data (public endpoint for now)
 */
router.post(
  '/save',
  asyncHandler(async (req: Request, res: Response) => {
    const motions = req.body;

    if (!motions || typeof motions !== 'object') {
      throw new AppError('Invalid motion data', 400, 'INVALID_DATA');
    }

    // Save the motions
    saveMotions(motions);

    logger.info('Motion data saved via editor', {
      units: Object.keys(motions).length,
    });

    res.json({
      success: true,
      message: 'Motions saved successfully',
      units: Object.keys(motions).length,
    });
  })
);

export default router;
