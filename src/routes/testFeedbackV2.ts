/**
 * Test Feedback V2 Route - Display Timestamped Playable Feedback
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

/**
 * GET /feedbacktest2
 * Display V2 feedback with playable moments
 */
router.get('/feedbacktest2', async (req: Request, res: Response) => {
  try {
    const feedbackPath = '/home/ubuntu/apps/feedback-backend/test_data/feedback_v2_pharma_result.json';

    if (!fs.existsSync(feedbackPath)) {
      res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>V2 Feedback Not Ready</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 50px; background: #f5f5f5; }
            .error { background: #fff3cd; border: 1px solid #ffc107; padding: 20px; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>⚠️ V2 Feedback Not Generated Yet</h1>
            <p>Run: <code>npm run test:feedbackv2</code></p>
          </div>
        </body>
        </html>
      `);
      return;
    }

    const feedback = JSON.parse(fs.readFileSync(feedbackPath, 'utf-8'));

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Feedback V2 - Playable Moments</title>
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

    .badge {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 0.9em;
      margin: 5px;
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

    /* Audio Player */
    .audio-player {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 30px;
    }

    .audio-player audio {
      width: 100%;
      margin-bottom: 10px;
    }

    .player-info {
      color: #6c757d;
      font-size: 0.9em;
    }

    /* Rubric Scores */
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
    }

    .score-card-title {
      font-weight: bold;
      color: #495057;
      margin-bottom: 10px;
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

    /* Strategic Overview */
    .overview-box {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 25px;
      margin-bottom: 15px;
      border-left: 4px solid #667eea;
    }

    .overview-box h3 {
      color: #667eea;
      margin-bottom: 10px;
    }

    .overview-box p {
      color: #495057;
      line-height: 1.8;
    }

    /* Playable Moments */
    .moment-card {
      background: white;
      border: 2px solid #e9ecef;
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 20px;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .moment-card:hover {
      border-color: #667eea;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
      transform: translateY(-2px);
    }

    .moment-card.critical {
      border-left: 6px solid #dc3545;
    }

    .moment-card.praise {
      border-left: 6px solid #28a745;
    }

    .moment-header {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 15px;
    }

    .moment-icon {
      font-size: 2em;
    }

    .moment-time {
      background: #667eea;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: bold;
      font-size: 1.1em;
    }

    .moment-category {
      text-transform: uppercase;
      font-size: 0.85em;
      font-weight: bold;
      color: #6c757d;
      letter-spacing: 0.5px;
    }

    .moment-quote {
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 15px;
      margin: 15px 0;
      font-style: italic;
      color: #495057;
    }

    .moment-issue {
      color: #495057;
      margin: 15px 0;
      font-size: 1.05em;
      line-height: 1.8;
    }

    .moment-recommendation {
      background: #e7f3ff;
      border-radius: 8px;
      padding: 15px;
      margin: 15px 0;
    }

    .moment-recommendation strong {
      color: #0066cc;
    }

    .play-button {
      background: #667eea;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 25px;
      font-size: 1em;
      cursor: pointer;
      transition: all 0.3s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .play-button:hover {
      background: #5568d3;
      transform: scale(1.05);
    }

    .summary-box {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 8px;
      padding: 25px;
      margin-top: 20px;
      display: flex;
      justify-content: space-around;
    }

    .summary-item {
      text-align: center;
    }

    .summary-label {
      font-size: 0.9em;
      opacity: 0.9;
    }

    .summary-value {
      font-size: 2.5em;
      font-weight: bold;
      margin-top: 5px;
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
      <h1>🎯 Feedback V2 - Playable Moments</h1>
      <p>Test Speech - Timestamped Feedback System</p>
      <div>
        <span class="badge">Gemini 2.5 Pro</span>
        <span class="badge">${feedback.playable_moments.length} Playable Moments</span>
        <span class="badge">${feedback.audio_metadata.duration_seconds}s Duration</span>
      </div>
    </div>

    <div class="content">
      <!-- Audio Player -->
      <div class="section">
        <h2 class="section-title">🎤 Audio Player</h2>
        <div class="audio-player">
          <audio id="speech-audio" controls preload="metadata">
            <source src="${feedback.audio_metadata.url}" type="audio/mpeg">
            Your browser does not support the audio element.
          </audio>
          <div class="player-info">
            Duration: ${Math.floor(feedback.audio_metadata.duration_seconds / 60)}:${(feedback.audio_metadata.duration_seconds % 60).toString().padStart(2, '0')} |
            Chunks: ${feedback.chunks_metadata.total_chunks}
          </div>
        </div>
      </div>

      <!-- Rubric Scores -->
      <div class="section">
        <h2 class="section-title">📊 Rubric Scores</h2>

        <div class="summary-box">
          <div class="summary-item">
            <div class="summary-label">Average Score</div>
            <div class="summary-value">${feedback.rubric_scores.average_score.toFixed(1)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Rubrics Scored</div>
            <div class="summary-value">${feedback.rubric_scores.total_scored_rubrics}/8</div>
          </div>
        </div>

        <div class="scores-grid">
          ${Object.entries(feedback.rubric_scores.scores).map(([rubric, score]) => {
            const isNA = score === 'NA';
            return `
              <div class="score-card">
                <div class="score-card-title">${rubric}</div>
                <div class="score-value ${isNA ? 'na' : ''}">${score}${!isNA ? '/5' : ''}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Strategic Overview -->
      <div class="section">
        <h2 class="section-title">💬 Strategic Overview</h2>

        <div class="overview-box">
          <h3>Hook & Signposting</h3>
          <p>${feedback.strategic_overview.hook_and_signposting}</p>
        </div>

        <div class="overview-box">
          <h3>Strategic Assessment</h3>
          <p>${feedback.strategic_overview.strategic_assessment}</p>
        </div>

        <div class="overview-box">
          <h3>Missing Arguments</h3>
          <p>${feedback.strategic_overview.missing_arguments}</p>
        </div>
      </div>

      <!-- Playable Moments -->
      <div class="section">
        <h2 class="section-title">🎧 Listen to Your Speech - Key Moments</h2>
        <p style="color: #6c757d; margin-bottom: 20px;">
          Click on any moment to jump to that part of your speech
        </p>

        ${feedback.playable_moments.map((moment: any, idx: number) => {
          const icon = moment.severity === 'praise' ? '✅' : '❌';
          const className = moment.severity === 'praise' ? 'praise' : 'critical';

          return `
            <div class="moment-card ${className}" onclick="jumpToTime(${moment.start_seconds})">
              <div class="moment-header">
                <span class="moment-icon">${icon}</span>
                <span class="moment-time">▶ ${moment.start_time}</span>
                <span class="moment-category">${moment.category}</span>
              </div>

              <div class="moment-quote">
                <strong>What you said:</strong><br>
                "${moment.what_they_said}"
              </div>

              <div class="moment-issue">
                ${moment.severity === 'praise' ? '✨' : '⚠️'} ${moment.issue}
              </div>

              <div class="moment-recommendation">
                <strong>💡 ${moment.severity === 'praise' ? 'Keep doing this:' : 'How to fix:'}</strong><br>
                ${moment.recommendation}
              </div>

              <button class="play-button" onclick="event.stopPropagation(); jumpToTime(${moment.start_seconds})">
                ▶ Play ${moment.start_time} - ${moment.end_time} (${moment.end_seconds - moment.start_seconds}s)
              </button>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  </div>

  <script>
    function jumpToTime(seconds) {
      const audio = document.getElementById('speech-audio');

      console.log('jumpToTime called with seconds:', seconds);
      console.log('Audio element:', audio);
      console.log('Audio readyState:', audio.readyState);
      console.log('Audio duration:', audio.duration);

      // Wait for audio to be ready
      if (audio.readyState >= 1) {
        // Metadata is loaded, can seek
        seekToPosition(audio, seconds);
      } else {
        // Wait for metadata to load
        console.log('Waiting for metadata to load...');
        audio.addEventListener('loadedmetadata', function onLoaded() {
          console.log('Metadata loaded, now seeking');
          seekToPosition(audio, seconds);
          audio.removeEventListener('loadedmetadata', onLoaded);
        });
      }
    }

    function seekToPosition(audio, seconds) {
      console.log('Seeking to position:', seconds);

      try {
        // Seek to the position
        audio.currentTime = seconds;
        console.log('Successfully set currentTime to:', audio.currentTime);

        // Try to play the audio
        var playPromise = audio.play();

        if (playPromise !== undefined) {
          playPromise.then(function() {
            console.log('Audio is now playing from', seconds);
            showToast('▶️ Playing from ' + formatTime(seconds));
          }).catch(function(error) {
            console.error('Auto-play prevented:', error);
            showToast('⏱️ Seeked to ' + formatTime(seconds) + ' - Click ▶ to play');
          });
        }

        // Scroll to audio player so user can see it
        audio.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Flash the audio player to show it moved
        audio.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.6)';
        setTimeout(function() {
          audio.style.boxShadow = 'none';
        }, 1000);
      } catch (error) {
        console.error('Error seeking to position:', error);
        showToast('❌ Error: Could not seek to position');
      }
    }

    function formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return mins + ':' + (secs < 10 ? '0' : '') + secs;
    }

    function showToast(message) {
      // Remove existing toast if any
      const existingToast = document.getElementById('toast');
      if (existingToast) {
        existingToast.remove();
      }

      // Create new toast
      const toast = document.createElement('div');
      toast.id = 'toast';
      toast.textContent = message;
      toast.style.cssText = 'position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: #667eea; color: white; padding: 15px 30px; border-radius: 30px; font-weight: bold; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.3); animation: slideUp 0.3s ease;';

      document.body.appendChild(toast);

      // Remove after 2 seconds
      setTimeout(function() {
        toast.style.animation = 'slideDown 0.3s ease';
        setTimeout(function() { toast.remove(); }, 300);
      }, 2000);
    }

    // Preload audio and set up event listeners
    window.addEventListener('DOMContentLoaded', function() {
      const audio = document.getElementById('speech-audio');

      console.log('DOMContentLoaded - Audio element found:', !!audio);

      audio.addEventListener('loadedmetadata', function() {
        console.log('Audio metadata loaded successfully');
        console.log('Duration:', audio.duration);
      });

      audio.addEventListener('error', function(e) {
        console.error('Audio loading error:', e);
        console.error('Audio error code:', audio.error);
      });

      audio.addEventListener('canplay', function() {
        console.log('Audio can play');
      });

      // Try to load the audio
      audio.load();
    });
  </script>

  <style>
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }

    @keyframes slideDown {
      from {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      to {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
    }
  </style>
</body>
</html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Error loading V2 feedback:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 50px; background: #f5f5f5; }
          .error { background: white; padding: 30px; border-radius: 8px; }
          pre { background: #f8f9fa; padding: 15px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>❌ Error</h1>
          <pre>${error}</pre>
        </div>
      </body>
      </html>
    `);
  }
});

export default router;
