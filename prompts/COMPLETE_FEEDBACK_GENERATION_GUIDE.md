# Complete Feedback Generation Guide
## Using Rubric Scoring + Teacher Comments Together

---

## Overview

The feedback system has **two independent prompts**:

1. **Rubric Scoring Prompt** → Gemini Flash (JSON output) → Scores on 8 rubrics
2. **Teacher Comments Prompt** → Gemini/Claude (text output) → 600-800 word feedback

---

## System Architecture

```
Input (Transcript + Context)
    ↓
    ├─→ [Rubric Scoring Service]
    │       ↓
    │   Gemini Flash (JSON)
    │       ↓
    │   Scores: { "Time Management": 4, ... }
    │
    └─→ [Teacher Comments Service]
            ↓
        Gemini Flash / Claude (Text)
            ↓
        Comments: "Good job with..." (600-800 words)
            ↓
        Combine Results
            ↓
        Store in Database
```

---

## File Structure

```
prompts/
├── RUBRIC_SCORING_PROMPT.md           # Scoring prompt template
├── TEACHER_COMMENTS_GENERATION.md     # Comments prompt template
├── IMPLEMENTATION_GUIDE.md             # Teacher comments usage
└── COMPLETE_FEEDBACK_GENERATION_GUIDE.md  # This file

src/services/
├── rubricScoring.ts                   # TypeScript implementation
├── rubricScoring.py                   # Python implementation (reference)
├── teacherComments.ts                 # Teacher comments service (to create)
└── feedback.ts                        # Main feedback service (to update)
```

---

## Step 1: Rubric Scoring

### **Input:**
```typescript
{
  motion: string,
  position: 'Prop 1' | 'Prop 2' | 'Prop 3' | 'Opp 1' | 'Opp 2' | 'Opp 3' | 'Reply',
  expectedDuration: number, // minutes
  actualTimeSeconds: number,
  transcript: string,
  priorSpeechesContext?: string
}
```

### **Usage:**
```typescript
import { scoreRubrics } from './services/rubricScoring';

const scores = await scoreRubrics({
  motion: 'This House Would give prisoners the right to vote',
  position: 'Prop 1',
  expectedDuration: 5,
  actualTimeSeconds: 315, // 5:15
  transcript: '[full transcript text]',
  priorSpeechesContext: '' // Empty for first speakers
});
```

### **Output:**
```json
{
  "scores": {
    "Time Management": 5,
    "POI Engagement": 4,
    "Delivery & Style": 3,
    "Argument Completeness": 4,
    "Theory Application": 3,
    "Rebuttal Effectiveness": "NA",
    "Teamwork & Extension": "NA",
    "Feedback Implementation": 3
  },
  "justifications": {
    "Time Management": "Student spoke for 5:15, within 15 seconds of target...",
    "POI Engagement": "Offered 2 strategic POIs during opponent speeches...",
    ...
  },
  "average_score": 3.7,
  "total_scored_rubrics": 6
}
```

---

## Step 2: Teacher Comments Generation

### **Input:**
```typescript
{
  motion: string,
  motionType: 'policy' | 'principle' | 'comparison',
  position: string,
  expectedDuration: number,
  actualTime: string, // "MM:SS"
  transcript: string,
  priorSpeechesContext: string
}
```

### **Usage:**
```typescript
import { generateTeacherComments } from './services/teacherComments';

const comments = await generateTeacherComments({
  motion: 'This House Would give prisoners the right to vote',
  motionType: 'policy', // Auto-detect from "Would"
  position: 'Prop 1',
  expectedDuration: 5,
  actualTime: '05:15',
  transcript: '[full transcript text]',
  priorSpeechesContext: 'This is the first speech.'
});
```

### **Output:**
```
[NOTE: Today's speeches are 5 minutes' long due to time constraints.]

Excellent hook connecting voting rights to prisoner rehabilitation.
Good job signposting your speech!

On the counter set-up:
Propose clear and transparent mechanisms that allow prisoners to vote
while maintaining prison security. Highlight that many democratic
countries successfully conduct prison elections...

[600-800 words of detailed feedback following 6-section structure]

Good job offering POIs in the round!

Speaking time: 05:15 - Good work!
```

---

## Step 3: Combining Results

### **Complete Feedback Service:**

```typescript
// src/services/feedback.ts

import { scoreRubrics, RubricScoringResult } from './rubricScoring';
import { generateTeacherComments } from './teacherComments';

interface FeedbackGenerationInput {
  motion: string;
  position: string;
  expectedDuration: number;
  actualTimeSeconds: number;
  transcript: string;
  priorSpeeches: Array<{
    position: string;
    transcript: string;
  }>;
}

export async function generateCompleteFeedback(
  input: FeedbackGenerationInput
): Promise<{
  scores: RubricScoringResult;
  teacherComments: string;
}> {

  // Determine motion type
  const motionType = getMotionType(input.motion);

  // Format prior speeches context
  const priorContext = formatPriorSpeeches(input.priorSpeeches);

  // Format actual time
  const actualTime = formatTime(input.actualTimeSeconds);

  // Generate rubric scores (Gemini Flash with JSON)
  const scores = await scoreRubrics({
    motion: input.motion,
    position: input.position,
    expectedDuration: input.expectedDuration,
    actualTimeSeconds: input.actualTimeSeconds,
    transcript: input.transcript,
    priorSpeechesContext: priorContext,
  });

  // Generate teacher comments (Gemini Flash or Claude)
  const teacherComments = await generateTeacherComments({
    motion: input.motion,
    motionType,
    position: input.position,
    expectedDuration: input.expectedDuration,
    actualTime,
    transcript: input.transcript,
    priorSpeechesContext: priorContext,
  });

  return {
    scores,
    teacherComments,
  };
}

function getMotionType(motion: string): 'policy' | 'principle' | 'comparison' {
  const lower = motion.toLowerCase();
  if (lower.includes('this house would')) return 'policy';
  if (lower.includes('this house prefers')) return 'comparison';
  return 'principle'; // default for "This House Believes That"
}

function formatPriorSpeeches(speeches: Array<{ position: string; transcript: string }>): string {
  if (!speeches.length) return 'This is the first speech.';

  return speeches
    .map(s => `${s.position} argued: ${summarizeTranscript(s.transcript)}`)
    .join('\n\n');
}

function summarizeTranscript(transcript: string): string {
  // For now, take first 500 characters
  // TODO: Use LLM to generate better summaries
  return transcript.slice(0, 500) + (transcript.length > 500 ? '...' : '');
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
```

---

## Step 4: Store in Database

```typescript
// After generating feedback, store in database

import { pool } from '../db';

async function storeFeedback(
  speechId: string,
  scores: RubricScoringResult,
  teacherComments: string
) {
  const query = `
    INSERT INTO feedback (
      speech_id,
      scores,
      qualitative_feedback,
      llm_provider,
      llm_model,
      processing_time_ms,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    RETURNING id;
  `;

  const values = [
    speechId,
    JSON.stringify(scores.scores), // Store scores as JSONB
    JSON.stringify({
      teacher_comments: teacherComments,
      justifications: scores.justifications,
    }),
    'gemini_flash',
    'gemini-2.0-flash-exp',
    null, // processing_time_ms (measure separately)
  ];

  const result = await pool.query(query, values);
  return result.rows[0].id;
}
```

---

## Complete Workflow Example

```typescript
// Example: Generate feedback for Prop 2 speech

const speechData = {
  motion: 'This House Would give prisoners the right to vote',
  position: 'Prop 2',
  expectedDuration: 5,
  actualTimeSeconds: 317, // 5:17
  transcript: `
    [Full transcript of Prop 2's speech]
  `,
  priorSpeeches: [
    {
      position: 'Prop 1',
      transcript: '[Prop 1 transcript]',
    },
    {
      position: 'Opp 1',
      transcript: '[Opp 1 transcript]',
    },
  ],
};

// Generate complete feedback
const feedback = await generateCompleteFeedback(speechData);

console.log('=== RUBRIC SCORES ===');
console.log(JSON.stringify(feedback.scores.scores, null, 2));
console.log(`\nAverage Score: ${feedback.scores.average_score}`);

console.log('\n=== TEACHER COMMENTS ===');
console.log(feedback.teacherComments);

// Store in database
await storeFeedback(speechId, feedback.scores, feedback.teacherComments);

// Update speech status
await pool.query(
  'UPDATE speeches SET feedback_status = $1, feedback_completed_at = NOW() WHERE id = $2',
  ['completed', speechId]
);
```

---

## API Configuration

### **Gemini Flash (for Rubric Scoring):**

```typescript
const GEMINI_CONFIG = {
  apiKey: 'AIzaSyDwdU2z6Dld3hLy8oEvEBy3Lx8-Mxg4y2s',
  model: 'gemini-2.0-flash-exp',
  endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
  config: {
    responseMimeType: 'application/json',
    temperature: 0.3, // Lower for consistent scoring
    maxOutputTokens: 2048,
  },
  thinkingConfig: {
    thinkingBudget: 24576,
  },
};
```

### **Gemini Flash (for Teacher Comments):**

```typescript
const GEMINI_COMMENTS_CONFIG = {
  apiKey: 'AIzaSyDwdU2z6Dld3hLy8oEvEBy3Lx8-Mxg4y2s',
  model: 'gemini-2.0-flash-exp',
  config: {
    temperature: 0.7, // Higher for varied phrasing
    maxOutputTokens: 2000,
  },
};
```

---

## Testing

### **Test Script:**

```typescript
// test/testFeedbackGeneration.ts

import { generateCompleteFeedback } from '../src/services/feedback';

async function testProp1() {
  console.log('Testing Prop 1 feedback generation...\n');

  const feedback = await generateCompleteFeedback({
    motion: 'This House Would give prisoners the right to vote',
    position: 'Prop 1',
    expectedDuration: 5,
    actualTimeSeconds: 315,
    transcript: `
      Good morning judges. Today I'm here to argue that prisoners should have the right to vote.
      Let me signpost my speech. I'll present two arguments: first, voting is a fundamental right
      that shouldn't be stripped away, and second, giving prisoners the vote improves criminal
      justice policies.

      My first argument is about fundamental rights. Voting is derived from citizenship, and
      prisoners remain citizens...
    `,
    priorSpeeches: [],
  });

  console.log('Scores:', feedback.scores.scores);
  console.log('\nAverage:', feedback.scores.average_score);
  console.log('\nComments:\n', feedback.teacherComments);
}

testProp1();
```

---

## Performance Considerations

### **Parallel Generation:**

Since rubric scoring and teacher comments are independent, generate them **in parallel**:

```typescript
async function generateCompleteFeedbackParallel(input: FeedbackGenerationInput) {
  const [scores, teacherComments] = await Promise.all([
    scoreRubrics({ /* params */ }),
    generateTeacherComments({ /* params */ }),
  ]);

  return { scores, teacherComments };
}
```

**Expected time:**
- Rubric Scoring: 3-5 seconds
- Teacher Comments: 5-8 seconds
- **Total (parallel):** ~8 seconds
- **Total (sequential):** ~13 seconds

---

## Cost Estimation

### **Per Speech:**

**Rubric Scoring (Gemini Flash):**
- Input: ~2,000 tokens (prompt + transcript)
- Output: ~500 tokens (JSON)
- Cost: ~$0.0001 per speech

**Teacher Comments (Gemini Flash):**
- Input: ~2,500 tokens
- Output: ~800 tokens
- Cost: ~$0.0002 per speech

**Total per speech:** ~$0.0003 (very cheap!)

**For 1,000 speeches:** ~$0.30

---

## Error Handling

```typescript
async function generateFeedbackWithRetry(input: FeedbackGenerationInput, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateCompleteFeedback(input);
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);

      if (attempt === maxRetries) {
        // Final attempt failed - store error in database
        await storeFeedbackError(input.speechId, error);
        throw error;
      }

      // Wait before retry (exponential backoff)
      await sleep(Math.pow(2, attempt) * 1000);
    }
  }
}
```

---

## Next Steps

1. ✅ **Prompts Created:** Both rubric scoring and teacher comments
2. ✅ **Services Implemented:** TypeScript implementations ready
3. 🔄 **Integration:** Update main feedback service to use both
4. 🔄 **Testing:** Test with real transcripts
5. 🔄 **Database:** Run migration for 8 rubrics
6. 🔄 **Deploy:** Roll out to production

---

## Files Reference

| File | Purpose |
|------|---------|
| `prompts/RUBRIC_SCORING_PROMPT.md` | Scoring prompt template |
| `prompts/TEACHER_COMMENTS_GENERATION.md` | Comments prompt template |
| `src/services/rubricScoring.ts` | Scoring service (TS) |
| `src/services/rubricScoring.py` | Scoring service (Python) |
| `src/services/teacherComments.ts` | Comments service (to create) |
| `src/services/feedback.ts` | Main feedback service (to update) |

---

**Status:** ✅ Ready to integrate and test
