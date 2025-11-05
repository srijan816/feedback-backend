/**
 * Test Feedback Route
 * Display combined rubric scores and teacher comments for testing
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

/**
 * Simple markdown to HTML converter for teacher comments
 */
function markdownToHtml(text: string): string {
  let html = text;

  // Convert horizontal rules (---)
  html = html.replace(/^---$/gm, '<hr>');

  // Convert headers with bold (### **Header**)
  html = html.replace(/^###\s+\*\*(.*?)\*\*$/gm, '<h3>$1</h3>');
  // Convert regular headers (### Header)
  html = html.replace(/^###\s+(.*?)$/gm, '<h3>$1</h3>');

  // Convert bold (**text** or __text__)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');

  // Convert italic (*text* or _text_) - must be after bold to avoid conflicts
  html = html.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+?)_/g, '<em>$1</em>');

  // Convert blockquotes (> text)
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // Convert line breaks to paragraphs
  const lines = html.split('\n');
  let inParagraph = false;
  let result = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip if it's already an HTML tag
    if (line.startsWith('<h3>') || line.startsWith('<hr>') || line.startsWith('<blockquote>')) {
      if (inParagraph) {
        result += '</p>\n';
        inParagraph = false;
      }
      result += line + '\n';
    } else if (line === '') {
      if (inParagraph) {
        result += '</p>\n';
        inParagraph = false;
      }
    } else {
      if (!inParagraph) {
        result += '<p>';
        inParagraph = true;
      } else {
        result += ' ';
      }
      result += line;
    }
  }

  if (inParagraph) {
    result += '</p>\n';
  }

  return result;
}

/**
 * GET /feedbacktest1
 * Display the test feedback results in a nice HTML format
 */
router.get('/feedbacktest1', async (req: Request, res: Response) => {
  try {
    // Read the results from test files - use absolute paths
    const rubricScoresPath = '/home/ubuntu/apps/feedback-backend/test_data/rubric_scores_result.json';
    const teacherCommentsPath = '/home/ubuntu/apps/feedback-backend/test_data/teacher_comments_result.txt';

    // Check if files exist
    if (!fs.existsSync(rubricScoresPath) || !fs.existsSync(teacherCommentsPath)) {
      res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Test Feedback - Not Ready</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              max-width: 900px;
              margin: 50px auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .error {
              background: #fff3cd;
              border: 1px solid #ffc107;
              border-radius: 8px;
              padding: 20px;
              color: #856404;
            }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>⚠️ Test Results Not Generated Yet</h1>
            <p>Please run the test scripts first:</p>
            <pre>
export GEMINI_API_KEY=AIzaSyDwdU2z6Dld3hLy8oEvEBy3Lx8-Mxg4y2s
python3 test_rubric_scoring.py
python3 test_teacher_comments.py
            </pre>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Read the files
    const rubricScores = JSON.parse(fs.readFileSync(rubricScoresPath, 'utf-8'));
    const teacherComments = fs.readFileSync(teacherCommentsPath, 'utf-8');

    // Generate HTML response
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Feedback - Gabby (Prop 1)</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      line-height: 1.6;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }

    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }

    .header p {
      font-size: 1.2em;
      opacity: 0.9;
    }

    .content {
      padding: 40px;
    }

    .section {
      margin-bottom: 40px;
    }

    .section-title {
      font-size: 1.8em;
      color: #333;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 3px solid #667eea;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .scores-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }

    .score-card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 20px;
      border-left: 4px solid #667eea;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .score-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
    }

    .score-card-title {
      font-weight: bold;
      color: #495057;
      margin-bottom: 10px;
      font-size: 1.1em;
    }

    .score-value {
      font-size: 2.5em;
      font-weight: bold;
      color: #667eea;
    }

    .score-value.na {
      color: #6c757d;
      font-size: 1.8em;
    }

    .score-justification {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #dee2e6;
      font-size: 0.9em;
      color: #6c757d;
    }

    .summary-box {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 8px;
      padding: 25px;
      margin-top: 20px;
      display: flex;
      justify-content: space-around;
      align-items: center;
    }

    .summary-item {
      text-align: center;
    }

    .summary-label {
      font-size: 0.9em;
      opacity: 0.9;
      margin-bottom: 5px;
    }

    .summary-value {
      font-size: 2.5em;
      font-weight: bold;
    }

    .comments-box {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 30px;
      font-family: 'Georgia', serif;
      line-height: 1.8;
      color: #333;
      border: 1px solid #dee2e6;
    }

    .comments-box h3 {
      color: #667eea;
      font-size: 1.4em;
      margin-top: 25px;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e9ecef;
    }

    .comments-box h3:first-child {
      margin-top: 0;
    }

    .comments-box p {
      margin-bottom: 15px;
    }

    .comments-box strong {
      color: #495057;
      font-weight: 600;
    }

    .comments-box em {
      font-style: italic;
      color: #6c757d;
    }

    .comments-box hr {
      border: none;
      border-top: 1px solid #dee2e6;
      margin: 20px 0;
    }

    .comments-box blockquote {
      border-left: 4px solid #667eea;
      margin: 15px 0;
      padding-left: 20px;
      color: #495057;
      font-style: italic;
      background: #f1f3f5;
      padding: 15px 20px;
      border-radius: 4px;
    }

    .metadata {
      background: #e9ecef;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }

    .metadata-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
    }

    .metadata-item {
      display: flex;
      flex-direction: column;
    }

    .metadata-label {
      font-size: 0.85em;
      color: #6c757d;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 5px;
    }

    .metadata-value {
      font-size: 1.1em;
      color: #333;
      font-weight: 500;
    }

    .badge {
      display: inline-block;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 0.85em;
      font-weight: bold;
      margin-top: 5px;
    }

    .badge-success {
      background: #d4edda;
      color: #155724;
    }

    .badge-info {
      background: #d1ecf1;
      color: #0c5460;
    }

    .word-count {
      text-align: right;
      color: #6c757d;
      font-size: 0.9em;
      margin-top: 10px;
    }

    @media (max-width: 768px) {
      .header h1 {
        font-size: 1.8em;
      }

      .content {
        padding: 20px;
      }

      .scores-grid {
        grid-template-columns: 1fr;
      }

      .summary-box {
        flex-direction: column;
        gap: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 Debate Feedback Test Results</h1>
      <p>Gabby - Proposition First Speaker (WSDC Semi-Final 2021)</p>
    </div>

    <div class="content">
      <!-- Metadata Section -->
      <div class="metadata">
        <div class="metadata-grid">
          <div class="metadata-item">
            <span class="metadata-label">Motion</span>
            <span class="metadata-value">This House would nationalise pharmaceuticals</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Position</span>
            <span class="metadata-value">Proposition 1 (First Speaker)</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Speaking Time</span>
            <span class="metadata-value">08:07</span>
            <span class="badge badge-success">Within target (8:00)</span>
          </div>
          <div class="metadata-item">
            <span class="metadata-label">Models Used</span>
            <span class="metadata-value">
              <span class="badge badge-info">Gemini Flash Latest (Rubrics)</span>
              <span class="badge badge-info">Gemini 2.5 Pro (Comments)</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Rubric Scores Section -->
      <div class="section">
        <h2 class="section-title">
          📊 Rubric Scores
        </h2>

        <div class="summary-box">
          <div class="summary-item">
            <div class="summary-label">Average Score</div>
            <div class="summary-value">${rubricScores.average_score.toFixed(1)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Rubrics Scored</div>
            <div class="summary-value">${rubricScores.total_scored_rubrics}/8</div>
          </div>
        </div>

        <div class="scores-grid">
          ${Object.entries(rubricScores.scores).map(([rubric, score]) => {
            const isNA = score === 'NA';
            const justification = rubricScores.justifications[rubric];
            return `
              <div class="score-card">
                <div class="score-card-title">${rubric}</div>
                <div class="score-value ${isNA ? 'na' : ''}">${score}${!isNA ? '/5' : ''}</div>
                <div class="score-justification">${justification}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Teacher Comments Section -->
      <div class="section">
        <h2 class="section-title">
          💬 Teacher Comments
        </h2>
        <div class="comments-box">${markdownToHtml(teacherComments)}</div>
        <div class="word-count">
          Word Count: ${teacherComments.split(/\s+/).length} words
        </div>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Error generating feedback test page:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 50px; background: #f5f5f5; }
          .error { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>❌ Error Loading Feedback</h1>
          <p>An error occurred while loading the test feedback results.</p>
          <pre>${error}</pre>
        </div>
      </body>
      </html>
    `);
  }
});

export default router;
