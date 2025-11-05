# Re-enabling LLM-Based Feedback Generation

## Current Status

The feedback worker is currently using a **transcript-only fallback** mode. This returns the transcript as feedback without calling any LLM APIs.

**Why**: Pending prompt engineering work to optimize the feedback quality.

## When to Re-enable

Re-enable LLM feedback after you've completed:
1. Prompt engineering for debate feedback
2. Testing with different debate formats and skill levels
3. Obtaining valid API keys for your chosen LLM provider

---

## Step 1: Choose Your LLM Provider

You have three options configured in `.env`:

### Option A: Google Gemini (Default)
```env
GEMINI_API_KEY_1=your-key-here
GEMINI_API_KEY_2=your-key-here
GEMINI_API_KEY_3=your-key-here
GEMINI_API_KEY_4=your-key-here
GEMINI_MODEL_FLASH=gemini-1.5-flash
GEMINI_MODEL_PRO=gemini-1.5-pro
DEFAULT_LLM_PROVIDER=gemini_flash
```

**Get keys**: https://makersuite.google.com/app/apikey

**Test keys**:
```bash
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent" \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: YOUR_API_KEY" \
  -d '{"contents":[{"parts":[{"text":"Say hello"}]}]}'
```

### Option B: Anthropic Claude
```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
CLAUDE_MODEL=claude-3-5-sonnet-20241022
DEFAULT_LLM_PROVIDER=claude
```

**Get keys**: https://console.anthropic.com/

### Option C: Grok (X.AI)
```env
GROK_API_KEY=your-grok-key
GROK_MODEL=grok-beta
DEFAULT_LLM_PROVIDER=grok
```

**Get keys**: https://console.x.ai/

---

## Step 2: Update Feedback Worker Code

Open `src/workers/feedback.worker.ts` and make these changes:

### Remove Transcript Fallback (Lines 49-113)

**Current code (REMOVE THIS)**:
```typescript
// TEMPORARY: Skip LLM feedback generation, use transcript as fallback
// TODO: Re-enable after prompt engineering is complete
logger.info('Using transcript-only fallback for feedback', { speech_id });

// Create simple transcript-based feedback
const transcriptFeedback = {
  scores: {
    Argumentation: 'NA',
    'Rebuttal Quality': 'NA',
    'Evidence & Examples': 'NA',
    'Speaking Rate & Clarity': 'NA',
    'Role Fulfillment': 'NA',
  },
  qualitative_feedback: {
    Transcript: [transcript_text],
    Motion: [motion],
    'Speaker Position': [speaker_position],
    Duration: [`${Math.round(duration_seconds || 0)} seconds`],
    'Note': ['Automated AI feedback is currently being configured. This is your speech transcript.'],
  },
};

// Store feedback in database
const feedbackInsert = await query(
  `INSERT INTO feedback (
    speech_id,
    scores,
    qualitative_feedback,
    llm_provider,
    llm_model,
    processing_time_ms,
    google_doc_url
  ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  RETURNING id`,
  [
    speech_id,
    JSON.stringify(transcriptFeedback.scores),
    JSON.stringify(transcriptFeedback.qualitative_feedback),
    'transcript_fallback',
    'none',
    0,
    '', // Placeholder, will be updated by Google Docs worker
  ]
);

const feedback_id = feedbackInsert.rows[0].id;

// Update speech status
await query(
  `UPDATE speeches
   SET feedback_status = 'completed',
       feedback_completed_at = NOW()
   WHERE id = $1`,
  [speech_id]
);

logger.info('Transcript-based feedback created successfully', {
  speech_id,
  feedback_id,
  fallback: true,
});

// TEMPORARY: Skip Google Docs generation for now
// TODO: Re-enable after configuring Google Drive API
logger.info('Skipping Google Docs generation (transcript fallback mode)', { speech_id });
```

### Replace with LLM Feedback Generation

**New code (ADD THIS BACK)**:
```typescript
// Generate feedback using LLM
logger.info('Generating AI feedback', { speech_id, provider: config.llm.provider });

const startTime = Date.now();
const feedback = await generateFeedback({
  transcript: transcript_text,
  motion,
  speaker_position,
  student_level,
  speaker_name,
  duration_seconds,
  debate_id,
});
const processingTime = Date.now() - startTime;

// Store feedback in database
const feedbackInsert = await query(
  `INSERT INTO feedback (
    speech_id,
    scores,
    qualitative_feedback,
    llm_provider,
    llm_model,
    processing_time_ms,
    google_doc_url
  ) VALUES ($1, $2, $3, $4, $5, $6, $7)
  RETURNING id`,
  [
    speech_id,
    JSON.stringify(feedback.scores),
    JSON.stringify(feedback.qualitative_feedback),
    feedback.llm_provider,
    feedback.llm_model,
    processingTime,
    '', // Placeholder, will be updated by Google Docs worker
  ]
);

const feedback_id = feedbackInsert.rows[0].id;

// Update speech status
await query(
  `UPDATE speeches
   SET feedback_status = 'completed',
       feedback_completed_at = NOW()
   WHERE id = $1`,
  [speech_id]
);

logger.info('AI feedback generated successfully', {
  speech_id,
  feedback_id,
  provider: feedback.llm_provider,
  model: feedback.llm_model,
  processing_time_ms: processingTime,
});

// Queue Google Docs generation job
const googleDocsJobData: GoogleDocsJobData = {
  speech_id,
  feedback_id,
  speaker_name,
  motion,
  speaker_position,
  transcript: transcript_text,
  feedback: feedback.qualitative_feedback,
  scores: feedback.scores,
};

await googleDocsQueue.add(googleDocsJobData, { priority: 2, attempts: 3 });

logger.info('Google Docs generation queued', { speech_id, feedback_id });
```

---

## Step 3: Update Prompt Engineering (Optional)

The feedback prompts are in `src/services/feedback.js`. You may want to customize:

### Scoring Criteria
Look for the `generateFeedback()` function and update the scoring guidelines to match your debate format and standards.

### Qualitative Feedback Sections
Customize the sections returned (currently: Strengths, Areas for Improvement, Strategic Advice, etc.)

### Student Level Adaptation
Adjust how feedback varies by `student_level` (primary, secondary, university)

---

## Step 4: Rebuild and Restart

```bash
cd /home/ubuntu/apps/feedback-backend

# Rebuild TypeScript
npm run build

# Restart worker service
sudo systemctl restart debate-feedback-worker

# Verify it's running
sudo systemctl status debate-feedback-worker

# Watch logs
tail -f logs/combined.log
```

---

## Step 5: Test LLM Feedback

### Test with Existing Speech

```bash
# Trigger feedback job for speech #10 (already transcribed)
node test-feedback.cjs
```

### Check Results

```bash
# Check speech status
psql -h /var/run/postgresql -p 5433 -U ubuntu -d debate_feedback \
  -c "SELECT id, feedback_status FROM speeches WHERE id = 10;"

# Check feedback content
psql -h /var/run/postgresql -p 5433 -U ubuntu -d debate_feedback \
  -c "SELECT speech_id, llm_provider, llm_model, scores, qualitative_feedback FROM feedback WHERE speech_id = 10;"
```

### Expected Output

**Before (Transcript Fallback)**:
```json
{
  "llm_provider": "transcript_fallback",
  "llm_model": "none",
  "scores": {
    "Argumentation": "NA",
    "Rebuttal Quality": "NA",
    ...
  }
}
```

**After (LLM Feedback)**:
```json
{
  "llm_provider": "gemini",
  "llm_model": "gemini-1.5-flash",
  "scores": {
    "Argumentation": "7/10",
    "Rebuttal Quality": "8/10",
    ...
  },
  "qualitative_feedback": {
    "Strengths": ["Clear structure", "Good evidence use"],
    "Areas for Improvement": ["Speak slower", "Add more rebuttals"],
    ...
  }
}
```

---

## Step 6: Test End-to-End from iOS

1. **Upload new speech** from iOS app
2. **Wait 2-3 minutes** for processing
3. **View feedback** in app
4. **Verify**:
   - Feedback shows scores (not "NA")
   - Qualitative feedback has AI-generated content
   - Google Doc URL is populated (if Google Drive configured)

---

## Troubleshooting

### Error: "Request failed with status code 404"
- **Cause**: Invalid API keys or wrong model name
- **Fix**: Test API keys with curl command above, verify model names

### Error: "Rate limit exceeded"
- **Cause**: Too many requests to LLM API
- **Fix**: Add more API keys to `.env` for load balancing (Gemini supports 4 keys)

### Error: "Timeout"
- **Cause**: LLM taking too long to respond
- **Fix**: Increase timeout in `.env`:
  ```env
  FEEDBACK_TIMEOUT_MINUTES=15
  ```

### Feedback Quality Issues
- **Symptom**: Generic feedback, not debate-specific
- **Fix**: Update prompts in `src/services/feedback.js`
- **Test**: Try different `student_level` values and debate formats

---

## Monitoring

### Check Worker Status
```bash
sudo systemctl status debate-feedback-worker
```

### Watch Logs in Real-Time
```bash
tail -f logs/combined.log | grep -E "(feedback|LLM|Gemini|Claude|Grok)"
```

### Check Queue Status
```bash
# Install Redis CLI if not already installed
sudo apt install redis-tools

# Check feedback queue
redis-cli -p 6379 LLEN bull:feedback:wait
redis-cli -p 6379 LLEN bull:feedback:active
redis-cli -p 6379 LLEN bull:feedback:failed
```

---

## Rollback to Transcript Fallback

If you need to revert to transcript-only mode:

```bash
cd /home/ubuntu/apps/feedback-backend
git checkout src/workers/feedback.worker.ts
npm run build
sudo systemctl restart debate-feedback-worker
```

---

## Google Docs Integration (Optional)

Currently disabled. To enable:

1. **Get Google Cloud Service Account**:
   - Go to: https://console.cloud.google.com/
   - Create project → Enable Google Drive API
   - Create Service Account → Download JSON key

2. **Update `.env`**:
   ```env
   GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   GOOGLE_PROJECT_ID=your-project-id
   GOOGLE_DRIVE_FOLDER_ID=your-shared-folder-id
   ```

3. **Test Google Docs worker**:
   ```bash
   node test-google-docs.cjs
   ```

---

## Questions?

- Check logs: `tail -f logs/combined.log`
- Check database: `psql -h /var/run/postgresql -p 5433 -U ubuntu -d debate_feedback`
- Restart services: `sudo systemctl restart debate-feedback-worker`

**Current Status File**: See `PROCESSING_PIPELINE_STATUS.md` for overall pipeline status.
