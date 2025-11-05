import { Router, Request, Response } from 'express';
import { query } from '../config/database.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import config from '../config/index.js';

const router = Router();

/**
 * GET /feedback/view/:speechId
 * Display feedback as HTML page
 */
router.get(
  '/view/:speechId',
  asyncHandler(async (req: Request, res: Response) => {
    const speechId = req.params.speechId;

    // Get speech details
    const speechResult = await query(
      `SELECT s.*, d.motion, d.student_level
       FROM speeches s
       LEFT JOIN debates d ON s.debate_id = d.id
       WHERE s.id = $1`,
      [speechId]
    );

    if (speechResult.rows.length === 0) {
      throw new AppError('Speech not found', 404, 'NOT_FOUND');
    }

    const speech = speechResult.rows[0];

    // Get feedback
    const feedbackResult = await query(
      `SELECT * FROM feedback WHERE speech_id = $1`,
      [speechId]
    );

    if (feedbackResult.rows.length === 0) {
      throw new AppError('Feedback not found', 404, 'NOT_FOUND');
    }

    const feedback = feedbackResult.rows[0];

    // Parse JSON fields
    const scores = typeof feedback.scores === 'string'
      ? JSON.parse(feedback.scores)
      : feedback.scores;

    const qualitativeFeedback = typeof feedback.qualitative_feedback === 'string'
      ? JSON.parse(feedback.qualitative_feedback)
      : feedback.qualitative_feedback;

    // Generate HTML
    const html = generateFeedbackHTML(speech, scores, qualitativeFeedback);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  })
);

function generateFeedbackHTML(
  speech: any,
  scores: Record<string, string>,
  qualitativeFeedback: Record<string, string[]>
): string {
  const scoresHTML = Object.entries(scores)
    .map(([category, score]) => `
      <div class="score-item">
        <span class="score-category">${category}</span>
        <span class="score-value">${score}</span>
      </div>
    `)
    .join('');

  const feedbackSections = Object.entries(qualitativeFeedback)
    .map(([section, items]) => {
      const itemsHTML = Array.isArray(items)
        ? items.map(item => `<li>${item}</li>`).join('')
        : `<li>${items}</li>`;

      return `
        <div class="feedback-section">
          <h3>${section}</h3>
          <ul>
            ${itemsHTML}
          </ul>
        </div>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Feedback - ${speech.speaker_name}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background: #f5f5f7;
            padding: 20px;
            line-height: 1.6;
            color: #1d1d1f;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 32px;
            text-align: center;
        }

        .header h1 {
            font-size: 28px;
            margin-bottom: 8px;
            font-weight: 600;
        }

        .header .meta {
            font-size: 16px;
            opacity: 0.95;
        }

        .content {
            padding: 32px;
        }

        .section {
            margin-bottom: 32px;
        }

        .section:last-child {
            margin-bottom: 0;
        }

        .section h2 {
            font-size: 22px;
            margin-bottom: 16px;
            color: #667eea;
            font-weight: 600;
        }

        .scores-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }

        .score-item {
            background: #f5f5f7;
            padding: 16px;
            border-radius: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .score-category {
            font-weight: 500;
            font-size: 14px;
        }

        .score-value {
            font-size: 20px;
            font-weight: 700;
            color: #667eea;
        }

        .feedback-section {
            margin-bottom: 24px;
            background: #f9f9fb;
            padding: 20px;
            border-radius: 12px;
        }

        .feedback-section:last-child {
            margin-bottom: 0;
        }

        .feedback-section h3 {
            font-size: 18px;
            margin-bottom: 12px;
            color: #333;
            font-weight: 600;
        }

        .feedback-section ul {
            list-style: none;
            padding: 0;
        }

        .feedback-section li {
            padding: 8px 0;
            padding-left: 24px;
            position: relative;
            font-size: 15px;
            color: #1d1d1f;
        }

        .feedback-section li:before {
            content: "•";
            position: absolute;
            left: 8px;
            color: #667eea;
            font-weight: bold;
            font-size: 18px;
        }

        .note {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 16px;
            border-radius: 8px;
            margin-top: 16px;
            font-size: 14px;
            color: #856404;
        }

        .footer {
            padding: 24px 32px;
            background: #f9f9fb;
            text-align: center;
            font-size: 14px;
            color: #86868b;
        }

        @media (max-width: 600px) {
            body {
                padding: 12px;
            }

            .header {
                padding: 24px;
            }

            .content {
                padding: 20px;
            }

            .scores-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${speech.speaker_name}</h1>
            <div class="meta">
                ${speech.speaker_position} • ${speech.motion || 'Debate Motion'}
            </div>
        </div>

        <div class="content">
            <div class="section">
                <h2>Scores</h2>
                <div class="scores-grid">
                    ${scoresHTML}
                </div>
            </div>

            <div class="section">
                <h2>Feedback</h2>
                ${feedbackSections}
            </div>
        </div>

        <div class="footer">
            Generated on ${new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
        </div>
    </div>
</body>
</html>
  `;
}

export default router;
