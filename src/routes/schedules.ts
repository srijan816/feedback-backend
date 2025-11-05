import { Router, Request, Response } from 'express';
import { body, query as queryValidator, validationResult } from 'express-validator';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { query } from '../config/database.js';
import type { Schedule, Student } from '../types/index.js';
import logger from '../utils/logger.js';
import {
  findExcelClassForTimestamp,
  listExcelCoursesForDay,
} from '../services/scheduleExcel.js';

const router = Router();

const HONG_KONG_OFFSET_MINUTES = 8 * 60; // UTC+8 with no daylight savings

interface HongKongContext {
  hkDate: Date;
  dayOfWeek: number;
  time: string;
}

function getHongKongContext(timestamp: Date): HongKongContext {
  const hkDate = new Date(
    timestamp.getTime() + HONG_KONG_OFFSET_MINUTES * 60 * 1000
  );

  return {
    hkDate,
    dayOfWeek: hkDate.getUTCDay(),
    time: `${hkDate.getUTCHours().toString().padStart(2, '0')}:${hkDate
      .getUTCMinutes()
      .toString()
      .padStart(2, '0')}:${hkDate.getUTCSeconds().toString().padStart(2, '0')}`,
  };
}

function minutesToTimeString(minutes: number): string {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const mins = (minutes % 60).toString().padStart(2, '0');
  return `${hours}:${mins}`;
}

/**
 * GET /api/schedule/current
 * Get current class schedule based on teacher and time
 */
router.get(
  '/current',
  authenticateToken,
  [
    queryValidator('teacher_id')
      .optional({ checkFalsy: true })
      .isUUID()
      .withMessage('teacher_id must be a valid UUID'),
    queryValidator('timestamp').isISO8601(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    }

    const requestedTeacherId = req.query.teacher_id as string | undefined;
    const timestamp = req.query.timestamp
      ? new Date(req.query.timestamp as string)
      : null;

    if (!timestamp || Number.isNaN(timestamp.getTime())) {
      throw new AppError('Invalid timestamp', 400, 'INVALID_TIMESTAMP');
    }

    if (!req.user?.id) {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const effectiveTeacherId =
      req.user.role === 'admin' && requestedTeacherId
        ? requestedTeacherId
        : req.user.id;

    if (
      requestedTeacherId &&
      requestedTeacherId !== req.user.id &&
      req.user.role !== 'admin'
    ) {
      logger.warn('Teacher attempted to access another teacher schedule', {
        requesterId: req.user.id,
        requestedTeacherId,
      });
    }

    const teacherResult = await query<{ name: string; id: string }>(
      'SELECT name FROM users WHERE id = $1',
      [effectiveTeacherId]
    );

    if (teacherResult.rows.length === 0) {
      throw new AppError('Teacher not found', 404, 'TEACHER_NOT_FOUND');
    }

    const teacherName = teacherResult.rows[0].name || '';
    const normalizedTeacher = teacherName.toLowerCase();

    const hkContext = getHongKongContext(timestamp);
    const { dayOfWeek, time, hkDate } = hkContext;

    const useExcelSchedule =
      normalizedTeacher.includes('srijan') ||
      normalizedTeacher.includes('test teacher');

    if (useExcelSchedule) {
      const excelClass = findExcelClassForTimestamp(hkDate);

      if (!excelClass) {
        res.status(404).json({
          message: 'No class found in Srijan schedule for the specified time',
        });
        return;
      }

      const additionalOptions = listExcelCoursesForDay(excelClass.dayIndex)
        .filter((course) => course.classId !== excelClass.classId)
        .map((course) => ({
          classId: course.classId,
          startTime: minutesToTimeString(course.startMinutes),
        }));

      res.json({
        classId: excelClass.classId,
        students: excelClass.students,
        suggestedMotion: excelClass.suggestedMotion,
        format: excelClass.format,
        speechTime: excelClass.speechTime,
        alternatives: additionalOptions,
      });
      return;
    }

    // Find matching schedule
    const scheduleResult = await query<Schedule>(
      `SELECT * FROM schedules
       WHERE teacher_id = $1
       AND day_of_week = $2
       AND start_time <= $3
       AND end_time >= $3
       AND is_active = true
       LIMIT 1`,
      [effectiveTeacherId, dayOfWeek, time]
    );

    if (scheduleResult.rows.length === 0) {
      res.status(404).json({
        message: 'No active schedule found for the specified time',
      });
      return;
    }

    const schedule = scheduleResult.rows[0];

    // Get students for this schedule
    const studentsResult = await query<Student>(
      `SELECT s.*
       FROM students s
       JOIN schedule_students ss ON s.id = ss.student_id
       WHERE ss.schedule_id = $1
       AND s.is_active = true`,
      [schedule.id]
    );

    const students = studentsResult.rows.map((student) => ({
      id: student.id,
      name: student.name,
      level: student.level,
    }));

    res.json({
      classId: schedule.class_id,
      students,
      suggestedMotion: schedule.suggested_motion,
      format: schedule.default_format,
      speechTime: schedule.default_speech_time ?? 480,
      alternatives: [],
    });
  })
);

/**
 * POST /api/schedule
 * Create a new schedule (admin only)
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  [
    body('teacher_id').isUUID(),
    body('class_id').isString().trim().notEmpty(),
    body('day_of_week').isInt({ min: 0, max: 6 }),
    body('start_time').matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/),
    body('end_time').matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/),
    body('student_ids').isArray().optional(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400, 'VALIDATION_ERROR');
    }

    const {
      teacher_id,
      class_id,
      day_of_week,
      start_time,
      end_time,
      student_ids,
      suggested_motion,
      default_format,
    } = req.body;

    // Create schedule
    const scheduleResult = await query<Schedule>(
      `INSERT INTO schedules (
        teacher_id, class_id, day_of_week, start_time, end_time,
        suggested_motion, default_format
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        teacher_id,
        class_id,
        day_of_week,
        start_time,
        end_time,
        suggested_motion || null,
        default_format || 'WSDC',
      ]
    );

    const schedule = scheduleResult.rows[0];

    // Add students if provided
    if (student_ids && student_ids.length > 0) {
      for (const studentId of student_ids) {
        await query(
          'INSERT INTO schedule_students (schedule_id, student_id) VALUES ($1, $2)',
          [schedule.id, studentId]
        );
      }
    }

    logger.info('Schedule created', {
      scheduleId: schedule.id,
      teacherId: teacher_id,
      classId: class_id,
    });

    res.status(201).json(schedule);
  })
);

/**
 * PUT /api/schedule/:id
 * Update a schedule (admin only)
 */
router.put(
  '/:id',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const scheduleId = req.params.id;
    // Implementation placeholder
    res.json({ message: 'Schedule update endpoint - to be implemented' });
  })
);

export default router;
