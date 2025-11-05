# Feedback System Implementation Guide
## Complete Secondary Debate Feedback System

> **Status:** Ready for Implementation
>
> **Based on:** Analysis of 76 actual feedback documents from experienced debate coaches
>
> **System Type:** LLM-powered automated feedback generation

---

## 🎯 **System Overview**

This feedback system generates **pedagogically sound, detailed teacher comments** for secondary-level debate speeches, matching the quality and style of experienced debate coaches.

### **What It Does:**
1. Takes a speech transcript as input
2. Evaluates performance on **8 standardized rubrics**
3. Generates **600-800 word teacher comments** following expert patterns
4. Outputs structured feedback matching actual teacher feedback

### **What Makes It Unique:**
- Based on empirical analysis of 76 real feedback documents
- Uses actual teacher language patterns and phrasing
- Provides prescriptive, actionable guidance (not generic praise)
- Context-aware (considers motion, speech type, prior speeches)

---

## 📁 **Complete File Structure**

### **1. Database & Schema**

#### `database/migrations/001_secondary_rubrics.sql`
- **Purpose:** Migration to add 8 secondary rubrics to database
- **What it does:**
  - Deactivates old 5-rubric system
  - Inserts 8 new rubrics with complete scoring criteria
  - Creates convenience view for active rubrics
- **Status:** Ready to run

#### `src/types/rubrics.ts`
- **Purpose:** Type-safe rubric definitions for TypeScript
- **Exports:**
  - `SECONDARY_RUBRIC_NAMES` - Constant object with all 8 rubric names
  - `SecondaryRubricName` - Type for rubric names
  - `RubricScore` - Type for scores (NA, 1-5)
  - `SecondaryScoringResult` - Complete scoring interface
  - Helper functions: `createDefaultScoring()`, `calculateAverageScore()`, `shouldRubricBeNA()`

### **2. Documentation & Guides**

#### `SECONDARY_RUBRICS_GUIDE.md` (~6,000 words)
- **Purpose:** Complete scoring reference for all 8 rubrics
- **Contents:**
  - Detailed breakdown of each rubric
  - Scoring criteria for each level (1-5)
  - Position-specific guidelines (when to use N/A)
  - Common scoring scenarios
  - Example feedback phrases

#### `FEEDBACK_ANALYSIS_FINDINGS.md` (~8,000 words)
- **Purpose:** Deep analysis of feedback structure from 76 documents
- **Contents:**
  - Document structure (3 tables: student name, motion, rubric+comments)
  - 8 rubric criteria definitions
  - Rubric scoring scale (N/A, 1-5)
  - Teacher comment structure (A→H pattern)
  - Writing style analysis
  - Key debate concepts evaluated
  - Common feedback patterns

#### `TEACHER_COMMENTS_PROMPT_TEMPLATE.md` (~5,000 words)
- **Purpose:** Complete LLM prompt for generating teacher comments
- **Contents:**
  - Input context requirements
  - 8-section output structure (A→H)
  - Writing style requirements
  - Prescriptive expansion examples
  - Special considerations (reply speeches, time issues)
  - Complete example output
  - Final checklist

#### `POSITION_SPECIFIC_FEEDBACK_PATTERNS.md` (~4,000 words)
- **Purpose:** Position-based evaluation criteria (NOTE: Currently needs revision)
- **Status:** ⚠️ Based on incorrect assumption (1.1 = Unit 1 Debate 1, NOT speaker position)
- **Next Step:** Needs reanalysis once actual speaker positions are extracted

#### `SETUP_SECONDARY_RUBRICS.md`
- **Purpose:** Step-by-step migration and setup instructions
- **Contents:**
  - How to run the migration
  - Verification commands
  - Rollback instructions
  - Testing procedures

---

## ⚙️ **The 8 Secondary Rubrics**

| # | Rubric Name | Category | Scoring | Can be N/A? |
|---|-------------|----------|---------|-------------|
| 1 | **Time Management** | Structure | 1-5 | ❌ No |
| 2 | **POI Engagement** | Engagement | 1-5 | ✅ Yes (reply speeches) |
| 3 | **Delivery & Style** | Delivery | 1-5 | ❌ No |
| 4 | **Argument Completeness** | Content | 1-5 | ❌ No |
| 5 | **Theory Application** | Strategy | 1-5 | ❌ No |
| 6 | **Rebuttal Effectiveness** | Content | 1-5 | ✅ Yes (first speakers) |
| 7 | **Teamwork & Extension** | Strategy | 1-5 | ✅ Yes (first speakers) |
| 8 | **Feedback Implementation** | Development | 1-5 | ✅ Yes (first debate) |

**Scoring Scale:**
- **N/A** = Not applicable
- **1** = Unobserved
- **2** = Needs extended support
- **3** = Competent with guidance ⭐ **(This is "good")**
- **4** = Independent proficiency
- **5** = Exceptional mastery

---

## 📝 **Teacher Comments Structure (A→H)**

Every teacher comment follows this **8-section structure:**

### **A. Opening Note**
```
[NOTE: Today's speeches are 5 minutes' long due to time constraints.]
```

### **B. Hook & Signposting**
- Evaluate opening 30-60 seconds
- Remind about signposting

### **C. Counter Set-Up / Strategic Framing**
- Evaluate framework/model building
- Strategic framing suggestions

### **D. Argument-by-Argument Analysis**
For each argument:
1. Acknowledge strengths
2. Identify gaps
3. Provide mechanistic expansion (HOW/WHY)
4. Give prescriptive content (full argument text)
5. Connect to impacts

### **E. Rebuttal Evaluation**
- Which opponent arguments were engaged?
- Quality of clash
- Weighing analysis (for reply speeches)

### **F. Strategic Improvements**
- Co-opting, flipping, burden analysis
- Advanced tactical suggestions

### **G. Theory & Technique Application**
- Explicit debate theory instruction
- Concept teaching

### **H. Closing Observations**
```
Good job offering POIs in the round!
Speaking time: 05:15 - Good work!
```

---

## 💡 **Writing Style Requirements**

### **1. Direct & Imperative**
✅ "Establish that...", "Point out that...", "Show how..."
❌ "You could maybe consider..."

### **2. Question-Driven**
- "Can we weigh WHY this outweighs...?"
- "What is the mechanistic analysis?"

### **3. Prescriptive Expansion** ⭐ **MOST IMPORTANT**
Don't just say "add evidence" - provide the FULL argument text:

**Bad:**
> "Your argument needs more evidence."

**Good:**
> "Establish that tiger parenting creates debilitating perfectionism that prevents children from taking necessary risks for growth and achievement. Fear of failure becomes so intense that children avoid challenging situations where they might not excel immediately. This risk aversion limits career advancement, entrepreneurial ventures, and personal development throughout their lives."

### **4. Strategic Vocabulary**
- Clash, weighing, mechanism, characterisation, burden, framework, stakeholder, co-opt, flip/turn

### **5. Mechanistic Focus**
Always push for HOW and WHY, not just THAT

---

## 🚀 **Implementation Steps**

### **Phase 1: Database Setup** ✅ READY

1. **Run migration:**
   ```bash
   psql -h /var/run/postgresql -p 5433 -U ubuntu -d debate_feedback \
     -f database/migrations/001_secondary_rubrics.sql
   ```

2. **Verify:**
   ```bash
   psql -h /var/run/postgresql -p 5433 -U ubuntu -d debate_feedback \
     -c "SELECT name, display_order FROM active_secondary_rubrics;"
   ```

   **Expected output:** 8 rubrics in order

### **Phase 2: Feedback Service Update** 🔄 TODO

Update `src/services/feedback.ts`:

```typescript
import {
  SECONDARY_RUBRIC_NAMES,
  getAllRubricNames,
  createDefaultScoring,
  shouldRubricBeNA
} from '../types/rubrics';

export async function generateFeedback(data: FeedbackJobData) {
  // 1. Fetch transcript
  const transcript = await fetchTranscript(data.transcript_id);

  // 2. Fetch prior speeches for context
  const priorSpeeches = await fetchPriorSpeeches(data.debate_id, data.speech_id);

  // 3. Fetch student's previous feedback (if exists)
  const previousFeedback = await fetchPreviousFeedback(data.student_id);

  // 4. Build prompt using TEACHER_COMMENTS_PROMPT_TEMPLATE
  const prompt = buildTeacherCommentsPrompt({
    motion: data.motion,
    speechType: data.speech_type, // 'constructive' or 'reply'
    expectedDuration: data.expected_duration,
    actualTime: transcript.duration_seconds / 60,
    transcriptText: transcript.transcript_text,
    priorSpeeches: formatPriorSpeeches(priorSpeeches),
    previousFeedback: previousFeedback?.summary || 'N/A - First debate'
  });

  // 5. Call LLM
  const teacherComments = await callLLM(prompt);

  // 6. Generate scores (separate prompt or same prompt with structured output)
  const scores = await generateScores({
    transcript: transcript.transcript_text,
    motion: data.motion,
    speakerPosition: data.speaker_position,
    speechType: data.speech_type,
    duration: transcript.duration_seconds,
    expectedDuration: data.expected_duration
  });

  // 7. Store feedback
  return await storeFeedback({
    speech_id: data.speech_id,
    scores,
    qualitative_feedback: { teacher_comments: teacherComments },
    llm_provider: 'gemini_flash',
    llm_model: 'gemini-2.5-flash-latest'
  });
}
```

### **Phase 3: Prompt Integration** 🔄 TODO

1. **Create prompt builder:**
   ```typescript
   // src/services/promptBuilder.ts

   import { readFileSync } from 'fs';
   import path from 'path';

   const TEACHER_COMMENTS_TEMPLATE = readFileSync(
     path.join(__dirname, '../../TEACHER_COMMENTS_PROMPT_TEMPLATE.md'),
     'utf-8'
   );

   export function buildTeacherCommentsPrompt(data: {
     motion: string;
     speechType: 'constructive' | 'reply';
     expectedDuration: number;
     actualTime: number;
     transcriptText: string;
     priorSpeeches: string;
     previousFeedback: string;
   }): string {
     return TEACHER_COMMENTS_TEMPLATE
       .replace('{{MOTION}}', data.motion)
       .replace('{{SPEECH_TYPE}}', data.speechType)
       .replace('{{EXPECTED_DURATION}}', data.expectedDuration.toString())
       .replace('{{ACTUAL_TIME}}', formatTime(data.actualTime))
       .replace('{{TRANSCRIPT_TEXT}}', data.transcriptText)
       .replace('{{PRIOR_SPEECHES}}', data.priorSpeeches)
       .replace('{{PREVIOUS_FEEDBACK_SUMMARY}}', data.previousFeedback);
   }

   function formatTime(minutes: number): string {
     const mins = Math.floor(minutes);
     const secs = Math.round((minutes - mins) * 60);
     return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
   }
   ```

2. **Update LLM service:**
   ```typescript
   // src/services/llm.ts

   export async function generateTeacherComments(prompt: string): Promise<string> {
     const response = await callGeminiFlash(prompt, {
       temperature: 0.7, // Slightly creative for varied phrasing
       maxTokens: 2000   // ~600-800 words
     });

     return response.text;
   }
   ```

### **Phase 4: Score Generation** 🔄 TODO

Option 1: **Separate Scoring Prompt**
```typescript
const scoringPrompt = `
You are evaluating a secondary debate speech on the following 8 rubrics.
Score each on a scale of N/A, 1, 2, 3, 4, or 5.

RUBRICS:
1. Time Management: ${shouldRubricBeNA('Time Management', position) ? 'N/A' : '1-5'}
2. POI Engagement: ${shouldRubricBeNA('POI Engagement', position) ? 'N/A or 1-5' : '1-5'}
...

TRANSCRIPT:
${transcript}

OUTPUT FORMAT (JSON):
{
  "Time Management": 4,
  "POI Engagement": 3,
  ...
}
`;
```

Option 2: **Combined Prompt with Structured Output**
Ask LLM to return JSON + text in single response

### **Phase 5: Testing** 🔄 TODO

1. **Test with sample transcripts:**
   - Select 5-10 speeches with existing feedback
   - Generate new feedback using LLM
   - Compare with original teacher feedback
   - Iterate on prompt if needed

2. **Test edge cases:**
   - Very short speeches (<3 minutes)
   - Very long speeches (>8 minutes)
   - Reply speeches (different structure)
   - First debate (no previous feedback)

3. **Test rubric scoring:**
   - Verify N/A logic works correctly
   - Check score ranges (1-5)
   - Ensure average calculation is correct

---

## 🎛️ **LLM Configuration**

### **Recommended Settings:**

| Setting | Value | Reason |
|---------|-------|--------|
| **Provider** | Gemini Flash | Fast, cost-effective, good quality |
| **Model** | `gemini-2.5-flash-latest` | Latest version |
| **Temperature** | 0.7 | Balance between consistency and variety |
| **Max Tokens** | 2000 | ~600-800 words |
| **Top P** | 0.95 | Default |

### **Alternative Providers:**

- **Claude 3.5 Sonnet:** Higher quality, more expensive
- **GPT-4:** Good quality, expensive
- **Gemini Pro:** Higher quality than Flash, moderate cost

---

## 📊 **Expected Output Quality**

### **Teacher Comments:**
- **Length:** 600-800 words (4,000-5,000 characters)
- **Structure:** A→H sections in order
- **Style:** Direct, prescriptive, question-driven
- **Content:** Specific to transcript, with full argument text examples
- **Tone:** Authoritative coaching voice

### **Rubric Scores:**
- **Format:** JSON object with 8 keys
- **Values:** 'NA' or numbers 1-5
- **Validation:** Correct N/A logic based on speaker position/speech type

---

## ⚠️ **Known Limitations & Future Work**

### **Current Limitations:**

1. **No Position-Specific Logic Yet**
   - System doesn't differentiate between Prop 1, Prop 2, Prop 3, etc.
   - Feedback is general, not role-specific
   - **Fix:** Need to extract actual speaker positions from debate data

2. **No Prior Speech Context**
   - Can't evaluate "teamwork" without prior teammate speeches
   - Can't evaluate "rebuttal" without opponent arguments
   - **Fix:** Implement prior speech fetching and formatting

3. **No Feedback History**
   - Can't evaluate "Feedback Implementation" rubric
   - **Fix:** Implement student feedback history tracking

4. **Prompt Not Battle-Tested**
   - Template is based on analysis but not yet tested with real transcripts
   - May need iteration based on LLM output quality
   - **Fix:** Test with 10-20 sample speeches and refine

### **Future Enhancements:**

1. **Position-Aware Feedback**
   - Extract speaker position from debate data
   - Apply position-specific evaluation criteria
   - Adjust rubric weights by position

2. **Multi-Modal Input**
   - Consider audio features (pace, tone, volume) from transcription
   - Use filler word count from transcript_words table
   - Incorporate timing data

3. **Personalization**
   - Track student improvement over time
   - Adjust feedback tone based on student level
   - Reference specific past debates

4. **Comparative Analysis**
   - Compare student to class average
   - Highlight relative strengths/weaknesses

---

## 🔑 **Key Success Factors**

### **1. Prompt Quality**
The teacher comments prompt is the most critical component. It must:
- Follow the A→H structure religiously
- Use prescriptive expansion (full argument text)
- Maintain debate-specific vocabulary
- Ask guiding questions

### **2. Context Richness**
Feedback quality depends on input context:
- Accurate transcript
- Motion and debate format
- Prior speeches (for teamwork/rebuttal evaluation)
- Student feedback history
- Actual vs expected speaking time

### **3. Rubric Consistency**
Scoring must be:
- Consistent across speeches
- Aligned with scoring definitions (3 = competent, not barely passing)
- Correctly using N/A when appropriate

### **4. Iteration**
Expect to refine the prompt through testing:
- Compare LLM output with actual teacher feedback
- Identify patterns that need adjustment
- Test with diverse speech types and quality levels

---

## 📚 **Reference Documents**

| Document | Purpose | Location |
|----------|---------|----------|
| **Rubric Scoring Guide** | How to score each rubric | `SECONDARY_RUBRICS_GUIDE.md` |
| **Feedback Analysis** | Deep dive into feedback structure | `FEEDBACK_ANALYSIS_FINDINGS.md` |
| **Teacher Comments Prompt** | Complete LLM prompt template | `TEACHER_COMMENTS_PROMPT_TEMPLATE.md` |
| **Setup Instructions** | How to run migration | `SETUP_SECONDARY_RUBRICS.md` |
| **Position Patterns** | Position-specific evaluation (needs revision) | `POSITION_SPECIFIC_FEEDBACK_PATTERNS.md` |

---

## ✅ **Checklist: Ready for Implementation**

### **Documentation** ✅
- [x] 8 rubrics defined with complete scoring criteria
- [x] Teacher comment structure analyzed (A→H pattern)
- [x] Writing style documented
- [x] LLM prompt template created
- [x] Setup guide written

### **Code** ✅
- [x] Database migration script ready
- [x] TypeScript types defined
- [x] Helper functions implemented

### **Next Steps** 🔄
- [ ] Run database migration
- [ ] Update feedback service to use new rubrics
- [ ] Implement prompt builder
- [ ] Test with sample transcripts
- [ ] Iterate on prompt quality
- [ ] Deploy to production

---

## 🎯 **Success Criteria**

The system is successful when:

1. **Feedback is indistinguishable** from experienced teacher feedback
2. **Students find it useful** and actionable
3. **Rubric scores are consistent** and fair
4. **Comments are specific** to the transcript (not generic)
5. **System scales** to handle 100+ speeches/week

---

## 🚀 **Next Immediate Action**

**Run the migration:**
```bash
cd /home/ubuntu/apps/feedback-backend

psql -h /var/run/postgresql -p 5433 -U ubuntu -d debate_feedback \
  -f database/migrations/001_secondary_rubrics.sql
```

Then verify:
```bash
psql -h /var/run/postgresql -p 5433 -U ubuntu -d debate_feedback \
  -c "SELECT * FROM active_secondary_rubrics;"
```

**Then:** Begin Phase 2 - Update feedback service

---

## 📞 **Questions?**

Refer to:
- **Technical questions:** Check `src/types/rubrics.ts` for type definitions
- **Scoring questions:** Read `SECONDARY_RUBRICS_GUIDE.md`
- **Prompt questions:** Study `TEACHER_COMMENTS_PROMPT_TEMPLATE.md`
- **Analysis questions:** Review `FEEDBACK_ANALYSIS_FINDINGS.md`

---

**System Status:** ✅ **Ready for Implementation**

All documentation, database migrations, types, and prompt templates are complete and ready to integrate into the feedback service.
