# Feedback V2 - Timestamped Playable Moments System

## ✅ Status: Prototype Complete

The V2 feedback system has been successfully implemented and tested. It generates **timestamped, clickable feedback** that students can use to jump to specific moments in their speech audio.

---

## 📁 Generated Files

### Test Results Location:
```
/home/ubuntu/apps/feedback-backend/test_data/feedback_v2_result.json
```

### Core Implementation Files:

1. **Chunking Service** - `src/services/transcriptChunking.ts`
   - Converts word-level timestamps → semantic chunks (60-90s)
   - Groups utterances into meaningful segments
   - Labels chunks: "Hook & Opening", "Model/Setup", "Argument 1", etc.

2. **V2 Feedback Service** - `src/services/feedbackV2.ts`
   - Main generation logic
   - Fetches transcript words from database
   - Calls Gemini 2.5 Pro for analysis
   - Enriches LLM output with timestamp metadata

3. **V2 Prompt Template** - `prompts/FEEDBACK_V2_WITH_TIMESTAMPS.md`
   - Dual-tier feedback structure:
     - Strategic Overview (general observations)
     - Playable Moments (5-6 timestamped clips)
   - Position-aware rubric scoring
   - Prescriptive recommendations

4. **Test Scripts:**
   - `test_feedback_v2.py` - Database preparation
   - `src/test_feedback_v2.ts` - V2 generation test

---

## 🎯 Output Structure

### V2 Feedback Contains:

```typescript
{
  // Same as V1
  rubric_scores: {
    scores: { "Time Management": 5, ... },
    justifications: { ... },
    average_score: 3.7,
    total_scored_rubrics: 6
  },

  // NEW: Strategic overview (non-playable)
  strategic_overview: {
    hook_and_signposting: "Excellent hook connecting...",
    strategic_assessment: "As first speaker, you built...",
    missing_arguments: "A powerful perspective ignored..."
  },

  // NEW: Playable moments with timestamps
  playable_moments: [
    {
      chunk_id: 5,
      start_seconds: 145,
      end_seconds: 180,
      start_time: "02:25",
      end_time: "03:00",
      category: "gap",              // gap | unclear | weak | transition | excellent
      severity: "critical",         // praise | critical
      what_they_said: "Governments are held accountable...",
      issue: "You assert X but don't explain WHY...",
      recommendation: "Establish that a government's primary incentive..."
    }
    // ... 4-5 more moments
  ],

  audio_metadata: {
    url: "/storage/audio.mp3",
    duration_seconds: 487
  },

  chunks_metadata: {
    total_chunks: 8,
    chunk_labels: ["Hook & Opening", "Model/Setup", "Argument 1", ...]
  }
}
```

---

## 🎨 UI Experience (To Be Built)

```
🎤 Audio Player
▶ ━━━━━━●━━━━━━━━━━━━━ 02:25 / 08:07
          ↑
      You are here

📊 Rubric Scores: 3.7/5
(Same as V1)

💬 Strategic Overview
Hook & Signposting: ...
Strategic Assessment: ...
Missing Arguments: ...

🎧 Listen to Your Speech - Key Moments

✅ [▶ 00:05] Strong Hook (EXCELLENT)
┌─────────────────────────────────────┐
│ What you said:                      │
│ "Big Pharma takes advantage of..."  │
└─────────────────────────────────────┘
✨ This was excellent - you immediately establish...
[Play this moment (26 seconds)]

❌ [▶ 02:25] Missing Mechanism (CRITICAL)
┌─────────────────────────────────────┐
│ What you said:                      │
│ "Governments are held accountable   │
│ by voters. There's a huge backlash" │
└─────────────────────────────────────┘
⚠️ You assert governments care but don't explain WHY...
💡 Fix: Establish that a government's primary incentive is re-election...
[Play this moment (30 seconds)]
```

---

## 🔧 How It Works

### Step 1: Fetch Word-Level Data
```sql
SELECT word_index, text, start_ms, end_ms, confidence, speaker
FROM transcript_words
WHERE transcript_id = 7
ORDER BY word_index ASC
```

### Step 2: Create Semantic Chunks
```typescript
// Groups words into 60-90 second blocks
// Natural pause boundaries
// Labels by position (Hook, Setup, Arguments)

const chunks = createSemanticChunks(words, speechDurationMs);
// Result: 8-10 chunks for 8-minute speech
```

### Step 3: Format for LLM
```markdown
[CHUNK_0] [00:00 - 01:00] Hook & Opening
"Big Pharma takes advantage of the desperation..."

[CHUNK_1] [01:00 - 02:00] Model/Setup
"Three points of setup in this debate..."

[CHUNK_5] [02:15 - 03:00] Argument 1
"Governments are held accountable by voters..."
```

### Step 4: LLM Analysis
- Gemini 2.5 Pro analyzes chunked transcript
- Cites CHUNK_ID for each playable moment
- Returns structured JSON

### Step 5: Enrich with Metadata
```typescript
// LLM says: { chunk_id: 5, issue: "...", recommendation: "..." }
// We add: start_time, end_time, what_they_said, start_seconds, end_seconds
```

---

## ⚡ Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Granularity** | Utterance-level (60-90s chunks) | Natural boundaries, stable timestamps |
| **LLM Task** | Cite chunk_id | Prevents timestamp hallucination |
| **Playable Moments** | 5-6 per speech | Focused, not overwhelming |
| **Quote Source** | Auto-extracted from chunks | No LLM hallucination |
| **Feedback Tiers** | 2 (Strategic + Moments) | Different cognitive purposes |
| **Moment Categories** | 5 types | Clear taxonomy: gap/unclear/weak/transition/excellent |

---

## 🚀 Next Steps

### To Complete V2:

1. **✅ DONE: Core Generation**
   - Chunking service
   - V2 prompt template
   - Feedback generation service
   - Test with sample transcript

2. **⏳ TODO: Python SDK with Thinking**
   - Use `google-genai` library (not REST API)
   - Enable `thinking_config` with budget 32768
   - Improves feedback quality significantly

3. **⏳ TODO: Test with Gabby's Real Speech**
   - Use pharmaceutical debate motion
   - Full 8-minute speech with proper arguments
   - Validate chunk citations and timestamp accuracy

4. **⏳ TODO: Create `/feedbacktest2` Endpoint**
   - Display V2 feedback in browser
   - Embedded HTML5 audio player
   - Clickable timestamp badges
   - Jump to audio on click

5. **⏳ TODO: Compare V1 vs V2**
   - Side-by-side comparison page
   - Evaluate usefulness for students
   - Iterate based on feedback

---

## 📊 Test Results (Current)

**Test Speech:** Practice recording (57 seconds, "This house would cry" motion)

**Generated:**
- ✅ 5 playable moments with timestamps
- ✅ Rubric scores with justifications
- ✅ Strategic overview (3 sections)
- ✅ Chunk-based citations (no hallucination)
- ✅ Prescriptive recommendations

**Quality:**
- Categories correctly assigned (weak, gap, transition)
- Timestamps accurate to chunk boundaries
- Recommendations specific and actionable
- Position-aware (NA for Rebuttal/Teamwork for first speaker)

---

## 💡 Architecture Highlights

### Solves the "Hallucination Problem"
**OLD (risky):** LLM generates timestamps → might cite "02:45" when that moment doesn't exist
**NEW (safe):** LLM cites CHUNK_ID → we look up real timestamp from chunk

### Two-Tier Feedback
**Strategic (Non-Playable):** General observations, missing arguments, overall assessment
**Playable Moments:** Specific audio clips where hearing the speech helps understanding

### Audible Issues Only
**✅ Good:** Gap in reasoning, unclear explanation, weak transition
**❌ Bad:** Missing arguments (can't play what doesn't exist), general strategy

---

## 🔗 Related Files

- V1 Rubric Scoring: `src/services/rubricScoring.ts`
- V1 Teacher Comments: `prompts/TEACHER_COMMENTS_GENERATION.md`
- Secondary Rubrics: `SECONDARY_RUBRICS_GUIDE.md`
- Feedback Analysis: `FEEDBACK_ANALYSIS_FINDINGS.md`

---

## 📝 Example Playable Moment

```json
{
  "chunk_id": 5,
  "start_seconds": 145,
  "end_seconds": 180,
  "start_time": "02:25",
  "end_time": "03:00",
  "category": "gap",
  "severity": "critical",
  "what_they_said": "Governments are held accountable by voters. There's a huge backlash if people die or are forced to pay exorbitant amounts for life-saving treatment.",
  "issue": "You assert that governments are held accountable by voters and care about perception, but you don't explain WHY this accountability leads to better outcomes for drug access.",
  "recommendation": "Establish that a government's primary incentive is re-election, which is directly tied to public well-being and approval. Point out that media stories of citizens dying because they can't afford medicine are politically toxic and can cost an incumbent party an election. Therefore, a nationalized company is structurally forced to prioritize access and affordability to maintain political stability - a pressure that a private CEO, accountable only to shareholders, does not face."
}
```

Student experience:
1. Reads feedback
2. Clicks [▶ 02:25]
3. Audio jumps to that moment
4. Hears themselves say the quote
5. Understands the gap
6. Reads how to fix it

---

**Status:** Prototype complete, ready for UI integration and real-speech testing
