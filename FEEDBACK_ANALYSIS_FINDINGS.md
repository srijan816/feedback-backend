# Deep Analysis of Mai Feedback Structure
## Analysis of 76 Secondary-Level Debate Feedback Documents

---

## Executive Summary

I analyzed 76 feedback documents from two debate classes (PSD-II Tuesday and PSD-III Wednesday) to understand the complete feedback structure for secondary students. This is the **most critical** foundation for building the automated feedback system.

---

## 1. DOCUMENT STRUCTURE

### File Organization
```
Mai/
├── G7-12-PSD-II- Tuesdays-6pm/           (8 students + makeup students)
│   └── [Student Name]/
│       ├── Unit 1/
│       │   ├── Feedback - 1.1 - [Name].docx
│       │   ├── Feedback - 1.2 - [Name].docx
│       │   ├── Feedback - 1.3 - [Name].docx
│       │   └── Feedback - 1.4 - [Name].docx
│       └── Unit 2/
│           ├── Feedback - 2.1 - [Name].docx
│           ├── Feedback - 2.2 - [Name].docx
│           └── ...
└── G7-12-PSD-III-Wednesdays-6pm/         (7 students + makeup students)
    └── [Student Name]/
        └── [Same structure]
```

**Key Observations:**
- 15 total students across 2 classes
- Feedback tracked chronologically by unit (1.1, 1.2, 1.3, 1.4, 2.1, 2.2, etc.)
- Each file represents feedback for ONE speech in a debate round

---

## 2. FEEDBACK DOCUMENT COMPONENTS

Each feedback document has **THREE tables**:

### Table 1: Student Identification
```
┌─────────────────────────────┐
│ Student Name: Alex Zhu      │
└─────────────────────────────┘
```

### Table 2: Motion
```
┌──────────────────────────────────────────────────────────────┐
│ Motion: This House Would implement blind voting in national  │
│ elections                                                     │
└──────────────────────────────────────────────────────────────┘
```

### Table 3: Rubric + Teacher Comments (Main Feedback Table)

**Structure:** 11 rows × 7 columns

| Row | Column 0 (Criteria) | Columns 1-6 (Scoring Options) |
|-----|---------------------|-------------------------------|
| 0-7 | Rubric criteria text | N/A, 1, 2, 3, 4, 5 |
| 8 | Competition Score: | 70.5 (repeated across) |
| 9 | Rubric legend (1-5 definitions) | (Repeated) |
| 10 | **Teacher comments:** [Full text] | (Repeated across all columns) |

---

## 3. THE 8 RUBRIC CRITERIA (SCORING N/A, 1-5)

These are **UNIVERSAL** across all 76 feedback documents analyzed:

### 1. **Time Management**
> "Student spoke for the duration of the specified time frame."

**What it evaluates:** Meeting speech time requirements (4-8 minutes depending on speech type)

---

### 2. **Point of Information (POI) Engagement**
> "Student offered and/or accepted a point of information relevant to the topic."

**What it evaluates:** Active participation in cross-examination during opponent speeches

---

### 3. **Delivery & Style**
> "Student spoke in a stylistic and persuasive manner (e.g. volume, speed, tone, diction, and flow)."

**What it evaluates:** Speaking mechanics - pace, clarity, confidence, vocal variety

---

### 4. **Argument Completeness**
> "Student's argument is complete in that it has relevant claims, supported by sufficient reasoning, examples, impacts, and implications."

**What it evaluates:**
- **Claims:** Clear thesis statements
- **Reasoning:** Logical chain connecting claim to impact
- **Examples:** Concrete illustrations/evidence
- **Impacts:** Why it matters
- **Implications:** Broader consequences

---

### 5. **Theory Application**
> "Student argument reflects application of theory taught during class time."

**What it evaluates:** Using taught debate techniques like:
- Counter set-ups
- Strategic framing
- Burden shifts
- Weighing mechanisms
- Stakeholder analysis
- Comparative analysis

---

### 6. **Rebuttal Effectiveness**
> "Student's rebuttal is effective, and directly responds to an opponent's arguments."

**What it evaluates:**
- **Direct engagement** with specific opponent claims
- **Clash** - substantive refutation, not talking past each other
- **Layered rebuttals** - multiple angles of attack
- **Defensive** rebuttals to protect own case

---

### 7. **Teamwork & Extension**
> "Student ably supported teammate's case and arguments."

**What it evaluates:**
- Extending/reinforcing earlier speakers' arguments
- Not contradicting team position
- Connecting individual speech to team strategy
- Building on established frameworks

---

### 8. **Feedback Implementation**
> "Student applied feedback from previous debate(s)."

**What it evaluates:** Whether student corrected issues flagged in previous feedback

---

## 4. RUBRIC SCORING SCALE (1-5 + N/A)

The rubric uses this **UNIVERSAL** scale for all 8 criteria:

```
N/A - Not Applicable (e.g., "rebuttal" for first speaker who has no one to rebut)

1 - Unobserved
    The skill was not demonstrated at all

2 - Student attempt noted. Needs extended teacher support to properly execute skill.
    Student tried but requires heavy scaffolding and direct instruction

3 - Student effort noted. Can execute skill with minimal teacher input and guidance.
    Competent execution with minor coaching needed

4 - Student can execute skill with little to no prompting.
    Independent, proficient execution

5 - Student can execute skill without prompting; exceeds expectations for
    child of that level.
    Exceptional mastery beyond grade-level expectations
```

---

## 5. TEACHER COMMENTS STRUCTURE

### Length & Format
- **Average length:** ~4,000 characters (about 600-800 words)
- **Range:** 1,240 - 6,167 characters
- **Format:** Prose paragraphs with clear section breaks

---

### Comment Structure Pattern

Teacher comments follow this **CONSISTENT** structure:

#### **A. Opening Notes**
```
[NOTE: Today's speeches are 5 minutes' long due to time constraints.]
[NOTE: This is a 4 minutes' reply speech.]
[NOTE: Today's speeches are 8 minutes' long.]
```

#### **B. Hook & Signposting Feedback**
- Evaluation of speech opening (hook quality, impact, timing)
- Reminder to signpost (outline structure)
- Examples:
  - "Excellent hook connecting the value of hard work to the main stakeholder"
  - "The hook is clear but lacking in impact!"
  - "I deeply appreciate the evocative illustration up top!"
  - "Rather than saying we've all been bullied before... dive straight into the description"

#### **C. Strategic Framing & Set-up**
Feedback on the MODEL/FRAMEWORK of the debate case:
- Counter set-ups
- Strategic burden shifts
- Characterization of stakeholders
- Defining key terms
- Examples:
  - "We should strategically frame bad parents out of this debate"
  - "Where is the set-up? We dived straight into argumentative premises"
  - "Well done clarifying what amounts to severe bullying!"

#### **D. Argument-by-Argument Analysis**
For each major argument/clash in the speech:

**Structure of each argument feedback block:**
1. **Acknowledgment** - What the student did well
2. **Gap Identification** - What's missing or weak
3. **Mechanistic Expansion** - HOW to improve with specific suggestions
4. **Impact Connection** - WHY this matters / what the implications are

**Example:**
```
"Good job with premise on false hope after their hopes are dashed.

Could we also immediately highlight what exactly are these structural
barriers that make socio-economic mobility so unfeasible? That will
drive the impact of the statement, then connect it back down to why
happiness is the only way to feasibly increase their quality of life.

E.g. Maslow's hierarchy of needs shows that people can't focus on
happiness and self-actualization when they're worried about food,
shelter, and safety. Teaching children that happiness is the priority
sets them up for frustration when real-world constraints make
happiness difficult to achieve."
```

#### **E. Rebuttal Evaluation**
- Which opponent arguments were engaged
- Which were ignored
- Quality of clash (direct vs. tangential)
- Suggested additional rebuttals
- Examples:
  - "We need to rebut Opp's argument on having more experience!"
  - "Well done implementing the structure of layered rebuttals"
  - "There's tunnel vision wherein we reinforce our own material, but we're not engaging with the other side"

#### **F. Strategic Improvements**
Advanced tactical suggestions:
- Co-opting opponent ground
- Flipping/turning arguments
- Comparative weighing
- Burden analysis
- Examples:
  - "Flip this claim entirely and say many sexual assaulters still get elected on Opp's side"
  - "We can wash out their concern because current electoral systems poorly evaluate leadership capacity"

#### **G. Theory & Technique Application**
Explicit instruction on debate theory:
- Clash
- Weighing
- Stakeholder identification
- Mechanistic reasoning
- Impact calculus

#### **H. Closing Observations**
- POI participation reminder
- **Speaking time** with judgment
- Generic encouragements

**Format:**
```
Good job offering POIs in the round!

Speaking time: 05:15 - Good work!
Speaking time: 06:24 - We need to at least reach 7 minutes!
Speaking time: 07:36 - Watch for time!
```

---

## 6. TEACHER COMMENT WRITING STYLE

### Tone Characteristics

**1. Direct & Instructive**
- Uses imperative mood: "Establish that...", "Point out that...", "Show how..."
- Not passive or suggestive ("you could maybe...")
- Confident, authoritative coaching voice

**2. Specific > Generic**
- Bad: "Your argument needs more evidence"
- Good: "Include the policy success rate of these politicians within the manifesto so voters will also learn of their capacity"

**3. Question-Driven Feedback**
- "Could we also immediately highlight what exactly are these structural barriers?"
- "Is there a reason why we're analysing all of this up top instead of in your argument?"
- "What is the mechanistic analysis to show that happiness can also lead to hard work?"

**4. Strategic Language**
Uses debate-specific terminology fluently:
- "Strategic framing"
- "Burden shift"
- "Weighing mechanism"
- "Comparative analysis"
- "Stakeholder identification"
- "Clash"
- "Framework"
- "Counterfactual"
- "Impact calculus"
- "Co-opt"
- "Flip/Turn"
- "Caveat"

**5. Prescriptive Expansion**
Provides full argument text the student SHOULD have said:
```
"Establish that blind voting eliminates personality politics, celebrity
culture, and superficial candidate characteristics that distract from
substantive policy evaluation. This shifts campaigning strategies away
from things like character assassination."
```

**6. Sandwich Method** (Not Really Used)
- Comments are NOT heavily praise-focused
- Critique is direct and improvement-focused
- Praise is specific when given, but not artificially balanced

---

## 7. KEY DEBATE CONCEPTS IN FEEDBACK

### Frequently Evaluated Concepts:

#### **Signposting**
Outlining speech structure explicitly
- "My first argument is...", "My second argument is..."
- "I will now move to rebuttal"

#### **Hook**
Opening 30-60 seconds that grabs attention
- Should be impactful, not cliché
- Avoid "Imagine if..."
- Connect to motion immediately

#### **Counter Set-Up**
Proactive model building BEFORE rebuttals
- Define what the debate is about
- Establish what the policy looks like
- Frame out opponent ground
- Example: "Propose that their voting rights are restored upon serving their sentence"

#### **Mechanistic Reasoning**
Explaining HOW/WHY things happen, not just THAT they happen
- "What is the mechanistic analysis?"
- "Explain WHY Opp must defend these characteristics"
- Cause-effect chains

#### **Clash**
Direct engagement with opponent's specific arguments
- Not "talking past" each other
- Addressing their EXACT claims
- "Good job pushing back on their model"
- "We need to engage with Prop explaining that..."

#### **Strategic Framing**
Controlling what the debate is about
- "Frame bad parents out of this debate"
- "Co-opt their goals"
- "Flip this claim entirely"

#### **Weighing**
Comparative impact analysis - even if opponent wins X, we win Y which matters more
- "Why these perverse incentives outweigh Prop's analysis"
- "Comparative weighing (why Prop wins)"

#### **Stakeholder Analysis**
Identifying WHO is affected and centering debate on them
- "Refocus the main stakeholders... immigrant families"
- "Dive straight into the perspective of your stakeholder"

#### **Layered Rebuttals**
Multiple angles of refutation on one argument
- "Well done implementing the structure of layered rebuttals"

#### **Burden Analysis**
Who needs to prove what in the debate
- "Strategic burden push as to why Prop has the higher burden"

---

## 8. SPEECH-SPECIFIC FEEDBACK PATTERNS

### First Speakers (Prop 1, Opp 1)
- Focus on: Framework, set-up, clear case construction
- N/A for: Rebuttal (no one to rebut yet)
- Emphasis: "Establish the core definition and framework"

### Second Speakers (Prop 2, Opp 2)
- Focus on: Rebuttal + new arguments
- Key skill: Balancing offense and defense
- Emphasis: "Refute + present new arguments + extend case"

### Third Speakers (Prop 3, Opp 3)
- Focus on: Summary, weighing, NO NEW ARGUMENTS
- Key skill: Crystallization and impact comparison
- Emphasis: "Summarize and crystallize case + comparative weighing"

### Reply Speeches
- Different time (usually 4 minutes)
- Focus on: Key clashes, weighing, deadlock breakers
- Common critique: "Information dump without clear comparisons"

---

## 9. COMMON PATTERNS IN TEACHER FEEDBACK

### What Teachers PRAISE:
- ✅ Clear signposting
- ✅ Effective counter set-ups
- ✅ Direct clash with opponent arguments
- ✅ Mechanistic reasoning (explaining HOW/WHY)
- ✅ Strategic framing
- ✅ Specific examples and evidence
- ✅ Offering POIs
- ✅ Application of taught theory
- ✅ Extending teammate arguments

### What Teachers CRITICIZE:
- ❌ No signposting
- ❌ Weak/cliché hooks
- ❌ Information dumps without clash
- ❌ Tunnel vision (only extending own side, not engaging opponents)
- ❌ Missing mechanistic analysis
- ❌ Time management issues
- ❌ Assertions without reasoning
- ❌ Not offering POIs
- ❌ Ignoring key opponent arguments
- ❌ Generic/vague arguments without specificity

---

## 10. SAMPLE COMPLETE TEACHER COMMENT (ANNOTATED)

```
[Opening Note]
[NOTE: Today's speeches are 5 minutes' long due to time constraints.]

[Hook Feedback]
Excellent start on explaining what the trade-off is for poorer families.
Good clarification on what it takes for these families to break out of
the cycle of poverty, but is there a reason why we're analysing all of
this up top instead of in your argument?
Don't forget to signpost your speech before diving in!

[Counter Set-up Feedback]
On the counter set-up:
Well done with the counterfactual, but don't be too limiting to obvious
goods like education and hard work.
Good caveat that we're not anti-happiness, but acknowledging that many
other things impact our quality of life/happiness.
We can turn the conclusion into a strategic burden push as to why Prop
has the higher burden in this debate and they cannot co-opt our
counterfactual.

[Argument Analysis - with expansion]
Well done challenging the idea that happiness is easily achievable for
families facing poverty by highlighting how basic needs must be met first.
But provide more analysis to prove this. E.g. Maslow's hierarchy of needs
shows that people can't focus on happiness and self-actualization when
they're worried about food, shelter, and safety. Teaching children that
happiness is the priority sets them up for frustration when real-world
constraints make happiness difficult to achieve.

[Gap Identification]
While it's good to push that hard work could overcome their circumstances,
there's not enough mechanistic analysis to explain how it is feasible.

[Strategic Suggestion]
I like the conclusion that on balance, it removes some of the motivating
forces for positive change and social mobility.
Expand more on how this mindset might prevent children from developing
grit and perseverance needed to overcome socioeconomic disadvantages.

[Prescriptive Content - giving them the exact argument]
E.g. Children from low socioeconomic backgrounds face real structural
barriers that require extraordinary effort to overcome. If parents only
teach that happiness matters, children might give up when faced with
difficult but necessary challenges like rigorous studying, taking on
multiple jobs, or enduring years of sacrifice to build better futures.

[More expansion]
Point out that telling children "happiness is all that matters" might
inadvertently minimize the real structural barriers they face and the
serious effort required to overcome them.
This messaging could make children feel like failures when they can't be
happy despite facing discrimination, limited opportunities, and financial
stress. It places the burden on individuals to be content rather than
acknowledging that some situations genuinely need to change.

[Specific Example Suggestion]
To help with characterisation, we need illustrations of how focusing
solely on happiness might lead to poor decision-making in education,
career choices, or financial planning. E.g. A child who prioritizes
immediate happiness might drop out of school because it's stressful,
choose an enjoyable but low-paying career without considering financial
security, or avoid difficult subjects that could open doors to better
opportunities. Sometimes the right choice isn't the happy choice in the
short term

[POI Reminder]
Good job offering POIs in the round!

[Time Feedback]
Speaking time: 05:15 - Good work!
```

---

## 11. CRITICAL INSIGHTS FOR FEEDBACK SYSTEM DESIGN

### What Makes Feedback "Good" Based on These Examples:

1. **SPECIFICITY OVER GENERALITY**
   - Bad: "Your argument needs more development"
   - Good: "Explain WHY Opp must defend these characteristics. Because children don't instinctively want to work so hard, thus parents will have no choice but to devolve to authoritarian standards"

2. **PRESCRIPTIVE EXPANSION**
   - Don't just say "add more"
   - Provide the ACTUAL content they should have included
   - Give them fully formed argument text

3. **QUESTION-DRIVEN**
   - "Could we also immediately highlight what exactly are these structural barriers?"
   - "Is there a reason why we're analyzing this up top?"
   - Forces student to think critically

4. **STRATEGIC VOCABULARY**
   - Use proper debate terminology
   - "Clash", "weighing", "mechanism", "characterization", "burden", "framework"

5. **STRUCTURAL ORGANIZATION**
   - Group feedback by argument/section
   - Use clear headers: "On the counter set-up:", "On the first clash:"

6. **MECHANISTIC FOCUS**
   - Always ask/provide the HOW and WHY
   - "What is the mechanistic analysis?"
   - "Explain WHY this leads to that outcome"

7. **CONTEXT-AWARE**
   - Feedback references specific debate theory taught in class
   - Refers to previous debates and feedback history
   - Mentions opponent's specific arguments

8. **IMPROVEMENT-ORIENTED**
   - Even praise is followed by "could we also..."
   - Always pointing to the next level
   - Not just validation, but elevation

---

## 12. RUBRIC SCORING PATTERNS (INFERRED)

Since the documents show scoring options but not which was selected, here's what the scoring system implies:

### When to score N/A:
- Rebuttal for first speakers (no one to rebut yet)
- Teamwork for solo or first speaker in some formats
- POI for specific speech types where they're not applicable

### Scoring Philosophy (Based on rubric definitions):
- **5** = Exceptional, exceeds grade-level expectations
- **4** = Independent proficiency
- **3** = Competent with minor coaching needed (THIS IS "AVERAGE GOOD")
- **2** = Attempted but needs heavy support
- **1** = Not demonstrated
- **N/A** = Not applicable to this speech type/role

**Key Insight:** A score of 3 is NOT "barely passing" - it's **competent execution**. The scale is achievement-based, not percentage-based.

---

## 13. DIFFERENCES FROM CURRENT DATABASE RUBRICS

### Current System Rubrics (from schema.sql):
**Primary:**
- Argumentation (1-5)
- Delivery & Clarity (1-5)
- Structure (1-5)
- Engagement (1-5)

**Secondary:**
- Argumentation (1-5)
- Rebuttal Quality (1-5)
- Evidence & Examples (1-5)
- Speaking Rate & Clarity (1-5)
- Role Fulfillment (1-5)

### **ACTUAL** Rubrics Used in Mai Feedback:
1. Time Management
2. POI Engagement
3. Delivery & Style
4. Argument Completeness
5. Theory Application
6. Rebuttal Effectiveness
7. Teamwork & Extension
8. Feedback Implementation

**RECOMMENDATION:** Update database rubrics to match the actual rubrics being used in Mai feedback documents. The real rubrics are much more comprehensive and pedagogically sound.

---

## 14. FINAL RECOMMENDATIONS FOR FEEDBACK ENGINE

### Core Requirements:

1. **Adopt the 8-Rubric System**
   - Matches teacher practice
   - More comprehensive than current 5-rubric system
   - Better aligned with debate pedagogy

2. **Teacher Comment Structure**
   - Must follow the A→H pattern (Hook → Strategic → Argument → Rebuttal → Theory → Closing)
   - Each section needs specific analysis

3. **Linguistic Style**
   - Direct, imperative instructions
   - Question-driven guidance
   - Prescriptive expansion (provide full argument text)
   - Strategic debate vocabulary

4. **Context Requirements for Quality Feedback**
   - Motion
   - Speaker position (Prop 1-3, Opp 1-3, Reply)
   - Speaker's transcript
   - Opponent's arguments (prior speeches)
   - Student level
   - Expected speech duration
   - Prior feedback history

5. **Length Target**
   - 600-800 words (4,000 characters average)
   - Not shorter than 1,200 characters
   - Not longer than 6,200 characters

6. **Specificity Requirement**
   - Must reference actual transcript content
   - Must provide concrete examples
   - Must give explicit argument text student should have used
   - No generic platitudes

---

## CONCLUSION

The Mai feedback documents reveal a **highly sophisticated, structured, and pedagogically sound** feedback system. The teacher comments are not generic praise sandwiches - they are **intensive coaching sessions in text form**, providing:

- Specific strategic improvements
- Debate theory application
- Mechanistic reasoning guidance
- Prescriptive argument construction
- Context-aware evaluation

Building an LLM system to replicate this quality requires:
1. Adopting the exact 8-rubric structure
2. Following the A→H comment structure pattern
3. Using direct, prescriptive language with debate terminology
4. Providing full argument text expansions
5. Context-awareness of debate dynamics (position, prior speeches, theory)

This is **NOT** a simple "good job, try harder next time" feedback system. It's **expert-level debate coaching** that assumes deep knowledge of:
- Debate theory
- Strategic framing
- Argument construction
- Impact calculus
- Role-specific expectations

The automated system must be trained/prompted to think like an experienced debate coach, not just evaluate generic "good" vs "bad" speaking.
