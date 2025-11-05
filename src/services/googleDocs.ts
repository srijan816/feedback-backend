import { google } from 'googleapis';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { StudentLevel } from '../types/index.js';

interface FeedbackData {
  student_name: string;
  date: string;
  motion: string;
  speaker_position: string;
  duration: number;
  scores: Record<string, number | 'NA'>;
  qualitative_feedback: Record<string, string[]>;
}

/**
 * Create Google Docs auth client
 */
function getAuthClient() {
  if (!config.googleCloud.clientEmail || !config.googleCloud.privateKey) {
    logger.warn('Google Cloud credentials not configured, using mock mode');
    return null;
  }

  return new google.auth.JWT({
    email: config.googleCloud.clientEmail,
    key: config.googleCloud.privateKey,
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive',
    ],
  });
}

/**
 * Create feedback document
 */
export async function createFeedbackDocument(
  feedbackData: FeedbackData,
  student_level: StudentLevel,
  teacher_email?: string
): Promise<string> {
  try {
    const auth = getAuthClient();

    // If no Google credentials, return mock URL
    if (!auth) {
      const mockUrl = `https://docs.google.com/document/d/mock-${Date.now()}/edit`;
      logger.info('Using mock Google Docs URL (no credentials configured)', {
        url: mockUrl,
      });
      return mockUrl;
    }

    const docs = google.docs({ version: 'v1', auth });
    const drive = google.drive({ version: 'v3', auth });

    // Create document
    const doc = await docs.documents.create({
      requestBody: {
        title: `Debate Feedback - ${feedbackData.student_name} - ${feedbackData.motion.substring(0, 50)}`,
      },
    });

    const documentId = doc.data.documentId!;

    // Generate document content
    const content = generateDocumentContent(feedbackData, student_level);

    // Insert content
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: content,
      },
    });

    // Set permissions
    // Teacher has editor access
    if (teacher_email) {
      await drive.permissions.create({
        fileId: documentId,
        requestBody: {
          role: 'writer',
          type: 'user',
          emailAddress: teacher_email,
        },
      });
    }

    // Anyone with link can view
    await drive.permissions.create({
      fileId: documentId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;

    logger.info('Google Docs feedback created', {
      documentId,
      url: docUrl,
      student: feedbackData.student_name,
    });

    return docUrl;
  } catch (error) {
    logger.error('Failed to create Google Docs feedback', { error });
    throw error;
  }
}

/**
 * Generate document content requests for Google Docs API
 */
function generateDocumentContent(
  data: FeedbackData,
  student_level: StudentLevel
): any[] {
  const requests: any[] = [];

  let index = 1;

  // Title
  requests.push({
    insertText: {
      location: { index },
      text: `DEBATE FEEDBACK REPORT - ${student_level.toUpperCase()} LEVEL\n\n`,
    },
  });
  index += `DEBATE FEEDBACK REPORT - ${student_level.toUpperCase()} LEVEL\n\n`.length;

  // Student info
  const studentInfo = `Student Name: ${data.student_name}
Date: ${data.date}
Debate Motion: ${data.motion}
Speaker Position: ${data.speaker_position}
Speech Duration: ${data.duration} seconds

────────────────────────────────────────────────────────────

SCORES (1 = Needs Improvement, 5 = Excellent, NA = Not Applicable)

`;

  requests.push({
    insertText: {
      location: { index },
      text: studentInfo,
    },
  });
  index += studentInfo.length;

  // Scores table
  for (const [rubric, score] of Object.entries(data.scores)) {
    const scoreLine = `${rubric}: ${score}\n`;
    requests.push({
      insertText: {
        location: { index },
        text: scoreLine,
      },
    });
    index += scoreLine.length;
  }

  // Feedback sections
  const feedbackHeader = `\n────────────────────────────────────────────────────────────

TEACHER'S COMMENTS

`;
  requests.push({
    insertText: {
      location: { index },
      text: feedbackHeader,
    },
  });
  index += feedbackHeader.length;

  // Qualitative feedback
  for (const [category, points] of Object.entries(data.qualitative_feedback)) {
    const categoryHeader = `\n✦ ${category.toUpperCase()}\n`;
    requests.push({
      insertText: {
        location: { index },
        text: categoryHeader,
      },
    });
    index += categoryHeader.length;

    for (const point of points) {
      const bullet = `  • ${point}\n`;
      requests.push({
        insertText: {
          location: { index },
          text: bullet,
        },
      });
      index += bullet.length;
    }
  }

  // Footer
  const footer = `\n────────────────────────────────────────────────────────────

Generated by Capstone Debate Feedback System
Powered by AI Analysis with AssemblyAI Slam-1 & Google Gemini 2.5
`;

  requests.push({
    insertText: {
      location: { index },
      text: footer,
    },
  });

  return requests;
}
