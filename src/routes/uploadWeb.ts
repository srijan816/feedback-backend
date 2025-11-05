import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /upload-debate
 * Serve HTML upload interface
 */
router.get('/', (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Upload Debate Recording</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 600px;
      width: 100%;
      padding: 40px;
    }

    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 28px;
    }

    .subtitle {
      color: #666;
      margin-bottom: 30px;
      font-size: 14px;
    }

    .form-group {
      margin-bottom: 25px;
    }

    label {
      display: block;
      margin-bottom: 8px;
      color: #333;
      font-weight: 600;
      font-size: 14px;
    }

    input[type="text"],
    select {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 15px;
      transition: border-color 0.3s;
    }

    input[type="text"]:focus,
    select:focus {
      outline: none;
      border-color: #667eea;
    }

    .file-input-wrapper {
      position: relative;
      width: 100%;
      height: 150px;
      border: 3px dashed #e0e0e0;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      transition: all 0.3s;
      background: #f8f9fa;
    }

    .file-input-wrapper:hover {
      border-color: #667eea;
      background: #f0f2ff;
    }

    .file-input-wrapper.dragover {
      border-color: #667eea;
      background: #f0f2ff;
      transform: scale(1.02);
    }

    .file-input-wrapper input[type="file"] {
      position: absolute;
      opacity: 0;
      width: 100%;
      height: 100%;
      cursor: pointer;
    }

    .file-icon {
      font-size: 48px;
      margin-bottom: 10px;
      color: #667eea;
    }

    .file-text {
      color: #666;
      font-size: 14px;
      text-align: center;
    }

    .file-name {
      margin-top: 10px;
      color: #333;
      font-weight: 600;
      font-size: 14px;
    }

    .submit-btn {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .submit-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }

    .submit-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .progress {
      display: none;
      margin-top: 20px;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      width: 0%;
      transition: width 0.3s;
    }

    .progress-text {
      text-align: center;
      margin-top: 10px;
      color: #666;
      font-size: 14px;
    }

    .result {
      display: none;
      margin-top: 20px;
      padding: 20px;
      border-radius: 8px;
      font-size: 14px;
    }

    .result.success {
      background: #d4edda;
      border: 2px solid #28a745;
      color: #155724;
    }

    .result.error {
      background: #f8d7da;
      border: 2px solid #dc3545;
      color: #721c24;
    }

    .result h3 {
      margin-bottom: 10px;
      font-size: 16px;
    }

    .result ul {
      margin-left: 20px;
      margin-top: 10px;
    }

    .result li {
      margin: 5px 0;
    }

    .info-box {
      background: #e7f3ff;
      border-left: 4px solid #2196F3;
      padding: 15px;
      margin-bottom: 25px;
      border-radius: 4px;
      font-size: 13px;
      color: #0d47a1;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Upload Debate Recording</h1>
    <p class="subtitle">Upload a full debate MP3 for AI-powered transcription and feedback</p>

    <div class="info-box">
      <strong>Supported formats:</strong> MP3, M4A, AAC, WAV<br>
      <strong>Max file size:</strong> 100 MB
    </div>

    <form id="uploadForm">
      <div class="form-group">
        <label for="motion">Debate Motion *</label>
        <input
          type="text"
          id="motion"
          name="motion"
          placeholder="e.g., This house believes that social media does more harm than good"
          required
        >
      </div>

      <div class="form-group">
        <label for="studentLevel">Student Level *</label>
        <select id="studentLevel" name="studentLevel" required>
          <option value="">Select level...</option>
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
        </select>
      </div>

      <div class="form-group">
        <label>Audio File *</label>
        <div class="file-input-wrapper" id="fileWrapper">
          <input type="file" id="file" name="file" accept=".mp3,.m4a,.aac,.wav" required>
          <div class="file-icon">🎤</div>
          <div class="file-text">
            Click to browse or drag and drop your audio file here
          </div>
          <div class="file-name" id="fileName"></div>
        </div>
      </div>

      <button type="submit" class="submit-btn" id="submitBtn">
        Upload and Process
      </button>
    </form>

    <div class="progress" id="progress">
      <div class="progress-bar">
        <div class="progress-fill" id="progressFill"></div>
      </div>
      <div class="progress-text" id="progressText">Uploading...</div>
    </div>

    <div class="result" id="result"></div>
  </div>

  <script>
    const form = document.getElementById('uploadForm');
    const fileInput = document.getElementById('file');
    const fileWrapper = document.getElementById('fileWrapper');
    const fileName = document.getElementById('fileName');
    const submitBtn = document.getElementById('submitBtn');
    const progress = document.getElementById('progress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const result = document.getElementById('result');

    // File drag and drop
    fileWrapper.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileWrapper.classList.add('dragover');
    });

    fileWrapper.addEventListener('dragleave', () => {
      fileWrapper.classList.remove('dragover');
    });

    fileWrapper.addEventListener('drop', (e) => {
      e.preventDefault();
      fileWrapper.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        updateFileName();
      }
    });

    // File selection
    fileInput.addEventListener('change', updateFileName);

    function updateFileName() {
      if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        fileName.textContent = \`\${file.name} (\${sizeMB} MB)\`;
      } else {
        fileName.textContent = '';
      }
    }

    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(form);

      // Validate
      if (!formData.get('file') || !formData.get('motion') || !formData.get('studentLevel')) {
        showResult('error', 'Please fill in all required fields');
        return;
      }

      // Show progress
      submitBtn.disabled = true;
      progress.style.display = 'block';
      result.style.display = 'none';
      progressFill.style.width = '0%';
      progressText.textContent = 'Uploading...';

      try {
        const xhr = new XMLHttpRequest();

        // Progress tracking
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = (e.loaded / e.total) * 100;
            progressFill.style.width = percent + '%';
            progressText.textContent = \`Uploading... \${Math.round(percent)}%\`;
          }
        });

        // Response handling
        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            showSuccess(response);
          } else {
            const error = JSON.parse(xhr.responseText);
            showResult('error', error.error || error.message || 'Upload failed');
          }
          submitBtn.disabled = false;
          progress.style.display = 'none';
        });

        xhr.addEventListener('error', () => {
          showResult('error', 'Network error. Please try again.');
          submitBtn.disabled = false;
          progress.style.display = 'none';
        });

        xhr.open('POST', '/upload');
        xhr.send(formData);

      } catch (error) {
        showResult('error', 'Upload failed: ' + error.message);
        submitBtn.disabled = false;
        progress.style.display = 'none';
      }
    });

    function showSuccess(data) {
      const html = \`
        <h3>✅ Upload Successful!</h3>
        <p><strong>Upload ID:</strong> \${data.uploadId}</p>
        <p><strong>Debate ID:</strong> \${data.debateId}</p>
        <p><strong>Speech ID:</strong> \${data.speechId}</p>
        <p style="margin-top: 15px;"><strong>Audio Metrics:</strong></p>
        <ul>
          <li>Duration: \${Math.round(data.audioMetrics.duration)} seconds</li>
          <li>Volume Consistency: \${data.audioMetrics.volumeConsistency.toFixed(2)}</li>
          <li>Pauses Detected: \${data.audioMetrics.pauses.count}</li>
        </ul>
        <p style="margin-top: 15px;"><strong>Next Steps:</strong></p>
        <ul>
          \${data.nextSteps.map(step => '<li>' + step + '</li>').join('')}
        </ul>
        <p style="margin-top: 15px; font-size: 12px; color: #666;">
          View segments: <a href="/upload/\${data.debateId}/segments" target="_blank">/upload/\${data.debateId}/segments</a>
        </p>
      \`;
      showResult('success', html);
      form.reset();
      fileName.textContent = '';
    }

    function showResult(type, message) {
      result.className = 'result ' + type;
      result.innerHTML = typeof message === 'string' ? '<p>' + message + '</p>' : message;
      result.style.display = 'block';
    }
  </script>
</body>
</html>
  `;

  res.send(html);
});

export default router;
