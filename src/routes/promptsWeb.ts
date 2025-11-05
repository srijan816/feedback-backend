import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { query } from '../config/database.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /prompts
 * Web interface for viewing and editing prompts
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    // Fetch all prompts with rubrics
    const promptsResult = await query(
      `SELECT * FROM prompt_templates
       ORDER BY student_level, template_type, version DESC`
    );

    const rubricsResult = await query(
      `SELECT * FROM rubrics
       ORDER BY student_level, display_order, category`
    );

    const prompts = promptsResult.rows;
    const rubrics = rubricsResult.rows;

    // Render HTML page
    res.send(generatePromptsPage(prompts, rubrics));
  })
);

/**
 * POST /prompts/update/:id
 * Update a prompt
 */
router.post(
  '/update/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { prompt_text } = req.body;

    if (!prompt_text) {
      res.status(400).json({ error: 'prompt_text is required' });
      return;
    }

    // Get current prompt
    const currentResult = await query(
      'SELECT * FROM prompt_templates WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }

    const current = currentResult.rows[0];

    // Deactivate old version
    await query('UPDATE prompt_templates SET is_active = false WHERE id = $1', [
      id,
    ]);

    // Create new version
    const newVersion = current.version + 1;
    const result = await query(
      `INSERT INTO prompt_templates (
        name, student_level, template_type, prompt_text,
        variables, version, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        current.name,
        current.student_level,
        current.template_type,
        prompt_text,
        current.variables,
        newVersion,
        true,
      ]
    );

    logger.info('Prompt updated via web interface', {
      old_id: id,
      new_id: result.rows[0].id,
      version: newVersion,
    });

    res.json({
      success: true,
      prompt: result.rows[0],
    });
  })
);

/**
 * Generate HTML page for prompts management
 */
function generatePromptsPage(prompts: any[], rubrics: any[]): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prompt Management - Debate Feedback System</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f5f7;
      color: #1d1d1f;
      line-height: 1.6;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    header {
      background: #fff;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      margin-bottom: 30px;
    }

    h1 {
      font-size: 32px;
      font-weight: 600;
      color: #1d1d1f;
      margin-bottom: 8px;
    }

    .subtitle {
      color: #86868b;
      font-size: 16px;
    }

    .tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 30px;
      border-bottom: 1px solid #d2d2d7;
    }

    .tab {
      padding: 12px 24px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      font-size: 16px;
      color: #86868b;
      transition: all 0.2s;
    }

    .tab.active {
      color: #0071e3;
      border-bottom-color: #0071e3;
    }

    .tab:hover {
      color: #0071e3;
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    .prompt-card {
      background: #fff;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      margin-bottom: 20px;
    }

    .prompt-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 16px;
    }

    .prompt-title {
      font-size: 20px;
      font-weight: 600;
      color: #1d1d1f;
    }

    .prompt-meta {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
    }

    .badge.primary {
      background: #e3f2fd;
      color: #1976d2;
    }

    .badge.secondary {
      background: #fff3e0;
      color: #f57c00;
    }

    .badge.active {
      background: #e8f5e9;
      color: #388e3c;
    }

    .badge.inactive {
      background: #f5f5f5;
      color: #757575;
    }

    .prompt-text {
      background: #f5f5f7;
      padding: 16px;
      border-radius: 8px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      white-space: pre-wrap;
      margin-bottom: 16px;
      max-height: 400px;
      overflow-y: auto;
    }

    .variables {
      margin-top: 16px;
      padding: 12px;
      background: #fff9e6;
      border-radius: 8px;
      border-left: 3px solid #ffb020;
    }

    .variables-title {
      font-weight: 600;
      margin-bottom: 8px;
      color: #6b4700;
    }

    .variable-tag {
      display: inline-block;
      background: #fff;
      padding: 4px 8px;
      border-radius: 4px;
      margin: 4px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 12px;
      color: #6b4700;
      border: 1px solid #f5d88c;
    }

    .button {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .button-primary {
      background: #0071e3;
      color: #fff;
    }

    .button-primary:hover {
      background: #0077ed;
    }

    .button-secondary {
      background: #f5f5f7;
      color: #1d1d1f;
    }

    .button-secondary:hover {
      background: #e8e8ed;
    }

    .edit-mode {
      margin-top: 16px;
    }

    .edit-mode textarea {
      width: 100%;
      min-height: 300px;
      padding: 16px;
      border: 1px solid #d2d2d7;
      border-radius: 8px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      resize: vertical;
    }

    .edit-actions {
      display: flex;
      gap: 12px;
      margin-top: 12px;
    }

    .rubrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }

    .rubric-card {
      background: #fff;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }

    .rubric-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .rubric-desc {
      color: #86868b;
      font-size: 14px;
      margin-bottom: 12px;
    }

    .rubric-scoring {
      font-size: 13px;
      color: #0071e3;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Prompt Management</h1>
      <p class="subtitle">Manage feedback generation prompts and rubrics for the debate feedback system</p>
    </header>

    <div class="tabs">
      <button class="tab active" onclick="showTab('prompts')">Prompts</button>
      <button class="tab" onclick="showTab('rubrics')">Rubrics</button>
    </div>

    <div id="prompts-tab" class="tab-content active">
      ${prompts.map((prompt) => generatePromptCard(prompt)).join('')}
    </div>

    <div id="rubrics-tab" class="tab-content">
      <div class="rubrics-grid">
        ${rubrics.map((rubric) => generateRubricCard(rubric)).join('')}
      </div>
    </div>
  </div>

  <script>
    function showTab(tabName) {
      document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

      event.target.classList.add('active');
      document.getElementById(tabName + '-tab').classList.add('active');
    }

    function toggleEdit(id) {
      const viewMode = document.getElementById('view-' + id);
      const editMode = document.getElementById('edit-' + id);

      if (editMode.style.display === 'none') {
        viewMode.style.display = 'none';
        editMode.style.display = 'block';
      } else {
        viewMode.style.display = 'block';
        editMode.style.display = 'none';
      }
    }

    async function savePrompt(id) {
      const textarea = document.getElementById('textarea-' + id);
      const promptText = textarea.value;

      try {
        const response = await fetch('/prompts/update/' + id, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt_text: promptText }),
        });

        if (response.ok) {
          alert('Prompt updated successfully! Refreshing page...');
          window.location.reload();
        } else {
          alert('Failed to update prompt');
        }
      } catch (error) {
        alert('Error updating prompt: ' + error.message);
      }
    }

    function extractVariables(text) {
      const matches = text.match(/\\{[^}]+\\}/g);
      return matches ? [...new Set(matches)] : [];
    }
  </script>
</body>
</html>
  `;
}

function generatePromptCard(prompt: any): string {
  const variables = extractVariables(prompt.prompt_text);

  return `
    <div class="prompt-card">
      <div class="prompt-header">
        <div>
          <div class="prompt-title">${prompt.name}</div>
          <div class="prompt-meta">
            <span class="badge ${prompt.student_level === 'primary' ? 'primary' : 'secondary'}">
              ${prompt.student_level.toUpperCase()}
            </span>
            <span class="badge">v${prompt.version}</span>
            <span class="badge ${prompt.is_active ? 'active' : 'inactive'}">
              ${prompt.is_active ? 'Active' : 'Inactive'}
            </span>
            <span class="badge">${prompt.template_type}</span>
          </div>
        </div>
        <button class="button button-secondary" onclick="toggleEdit('${prompt.id}')">
          Edit
        </button>
      </div>

      <div id="view-${prompt.id}">
        <div class="prompt-text">${escapeHtml(prompt.prompt_text)}</div>

        ${
          variables.length > 0
            ? `
        <div class="variables">
          <div class="variables-title">Variables used in this prompt:</div>
          ${variables.map((v) => `<span class="variable-tag">${v}</span>`).join('')}
        </div>
        `
            : ''
        }
      </div>

      <div id="edit-${prompt.id}" class="edit-mode" style="display: none;">
        <textarea id="textarea-${prompt.id}">${escapeHtml(prompt.prompt_text)}</textarea>
        <div class="edit-actions">
          <button class="button button-primary" onclick="savePrompt('${prompt.id}')">
            Save Changes
          </button>
          <button class="button button-secondary" onclick="toggleEdit('${prompt.id}')">
            Cancel
          </button>
        </div>
      </div>
    </div>
  `;
}

function generateRubricCard(rubric: any): string {
  return `
    <div class="rubric-card">
      <div class="prompt-meta">
        <span class="badge ${rubric.student_level === 'primary' ? 'primary' : rubric.student_level === 'secondary' ? 'secondary' : 'inactive'}">
          ${rubric.student_level.toUpperCase()}
        </span>
        <span class="badge ${rubric.is_active ? 'active' : 'inactive'}">
          ${rubric.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>
      <div class="rubric-title">${rubric.name}</div>
      <div class="rubric-desc">${rubric.description || 'No description'}</div>
      <div class="rubric-scoring">Scoring: ${rubric.scoring_type}</div>
    </div>
  `;
}

function extractVariables(text: string): string[] {
  const matches = text.match(/\{[^}]+\}/g);
  return matches ? [...new Set(matches)] : [];
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export default router;
