import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import logger from '../utils/logger.js';

// Category definitions for student classification
export type StudentCategory =
  | 'G3-4 PSD I'
  | 'G3-4 PSD II'
  | 'G5-6 PSD I'
  | 'G5-6 PSD II'
  | 'G7-9 PSD I'
  | 'G7-12 PSD II'
  | 'G7-12 PSD III';

interface MotionData {
  [category: string]: {
    [unit: string]: string;
  };
}

interface UnitConfig {
  baseDate: Date; // The reference Thursday for a known unit
  baseUnit: string; // The unit for that reference Thursday (e.g., "3.2")
}

const MOTION_DATA_FILE = path.join(process.cwd(), 'data', 'motions.json');
const HK_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8

// Reference: November 6, 2025 (Thursday) = Unit 3.2
const UNIT_CONFIG: UnitConfig = {
  baseDate: new Date('2025-11-06T00:00:00Z'), // Thursday Nov 6, 2025 in UTC
  baseUnit: '3.2',
};

let cachedMotions: MotionData | null = null;
let cachedMtime = 0;

/**
 * Convert Hong Kong time to UTC
 */
function hkToUtc(hkDate: Date): Date {
  return new Date(hkDate.getTime() - HK_OFFSET_MS);
}

/**
 * Convert UTC to Hong Kong time
 */
function utcToHk(utcDate: Date): Date {
  return new Date(utcDate.getTime() + HK_OFFSET_MS);
}

/**
 * Get the most recent Thursday (or today if it's Thursday) in HK time
 */
function getMostRecentThursday(date: Date): Date {
  const hkDate = utcToHk(date);
  const dayOfWeek = hkDate.getUTCDay(); // 0=Sunday, 4=Thursday

  // Calculate days since last Thursday
  const daysSinceThursday = (dayOfWeek + 3) % 7; // 0 if Thursday, 1-6 otherwise

  const thursday = new Date(hkDate);
  thursday.setUTCDate(thursday.getUTCDate() - daysSinceThursday);
  thursday.setUTCHours(0, 0, 0, 0);

  return hkToUtc(thursday);
}

/**
 * Parse unit string (e.g., "3.2") into major and minor numbers
 */
function parseUnit(unit: string): { major: number; minor: number } | null {
  const match = unit.match(/^(\d+)\.(\d+)$/);
  if (!match) return null;

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
  };
}

/**
 * Format unit from major and minor numbers
 */
function formatUnit(major: number, minor: number): string {
  return `${major}.${minor}`;
}

/**
 * Increment unit (e.g., 3.2 -> 3.3, 3.3 -> 4.1)
 */
function incrementUnit(unit: string): string {
  const parsed = parseUnit(unit);
  if (!parsed) return unit;

  let { major, minor } = parsed;
  minor++;

  // Assuming units go up to .3, then reset to next major
  if (minor > 3) {
    major++;
    minor = 1;
  }

  return formatUnit(major, minor);
}

/**
 * Decrement unit (e.g., 3.2 -> 3.1, 3.1 -> 2.3)
 */
function decrementUnit(unit: string): string {
  const parsed = parseUnit(unit);
  if (!parsed) return unit;

  let { major, minor } = parsed;
  minor--;

  if (minor < 1) {
    if (major > 1) {
      major--;
      minor = 3;
    } else {
      // Don't go below 1.1
      return '1.1';
    }
  }

  return formatUnit(major, minor);
}

/**
 * Calculate current unit based on date
 * Units advance every Thursday in Hong Kong time
 */
export function calculateCurrentUnit(date: Date = new Date()): string {
  const currentThursday = getMostRecentThursday(date);
  const baseThursday = getMostRecentThursday(UNIT_CONFIG.baseDate);

  // Calculate week difference
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weekDiff = Math.round((currentThursday.getTime() - baseThursday.getTime()) / msPerWeek);

  // Apply week difference to base unit
  let currentUnit = UNIT_CONFIG.baseUnit;

  if (weekDiff > 0) {
    // Moving forward
    for (let i = 0; i < weekDiff; i++) {
      currentUnit = incrementUnit(currentUnit);
    }
  } else if (weekDiff < 0) {
    // Moving backward
    for (let i = 0; i < Math.abs(weekDiff); i++) {
      currentUnit = decrementUnit(currentUnit);
    }
  }

  return currentUnit;
}

/**
 * Determine student category from grade string
 */
export function determineCategory(gradeStr: string | null | undefined): StudentCategory | null {
  if (!gradeStr) return null;

  const normalized = gradeStr.toLowerCase().trim();

  // Match patterns like "G3-4 PSD I", "g3-4 psd 1", etc.
  const patterns: [RegExp, StudentCategory][] = [
    [/g3[-\s]*4.*psd\s*(i|1)(?!\s*i)/i, 'G3-4 PSD I'],
    [/g3[-\s]*4.*psd\s*(ii|2)/i, 'G3-4 PSD II'],
    [/g5[-\s]*6.*psd\s*(i|1)(?!\s*i)/i, 'G5-6 PSD I'],
    [/g5[-\s]*6.*psd\s*(ii|2)/i, 'G5-6 PSD II'],
    [/g7[-\s]*9.*psd\s*(i|1)(?!\s*i)/i, 'G7-9 PSD I'],
    [/g7[-\s]*12.*psd\s*(ii|2)/i, 'G7-12 PSD II'],
    [/g7[-\s]*12.*psd\s*(iii|3)/i, 'G7-12 PSD III'],
  ];

  for (const [pattern, category] of patterns) {
    if (pattern.test(normalized)) {
      return category;
    }
  }

  // Fallback: try to extract just grade number
  const gradeMatch = normalized.match(/(\d+)/);
  if (gradeMatch) {
    const grade = parseInt(gradeMatch[1], 10);
    if (grade >= 3 && grade <= 4) return 'G3-4 PSD I';
    if (grade >= 5 && grade <= 6) return 'G5-6 PSD I';
    if (grade >= 7 && grade <= 9) return 'G7-9 PSD I';
    if (grade >= 10 && grade <= 12) return 'G7-12 PSD II';
  }

  return null;
}

/**
 * Load cached motions from JSON file
 */
function loadMotions(): MotionData {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(MOTION_DATA_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Check if file exists
    if (!fs.existsSync(MOTION_DATA_FILE)) {
      logger.info('Motion data file does not exist, returning empty data');
      return {};
    }

    const stats = fs.statSync(MOTION_DATA_FILE);

    // Return cached if available and file hasn't changed
    if (cachedMotions && stats.mtimeMs === cachedMtime) {
      return cachedMotions;
    }

    // Read and parse
    const content = fs.readFileSync(MOTION_DATA_FILE, 'utf-8');
    const motions = JSON.parse(content) as MotionData;

    cachedMotions = motions;
    cachedMtime = stats.mtimeMs;

    logger.info('Motion data loaded successfully', {
      categories: Object.keys(motions).length,
    });

    return motions;
  } catch (error) {
    logger.error('Failed to load motion data', { error });
    return {};
  }
}

/**
 * Parse Excel/CSV file and extract motion data
 */
export function parseMotionFile(filePath: string): MotionData {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to JSON with header row
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

  if (rawData.length < 2) {
    throw new Error('Excel file must have at least 2 rows (header + data)');
  }

  // First row is units (columns)
  const units = rawData[0].slice(1).filter(Boolean).map(u => String(u).trim());

  const motions: MotionData = {};

  // Process each category row
  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const category = String(row[0]).trim();
    if (!category) continue;

    motions[category] = {};

    // Map each unit to its motion
    for (let j = 0; j < units.length; j++) {
      const motion = row[j + 1];
      if (motion) {
        motions[category][units[j]] = String(motion).trim();
      }
    }
  }

  logger.info('Motion file parsed successfully', {
    categories: Object.keys(motions).length,
    units: units.length,
  });

  return motions;
}

/**
 * Save motion data to JSON file
 */
export function saveMotions(motions: MotionData): void {
  const dataDir = path.dirname(MOTION_DATA_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(MOTION_DATA_FILE, JSON.stringify(motions, null, 2), 'utf-8');

  // Invalidate cache
  cachedMotions = null;
  cachedMtime = 0;

  logger.info('Motion data saved successfully');
}

/**
 * Get motion for a specific category and unit
 */
export function getMotion(category: StudentCategory | null, unit: string): string {
  const motions = loadMotions();

  if (!category) {
    return ''; // No category, no motion
  }

  const categoryMotions = motions[category];
  if (!categoryMotions) {
    logger.warn('No motions found for category', { category });
    return '';
  }

  const motion = categoryMotions[unit];
  if (!motion) {
    logger.warn('No motion found for unit', { category, unit });
    return '';
  }

  return motion;
}

/**
 * Get motion based on student grade and current date
 */
export function getMotionForStudent(
  gradeStr: string | null | undefined,
  date: Date = new Date()
): string {
  const category = determineCategory(gradeStr);
  const unit = calculateCurrentUnit(date);

  logger.info('Getting motion for student', { gradeStr, category, unit });

  return getMotion(category, unit);
}

/**
 * Get all available motions (for admin purposes)
 */
export function getAllMotions(): MotionData {
  return loadMotions();
}

/**
 * Get current unit info for debugging/display
 */
export function getCurrentUnitInfo(date: Date = new Date()) {
  const unit = calculateCurrentUnit(date);
  const currentThursday = getMostRecentThursday(date);
  const hkThursday = utcToHk(currentThursday);

  return {
    currentUnit: unit,
    currentThursday: currentThursday.toISOString(),
    currentThursdayHK: hkThursday.toISOString(),
    baseDate: UNIT_CONFIG.baseDate.toISOString(),
    baseUnit: UNIT_CONFIG.baseUnit,
  };
}
