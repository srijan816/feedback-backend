# Teacher Comments Prompt - Implementation Guide

## Overview

We've created a **single universal prompt** (`TEACHER_COMMENTS_GENERATION.md`) that adapts to all speaker positions. This prompt generates 600-800 word teacher comments following the structure found in 76 actual feedback documents.

---

## Structure (6 Sections)

| Section | Purpose | Word Count | % of Total |
|---------|---------|------------|------------|
| **A. Opening Note** | Speech context | 10-20 | 2% |
| **B. Hook & Signposting** | Opening evaluation | 50-80 | 10% |
| **C. Position-Specific Strategic** | Setup/Extension/Weighing | 80-120 | 15% |
| **D. Argument Analysis** | Main content evaluation | 300-400 | **50%** |
| **E. Rebuttal & Clash** | Engagement quality | 80-120 | 15% |
| **F. Argument Recommendations** | Missing arguments | 40-60 | 7% |
| **G. Closing** | POI + Time | 20-30 | 3% |

**Total:** ~650 words

---

## How to Use

### **Required Variables:**

```typescript
{
  MOTION: string,
  MOTION_TYPE: 'policy' | 'principle' | 'comparison',
  POSITION: 'Prop 1' | 'Prop 2' | 'Prop 3' | 'Opp 1' | 'Opp 2' | 'Opp 3' | 'Reply',
  EXPECTED_DURATION: number, // in minutes
  ACTUAL_TIME: string, // format "MM:SS"
  TRANSCRIPT: string,
  PRIOR_SPEECHES_CONTEXT: string // For 2nd/3rd speakers
}
```

### **Motion Type Determination:**

```typescript
function getMotionType(motion: string): 'policy' | 'principle' | 'comparison' {
  if (motion.toLowerCase().includes('this house would')) {
    return 'policy'; // Requires model/mechanism
  } else if (motion.toLowerCase().includes('this house believes that')) {
    return 'principle'; // Requires principled framework
  } else if (motion.toLowerCase().includes('this house prefers')) {
    return 'comparison';
  }
  return 'principle'; // default
}
```

### **Prior Speeches Context (for 2nd/3rd speakers):**

```typescript
function formatPriorSpeeches(priorSpeeches: Speech[]): string {
  return priorSpeeches.map(speech =>
    `${speech.speaker_position} argued: ${summarizeArguments(speech.transcript)}`
  ).join('\n');
}
```

---

## Implementation Example

```typescript
import { readFileSync } from 'fs';
import path from 'path';

const PROMPT_TEMPLATE = readFileSync(
  path.join(__dirname, 'TEACHER_COMMENTS_GENERATION.md'),
  'utf-8'
);

async function generateTeacherComments(data: {
  motion: string;
  position: string;
  expectedDuration: number;
  actualTime: string;
  transcript: string;
  priorSpeeches?: Speech[];
}): Promise<string> {

  // Determine motion type
  const motionType = getMotionType(data.motion);

  // Format prior speeches context (if 2nd/3rd speaker)
  const priorContext = data.priorSpeeches
    ? formatPriorSpeeches(data.priorSpeeches)
    : 'This is the first speech of the debate.';

  // Fill prompt template
  const prompt = PROMPT_TEMPLATE
    .replace('{{MOTION}}', data.motion)
    .replace('{{MOTION_TYPE}}', motionType)
    .replace('{{POSITION}}', data.position)
    .replace('{{EXPECTED_DURATION}}', data.expectedDuration.toString())
    .replace('{{ACTUAL_TIME}}', data.actualTime)
    .replace('{{TRANSCRIPT}}', data.transcript)
    .replace('{{PRIOR_SPEECHES_CONTEXT}}', priorContext);

  // Call LLM
  const response = await callLLM(prompt, {
    temperature: 0.7,
    maxTokens: 2000
  });

  return response.text;
}
```

---

## Position-Specific Behavior

The prompt automatically adapts based on `{{POSITION}}`:

### **First Speakers (Prop 1, Opp 1):**
- Heavy focus on **argument development** (first arg super strong, second arg well-developed)
- **Setup/Model evaluation** (for policy debates only)
- NO rebuttal evaluation (N/A)
- NO teamwork evaluation (N/A)

### **Second Speakers (Prop 2, Opp 2):**
- Evaluates **THREE roles:**
  1. Rebuttal (engage with opponent's first speaker)
  2. Rebuild (extend own first speaker)
  3. Advance (one new argument)
- Heavy focus on **extension quality**
- Must reference first speaker explicitly

### **Third Speakers (Prop 3, Opp 3):**
- Heavy focus on **weighing and crystallization**
- Strategic resolution of clashes
- Less new content, more comparison
- Must tie team narrative together

### **Reply Speakers:**
- Focus on **comparative weighing**
- Crystallize 2-3 key clashes
- Critique if new arguments appear (inappropriate)

---

## Key Features

### **1. Separate Points, Not Paragraphs**

The prompt generates feedback as **distinct points**, not clustered paragraphs:

✅ Good:
```
Good clarity that it's not about the 1%.
However, we need to engage with the structural barriers.
The better strategic angle is to challenge feasibility.
```

❌ Bad:
```
You made good points about financial mobility but need to
engage more with structural barriers and consider alternative
strategic angles.
```

### **2. Prescriptive Expansion**

Never says "add more evidence" - provides **FULL 2-4 sentence arguments**:

✅ Good:
```
Establish that children from low socioeconomic backgrounds face
real structural barriers that require extraordinary effort to overcome.
If parents only teach that happiness matters, children might give up
when faced with difficult challenges. This messaging could make
children feel like failures when they can't be happy.
```

### **3. Position-Adaptive Sections**

**Section C (Strategic Feedback)** changes based on position:
- **First speakers:** "On the counter set-up:"
- **Second speakers:** Extension/teamwork evaluation
- **Third speakers:** Weighing/crystallization evaluation

### **4. Context-Dependent Elements**

Not everything appears in every feedback:
- Setup/Model: Only first speakers + policy debates
- Extension: Only 2nd/3rd speakers
- Rebuttal: Not for first speakers (unless strategic framing)
- Weighing emphasis: Third speakers and reply

---

## Quality Checks

Before sending to LLM, verify:

1. ✅ All variables filled (no `{{PLACEHOLDER}}` remaining)
2. ✅ Motion type correctly identified
3. ✅ Position matches actual speaker role
4. ✅ Prior speeches context provided (for 2nd/3rd speakers)
4. ✅ Actual time formatted correctly (MM:SS)

After LLM generation, verify:

1. ✅ Length: 600-800 words
2. ✅ Structure: 6 sections present (where applicable)
3. ✅ Opening note included
4. ✅ Speaking time feedback included
5. ✅ Separate points (not clustered paragraphs)
6. ✅ Prescriptive expansions with full argument text
7. ✅ No invented facts not in transcript

---

## LLM Configuration

**Recommended settings:**

| Setting | Value | Reason |
|---------|-------|--------|
| **Model** | Gemini 2.0 Flash / Claude 3.5 Sonnet | Balance quality and speed |
| **Temperature** | 0.7 | Balance consistency and variety |
| **Max Tokens** | 2000 | ~600-800 words |
| **Top P** | 0.95 | Default |

---

## Example Usage

```typescript
// Example 1: First speaker (Prop 1)
const feedback1 = await generateTeacherComments({
  motion: 'This House Would give prisoners the right to vote',
  position: 'Prop 1',
  expectedDuration: 5,
  actualTime: '05:15',
  transcript: '[full transcript here]',
  priorSpeeches: [] // First speaker
});

// Example 2: Second speaker (Opp 2)
const feedback2 = await generateTeacherComments({
  motion: 'This House Believes That tiger parenting does more harm than good',
  position: 'Opp 2',
  expectedDuration: 5,
  actualTime: '04:42',
  transcript: '[full transcript here]',
  priorSpeeches: [prop1Speech, opp1Speech, prop2Speech]
});

// Example 3: Reply speaker
const feedback3 = await generateTeacherComments({
  motion: 'This House Would hold schools liable for severe bullying',
  position: 'Reply',
  expectedDuration: 4,
  actualTime: '04:10',
  transcript: '[full transcript here]',
  priorSpeeches: allPriorSpeeches // All 6 constructive speeches
});
```

---

## Testing Checklist

To validate the prompt works correctly:

1. **Test all 7 positions:**
   - [ ] Prop 1 (policy debate)
   - [ ] Prop 1 (principle debate)
   - [ ] Prop 2
   - [ ] Prop 3
   - [ ] Opp 1
   - [ ] Opp 2
   - [ ] Opp 3
   - [ ] Reply

2. **Test edge cases:**
   - [ ] Very short speech (<3 min)
   - [ ] Very long speech (>7 min)
   - [ ] First debate (no prior feedback)
   - [ ] Weak hook
   - [ ] No signposting
   - [ ] Missing arguments

3. **Verify output quality:**
   - [ ] 600-800 words
   - [ ] 6 sections present (where applicable)
   - [ ] Separate points (not paragraphs)
   - [ ] Prescriptive expansions included
   - [ ] Position-appropriate feedback

---

## Next Steps

1. **Run Migration:** Set up 8 secondary rubrics in database
2. **Create Rubric Scoring Prompt:** Separate prompt for scoring (we'll design this next)
3. **Test with Real Transcripts:** Generate feedback for 5-10 sample speeches
4. **Compare with Actual Feedback:** Validate quality against teacher feedback
5. **Iterate:** Refine prompt based on output quality

---

## Files

- **Main Prompt:** `prompts/TEACHER_COMMENTS_GENERATION.md`
- **This Guide:** `prompts/IMPLEMENTATION_GUIDE.md`
- **Rubric Definitions:** `src/types/rubrics.ts`
- **Database Migration:** `database/migrations/001_secondary_rubrics.sql`

---

**Status:** ✅ Ready to implement and test
