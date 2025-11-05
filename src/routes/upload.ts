import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../middleware/errorHandler.js';
import { query } from '../config/database.js';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { analyzeAudio } from '../services/audioAnalysis.js';
import { transcribeAudio } from '../services/transcription.js';

const router = Router();

/**
 * GET /upload
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
      color: #667eea;
      font-weight: 600;
      font-size: 14px;
      background: rgba(102, 126, 234, 0.1);
      padding: 8px 12px;
      border-radius: 6px;
    }

    .file-name:empty {
      display: none;
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
      animation: fadeIn 0.3s ease-in;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .progress-bar {
      width: 100%;
      height: 12px;
      background: #e0e0e0;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      width: 0%;
      transition: width 0.3s ease-out;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
    }

    .progress-text {
      text-align: center;
      margin-top: 12px;
      color: #667eea;
      font-size: 15px;
      font-weight: 600;
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
          // Ensure progress bar shows 100% completion
          progressFill.style.width = '100%';
          progressText.textContent = 'Upload complete! Processing...';

          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            // Wait a moment to show 100% completion before showing success
            setTimeout(() => {
              progress.style.display = 'none';
              showSuccess(response);
            }, 800);
          } else {
            const error = JSON.parse(xhr.responseText);
            progress.style.display = 'none';
            showResult('error', error.error || error.message || 'Upload failed');
          }
          submitBtn.disabled = false;
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

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(config.storage.path, 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.storage.maxUploadSizeMB * 1024 * 1024, // Convert MB to bytes
  },
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.mp3', '.m4a', '.aac', '.wav'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${allowedExts.join(', ')}`));
    }
  },
});

/**
 * POST /upload
 * Upload a full debate MP3 for testing
 *
 * Body:
 * - file: Audio file (MP3, M4A, AAC, WAV)
 * - motion: Debate motion/topic
 * - studentLevel: 'primary' | 'secondary'
 * - institution: Institution name (optional)
 */
router.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { motion, studentLevel = 'secondary', format = 'WSDC', speechTime = 480 } = req.body;

    if (!motion) {
      res.status(400).json({ error: 'Motion is required' });
      return;
    }

    const uploadId = uuidv4();
    const filePath = req.file.path;

    logger.info('Debate upload received', {
      uploadId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      motion,
      studentLevel,
    });

    try {
      // Extract audio metrics immediately
      logger.info('Extracting audio metrics', { uploadId });
      const audioMetrics = await analyzeAudio(filePath);

      // Create a debate session for this upload
      const debateResult = await query(
        `INSERT INTO debate_sessions (motion, format)
         VALUES ($1, $2)
         RETURNING id`,
        [motion, format]
      );

      const debateId = debateResult.rows[0].id;

      // Create a placeholder student for the upload if needed
      const studentResult = await query(
        `INSERT INTO students (name, email)
         VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [`Guest Student ${uploadId.substring(0, 8)}`, `guest_${uploadId}@temp.local`]
      );

      const studentId = studentResult.rows[0].id;

      // Create a speech record for this upload
      const speechResult = await query(
        `INSERT INTO speeches (
          debate_session_id,
          speaker_id,
          position,
          team_side,
          speech_order,
          audio_file_path,
          duration_seconds,
          status,
          transcription_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id`,
        [
          debateId,
          studentId,
          'PM',
          'proposition',
          1,
          filePath,
          audioMetrics.duration,
          'pending',
          JSON.stringify({
            originalName: req.file.originalname,
            uploadId,
            audioMetrics,
            requiresSegmentation: true,
          }),
        ]
      );

      const speechId = speechResult.rows[0].id;

      // Start transcription with speaker diarization in the background
      logger.info('Starting transcription with diarization', { speechId, debateId });

      // Trigger transcription asynchronously with speaker diarization
      transcribeAudio(filePath, {
        duration_seconds: audioMetrics.duration,
        enableDiarization: true,
        minSpeakers: 2,
        maxSpeakers: 10,
      })
        .then(async (result) => {
          // Update speech with transcription results
          await query(
            `UPDATE speeches
             SET transcription_text = $1, status = $2, transcription_data = transcription_data || $3::jsonb, processed_at = NOW()
             WHERE id = $4`,
            [
              result.transcript_text,
              'completed',
              JSON.stringify({ transcription: result }),
              speechId,
            ]
          );
          logger.info('Transcription completed', { speechId, wordCount: result.word_count });
        })
        .catch((error) => {
          logger.error('Transcription failed', { speechId, error });
          query(`UPDATE speeches SET status = $1 WHERE id = $2`, ['error', speechId]);
        });

      res.json({
        success: true,
        uploadId,
        debateId,
        speechId,
        message: 'Upload successful. Transcription with speaker diarization in progress.',
        audioMetrics: {
          duration: audioMetrics.duration,
          volumeConsistency: audioMetrics.volumeConsistency,
          pauses: audioMetrics.silencePauses,
        },
        nextSteps: [
          'Transcription with speaker diarization is being processed',
          'Once complete, you can view and edit speaker segments',
          `Access the speaker editor at /upload/${debateId}/segments`,
        ],
      });
    } catch (error) {
      logger.error('Upload processing failed', { uploadId, error });

      res.status(500).json({
        error: 'Failed to process upload',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * GET /upload/:debateId/download
 * Download the full transcript as a text file
 */
router.get(
  '/:debateId/download',
  asyncHandler(async (req: Request, res: Response) => {
    const { debateId } = req.params;

    // Verify debate exists
    const debateResult = await query(
      'SELECT * FROM debate_sessions WHERE id = $1',
      [debateId]
    );

    if (debateResult.rows.length === 0) {
      res.status(404).json({ error: 'Debate session not found' });
      return;
    }

    const filePath = path.join(config.storage.path, 'uploads', `debate_${debateId}_full_transcript.txt`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      res.status(404).json({
        error: 'Transcript file not found',
        message: 'The transcript may still be processing or needs to be generated'
      });
      return;
    }

    // Set headers for download
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="debate_${debateId}_transcript.txt"`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  })
);

/**
 * GET /upload/:debateId/status
 * Check the status of a debate upload and transcription
 */
router.get(
  '/:debateId/status',
  asyncHandler(async (req: Request, res: Response) => {
    const { debateId } = req.params;

    // Get the debate session
    const debateResult = await query(
      'SELECT * FROM debate_sessions WHERE id = $1',
      [debateId]
    );

    if (debateResult.rows.length === 0) {
      res.status(404).json({ error: 'Debate session not found' });
      return;
    }

    const debate = debateResult.rows[0];

    // Get speeches for this debate session
    const speechesResult = await query(
      `SELECT s.id, st.name as speaker_name, s.position, s.duration_seconds, s.status,
              s.transcription_text IS NOT NULL as has_transcript,
              LENGTH(s.transcription_text) as transcript_length,
              s.processed_at
       FROM speeches s
       LEFT JOIN students st ON s.speaker_id = st.id
       WHERE s.debate_session_id = $1
       ORDER BY s.created_at`,
      [debateId]
    );

    const speeches = speechesResult.rows;
    const allCompleted = speeches.every(s => s.status === 'completed');
    const anyProcessing = speeches.some(s => s.status === 'pending' || s.status === 'processing');

    res.json({
      debateId,
      motion: debate.motion,
      format: debate.format,
      status: allCompleted ? 'completed' : anyProcessing ? 'processing' : 'ready',
      speeches: speeches.map(s => ({
        id: s.id,
        speakerName: s.speaker_name,
        position: s.position,
        duration: s.duration_seconds,
        status: s.status,
        hasTranscript: s.has_transcript,
        transcriptLength: s.transcript_length,
        processedAt: s.processed_at,
      })),
      nextSteps: allCompleted
        ? [
            'Transcription is complete!',
            `View segments at /upload/${debateId}/segments`,
            `Get full transcript data from the segments endpoint`,
          ]
        : [
            'Transcription is still processing. Please wait.',
            `Check status again at /upload/${debateId}/status`,
          ],
    });
  })
);

/**
 * GET /upload/:debateId/segments
 * Get speaker segments for manual editing
 */
router.get(
  '/:debateId/segments',
  asyncHandler(async (req: Request, res: Response) => {
    const { debateId } = req.params;

    // Get the debate session
    const debateResult = await query(
      'SELECT * FROM debate_sessions WHERE id = $1',
      [debateId]
    );

    if (debateResult.rows.length === 0) {
      res.status(404).json({ error: 'Debate session not found' });
      return;
    }

    const debate = debateResult.rows[0];

    // Get speeches for this debate session
    const speechesResult = await query(
      `SELECT s.id, st.name as speaker_name, s.position, s.duration_seconds, s.status,
              s.transcription_text, s.transcription_data
       FROM speeches s
       LEFT JOIN students st ON s.speaker_id = st.id
       WHERE s.debate_session_id = $1
       ORDER BY s.created_at`,
      [debateId]
    );

    const speeches = speechesResult.rows;

    // Check if transcription is complete
    const processingSpeeches = speeches.filter(s => s.status === 'pending' || s.status === 'processing');

    if (processingSpeeches.length > 0) {
      res.json({
        debateId,
        motion: debate.motion,
        status: 'processing',
        message: 'Transcription still in progress. Please wait.',
        speeches: speeches.map(s => ({
          id: s.id,
          speakerName: s.speaker_name,
          position: s.position,
          duration: s.duration_seconds,
          status: s.status,
        })),
      });
      return;
    }

    // Get speech segments if available
    const segmentsResult = await query(
      `SELECT speech_id, segment_type as speaker_label, segment_order,
              start_time, end_time, text
       FROM speech_segments
       WHERE speech_id = ANY($1)
       ORDER BY speech_id, start_time`,
      [speeches.map(s => s.id)]
    );

    const segments = segmentsResult.rows.map(s => ({
      ...s,
      confidence: 1.0, // Add default confidence
    }));

    // If no segments but transcription is complete, parse from transcript metadata
    const allSegments = segments.length > 0 ? segments : extractSegmentsFromTranscript(speeches);

    res.json({
      debateId,
      motion: debate.motion,
      status: 'ready',
      speeches: speeches.map(s => ({
        id: s.id,
        speakerName: s.speaker_name,
        position: s.position,
        duration: s.duration_seconds,
        status: s.status,
        transcript: s.transcription_text,
        wordCount: s.transcription_text ? s.transcription_text.split(/\s+/).length : 0,
      })),
      segments: allSegments,
      instructions: [
        'Review the automatically detected speakers',
        'Edit speaker labels and segment boundaries as needed',
        'Remove irrelevant segments if necessary',
        `Submit changes to /upload/${debateId}/segments/update`,
      ],
    });
  })
);

/**
 * POST /upload/:debateId/segments/update
 * Update speaker segments after manual editing
 */
router.post(
  '/:debateId/segments/update',
  asyncHandler(async (req: Request, res: Response) => {
    const { debateId } = req.params;
    const { segments } = req.body;

    if (!segments || !Array.isArray(segments)) {
      res.status(400).json({ error: 'Segments array is required' });
      return;
    }

    logger.info('Updating speech segments', { debateId, segmentCount: segments.length });

    // Update segments in database
    for (const segment of segments) {
      await query(
        `UPDATE speech_segments
         SET speaker_label = $1, text = $2, confidence = $3
         WHERE speech_id = $4 AND start_time = $5`,
        [segment.speakerLabel, segment.text, segment.confidence || 1.0, segment.speechId, segment.startTime]
      );
    }

    res.json({
      success: true,
      message: 'Segments updated successfully',
      updatedCount: segments.length,
    });
  })
);

/**
 * Helper function to extract segments from transcript metadata
 */
function extractSegmentsFromTranscript(speeches: any[]): any[] {
  const segments: any[] = [];

  for (const speech of speeches) {
    try {
      const transcriptionData = speech.transcription_data;
      if (transcriptionData && transcriptionData.transcription) {
        const transcription = transcriptionData.transcription;

        // Check if diarization data exists
        if (transcription.utterances && Array.isArray(transcription.utterances)) {
          for (const utterance of transcription.utterances) {
            segments.push({
              speechId: speech.id,
              speakerLabel: utterance.speaker,
              startTime: utterance.start / 1000, // Convert ms to seconds
              endTime: utterance.end / 1000,
              text: utterance.text,
              confidence: utterance.confidence || 1.0,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to parse segments from transcription data', { speechId: speech.id, error });
    }
  }

  return segments;
}

export default router;
