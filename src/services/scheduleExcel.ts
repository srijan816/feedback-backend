import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import type { StudentLevel, DebateFormat } from '../types/index.js';

interface RawExcelStudent {
  id: string | null;
  name: string;
  grade?: string | null;
}

interface RawExcelCourse {
  courseCode: string;
  dayName: string;
  dayIndex: number | null;
  time: string;
  students: RawExcelStudent[];
}

interface CourseRecord {
  classId: string;
  dayIndex: number;
  startMinutes: number;
  students: Array<{
    id: string;
    name: string;
    level: StudentLevel;
  }>;
}

export interface ExcelScheduleSelection {
  classId: string;
  students: Array<{
    id: string;
    name: string;
    level: StudentLevel;
  }>;
  format: DebateFormat;
  suggestedMotion: string;
  speechTime: number;
  startMinutes: number;
  dayIndex: number;
}

const DATA_FILE = path.join(process.cwd(), 'class', 'srijan_schedule.json');
const BUFFER_MINUTES_DEFAULT = 20;
const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = MINUTES_PER_DAY * 7;

let cachedCourses: CourseRecord[] | null = null;
let cachedMtime = 0;

function deriveLevel(grade?: string | null): StudentLevel {
  if (!grade) {
    return 'secondary';
  }

  const normalized = grade.toLowerCase();
  const match = normalized.match(/(\d+)/);
  if (match) {
    const numericGrade = parseInt(match[1], 10);
    if (!Number.isNaN(numericGrade) && numericGrade <= 6) {
      return 'primary';
    }
  }

  if (normalized.includes('primary')) {
    return 'primary';
  }

  return 'secondary';
}

function parseTimeToMinutes(time: string): number | null {
  if (!time) {
    return null;
  }

  const [hoursStr, minutesStr, secondsStr] = time.split(':');
  if (hoursStr === undefined || minutesStr === undefined) {
    return null;
  }

  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  const seconds = secondsStr ? parseInt(secondsStr, 10) : 0;

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds)
  ) {
    return null;
  }

  return hours * 60 + minutes + Math.round(seconds / 60);
}

function ensureCourseCache(): CourseRecord[] {
  try {
    const stats = fs.statSync(DATA_FILE);
    if (cachedCourses && stats.mtimeMs === cachedMtime) {
      return cachedCourses;
    }

    const rawContent = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(rawContent) as RawExcelCourse[];

    const courses: CourseRecord[] = [];

    parsed.forEach((course) => {
      if (
        course.dayIndex === null ||
        course.dayIndex === undefined ||
        !course.time
      ) {
        logger.warn('Skipping course with missing scheduling metadata', {
          courseCode: course.courseCode,
        });
        return;
      }

      const startMinutes = parseTimeToMinutes(course.time);
      if (startMinutes === null) {
        logger.warn('Unable to parse start time for course', {
          courseCode: course.courseCode,
          time: course.time,
        });
        return;
      }

      const students = course.students
        .filter((student) => student.name && student.name.trim())
        .map((student, index) => {
          const id =
            student.id && student.id.trim()
              ? student.id.trim()
              : `${course.courseCode}-${index + 1}`;

          return {
            id,
            name: student.name.trim(),
            level: deriveLevel(student.grade),
          };
        });

      if (students.length === 0) {
        logger.warn('No students found for course in Excel schedule', {
          courseCode: course.courseCode,
        });
        return;
      }

      courses.push({
        classId: course.courseCode,
        dayIndex: course.dayIndex,
        startMinutes,
        students,
      });
    });

    courses.sort((a, b) => {
      if (a.dayIndex === b.dayIndex) {
        return a.startMinutes - b.startMinutes;
      }
      return a.dayIndex - b.dayIndex;
    });

    cachedCourses = courses;
    cachedMtime = stats.mtimeMs;
    return courses;
  } catch (error) {
    logger.error('Failed to load Srijan schedule JSON', { error });
    cachedCourses = [];
    cachedMtime = 0;
    return cachedCourses;
  }
}

export function findExcelClassForTimestamp(
  hongKongDate: Date,
  bufferMinutes: number = BUFFER_MINUTES_DEFAULT
): ExcelScheduleSelection | null {
  const courses = ensureCourseCache();
  if (courses.length === 0) {
    return null;
  }

  const currentDayIndex = hongKongDate.getUTCDay();
  const currentMinutes =
    hongKongDate.getUTCHours() * 60 + hongKongDate.getUTCMinutes();
  const currentAbsolute =
    currentDayIndex * MINUTES_PER_DAY + currentMinutes;

  let bestCourse: CourseRecord | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;

  courses.forEach((course) => {
    const courseStart =
      course.dayIndex * MINUTES_PER_DAY + course.startMinutes;
    const courseEnd = courseStart + bufferMinutes;

    let diff: number;

    if (
      currentAbsolute >= courseStart &&
      currentAbsolute <= courseEnd
    ) {
      diff = 0;
    } else if (courseStart >= currentAbsolute) {
      diff = courseStart - currentAbsolute;
    } else {
      diff =
        courseStart + MINUTES_PER_WEEK - currentAbsolute;
    }

    if (diff < bestDiff) {
      bestDiff = diff;
      bestCourse = course;
    }
  });

  const selectedCourse = bestCourse ?? courses[0];

  return {
    classId: selectedCourse.classId,
    students: selectedCourse.students,
    format: 'WSDC',
    suggestedMotion: '',
    speechTime: 480,
    startMinutes: selectedCourse.startMinutes,
    dayIndex: selectedCourse.dayIndex,
  };
}

export function listExcelCoursesForDay(dayIndex: number): CourseRecord[] {
  const courses = ensureCourseCache();
  return courses
    .filter((course) => course.dayIndex === dayIndex)
    .sort((a, b) => a.startMinutes - b.startMinutes);
}
