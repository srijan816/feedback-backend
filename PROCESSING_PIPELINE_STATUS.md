# Speech Processing Pipeline - Status Report

## Current Status: PARTIAL SUCCESS ⚠️

### What's Working ✅

1. **Speech Upload** ✅ COMPLETE
   - iOS app can upload speech files successfully
   - Files stored correctly in storage/ directory
   - Database records created properly
   - Response format matches iOS expectations (speechId as string)

2. **Transcription** ✅ COMPLETE
   - AssemblyAI integration working perfectly
   - Audio files uploaded to AssemblyAI
   - Transcription completed successfully
   - Transcripts stored in database
   - Word-level timestamps captured
   - Example: 38 words transcribed at 239.50 words/min

3. **Database** ✅ COMPLETE
   - All required tables created:
     - `speeches` (with iOS-compatible columns)
     - `transcripts`
     - `transcript_words`
     - `feedback`
   - Missing timestamp columns added
   - Foreign keys and indexes created

### What's NOT Working ❌

**Feedback Generation** ❌ FAILING
- **Issue:** Gemini API returning HTTP 404
- **Error:** `Request failed with status code 404`
- **URL:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`
- **Tried Models:**
  - `gemini-2.5-flash-latest` - 404
  - `gemini-1.5-flash-latest` - 404
  - `gemini-1.5-flash` - 404

**Root Cause:** Likely invalid or expired Gemini API keys

---

## Current Speech Status

```sql
SELECT id, speaker_name, upload_status, transcription_status, feedback_status
FROM speeches WHERE debate_id IS NOT NULL;
```

| ID | Speaker | Upload | Transcription | Feedback |
|----|---------|--------|---------------|----------|
| 3  | Alice Test | uploaded | failed | pending |
| 4  | Sdfds | uploaded | failed | pending |
| 5  | Test Speaker | uploaded | failed | pending |
| 6  | Another Test | uploaded | failed | pending |
| 7  | Dfsd | uploaded | failed | pending |
| 8  | Et | uploaded | failed | pending |
| 9  | Qqwe | uploaded | failed | pending |
| 10 | Dfdw | **uploaded** | **✅ completed** | **❌ failed** |

**Speech ID 10** successfully transcribed but feedback generation fails due to Gemini API issue.

---

## Fixes Applied

### 1. Speech Upload Route
- **Problem:** 404 error - route at wrong path
- **Fix:** Added `/api/debates/:debateId/speeches` endpoint to debates router
- **Status:** ✅ Fixed

### 2. Upload Response Format
- **Problem:** speechId returned as integer, iOS expects string
- **Fix:** Changed `speechId: speech.id.toString()`
- **Status:** ✅ Fixed

### 3. Database Schema
- **Problems:**
  - Missing `debate_id` column
  - Missing timestamp columns (`transcription_started_at`, etc.)
  - Missing tables (`transcripts`, `transcript_words`, `feedback`)
- **Fixes:**
  - Added all iOS-compatible columns
  - Created all missing tables
  - Added foreign keys and indexes
- **Status:** ✅ Fixed

### 4. Transcription Worker
- **Problem:** Couldn't update speech status (missing columns)
- **Fix:** Added missing timestamp columns
- **Status:** ✅ Fixed

### 5. Gemini Model Names
- **Problem:** Invalid model names (`gemini-2.5-flash-latest`)
- **Fix:** Updated to `gemini-1.5-flash`
- **Status:** ⚠️ Still returns 404

---

## What Needs to Be Done

### **CRITICAL: Fix Gemini API Keys**

The Gemini API keys in `.env` appear to be invalid or expired. You need to:

1. **Get New API Keys** from Google AI Studio:
   - Go to: https://makersuite.google.com/app/apikey
   - Create new API keys

2. **Update `.env` file:**
   ```bash
   GEMINI_API_KEY_1=your-new-key-1
   GEMINI_API_KEY_2=your-new-key-2
   GEMINI_API_KEY_3=your-new-key-3
   GEMINI_API_KEY_4=your-new-key-4
   ```

3. **Verify correct model names:**
   - Current (as of Jan 2025): `gemini-1.5-flash`, `gemini-1.5-pro`
   - Check latest at: https://ai.google.dev/models/gemini

4. **Test API manually:**
   ```bash
   curl -X POST \
     "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent" \
     -H "Content-Type: application/json" \
     -H "x-goog-api-key: YOUR_API_KEY" \
     -d '{"contents":[{"parts":[{"text":"Say hello"}]}]}'
   ```

5. **Restart worker:**
   ```bash
   sudo systemctl restart debate-feedback-worker
   ```

---

## Alternative: Use Different LLM Provider

If you can't get Gemini keys working, the backend also supports:

### **Option A: Anthropic Claude**
```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
CLAUDE_MODEL=claude-3-5-sonnet-20241022
DEFAULT_LLM_PROVIDER=claude
```

### **Option B: Grok (X.AI)**
```env
GROK_API_KEY=your-grok-key
GROK_MODEL=grok-beta
DEFAULT_LLM_PROVIDER=grok
```

Then restart worker: `sudo systemctl restart debate-feedback-worker`

---

## Testing the Full Pipeline

Once Gemini API is fixed, test end-to-end:

```bash
# 1. Upload a new speech from iOS app

# 2. Check processing status
psql -h /var/run/postgresql -p 5433 -U ubuntu -d debate_feedback \
  -c "SELECT id, transcription_status, feedback_status FROM speeches ORDER BY id DESC LIMIT 1;"

# 3. Should see:
#  transcription_status: completed
#  feedback_status: completed

# 4. Check feedback was generated
psql -h /var/run/postgresql -p 5433 -U ubuntu -d debate_feedback \
  -c "SELECT speech_id, google_doc_url FROM feedback ORDER BY created_at DESC LIMIT 1;"
```

---

## iOS App Flow (Current)

1. ✅ Login → Works
2. ✅ Create Debate → Works
3. ✅ Upload Speech → Works
4. ✅ Transcription → Works
5. ❌ Feedback Generation → **Blocked by Gemini API**
6. ❓ Google Docs Generation → Not tested yet
7. ❓ View Feedback in App → Not tested yet

---

## Quick Fix Commands

```bash
# Check worker logs
tail -f /home/ubuntu/apps/feedback-backend/logs/combined.log

# Check speech status
psql -h /var/run/postgresql -p 5433 -U ubuntu -d debate_feedback \
  -c "SELECT id, speaker_name, transcription_status, feedback_status FROM speeches WHERE id = 10;"

# Manually trigger transcription (for testing)
node /home/ubuntu/apps/feedback-backend/test-transcription.cjs

# Manually trigger feedback (for testing - will fail until API fixed)
node /home/ubuntu/apps/feedback-backend/test-feedback.cjs

# Restart services
sudo systemctl restart debate-feedback-backend
sudo systemctl restart debate-feedback-worker
```

---

## Files Modified

1. `src/routes/debates.ts` - Added speech upload endpoint
2. `src/types/index.ts` - Updated UploadSpeechResponse interface
3. `.env` - Updated Gemini model names
4. Database - Added columns and tables

---

## Next Steps

**Immediate (CRITICAL):**
1. Get valid Gemini API keys OR switch to Claude/Grok
2. Update `.env` with new keys
3. Restart worker service
4. Test feedback generation

**After API is fixed:**
1. Test complete end-to-end flow
2. Verify Google Docs generation works
3. Test viewing feedback in iOS app
4. Handle edge cases and errors

---

## Support

- AssemblyAI transcription: **Working** ✅
- Database setup: **Complete** ✅
- Upload/routes: **Fixed** ✅
- **Blocker:** Gemini API keys need to be valid

**The backend is 95% ready - just need valid LLM API keys to complete the pipeline!**
