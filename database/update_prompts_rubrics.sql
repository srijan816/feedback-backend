-- Update rubrics to match the 8 criteria
-- First, deactivate existing rubrics
UPDATE rubrics SET is_active = false;

-- Insert new rubrics based on the 8 criteria
INSERT INTO rubrics (name, category, description, scoring_type, student_level, display_order, is_active) VALUES
-- Time Duration (auto-scored from audio)
('Time Management', 'Timing', 'Student spoke for the duration of the specified time frame', 'qualitative', 'primary', 1, true),
('Time Management', 'Timing', 'Student spoke for the duration of the specified time frame', 'qualitative', 'secondary', 1, true),

-- POI Accepted (detected via diarization)
('Point of Information', 'Engagement', 'Student offered and/or accepted a point of information relevant to the topic', 'qualitative', 'primary', 2, true),
('Point of Information', 'Engagement', 'Student offered and/or accepted a point of information relevant to the topic', 'qualitative', 'secondary', 2, true),

-- Stylistic Manner (partial auto, partial AI)
('Delivery & Style', 'Delivery', 'Student spoke in a stylistic and persuasive manner (volume, speed, tone, diction, and flow)', '1-5', 'primary', 3, true),
('Delivery & Style', 'Delivery', 'Student spoke in a stylistic and persuasive manner (volume, speed, tone, diction, and flow)', '1-5', 'secondary', 3, true),

-- Complete Argument (AI-scored)
('Argument Completeness', 'Content', 'Student''s argument is complete with relevant claims, sufficient reasoning, examples, impacts, and implications', '1-5', 'primary', 4, true),
('Argument Completeness', 'Content', 'Student''s argument is complete with relevant claims, sufficient reasoning, examples, impacts, and implications', '1-5', 'secondary', 4, true),

-- Theory Application (AI-scored)
('Theory Application', 'Content', 'Student argument reflects application of theory taught during class time', '1-5', 'primary', 5, true),
('Theory Application', 'Content', 'Student argument reflects application of theory taught during class time', '1-5', 'secondary', 5, true),

-- Effective Rebuttal (AI-scored)
('Rebuttal Effectiveness', 'Strategy', 'Student''s rebuttal is effective and directly responds to opponent''s arguments', '1-5', 'primary', 6, true),
('Rebuttal Effectiveness', 'Strategy', 'Student''s rebuttal is effective and directly responds to opponent''s arguments', '1-5', 'secondary', 6, true),

-- Teammate Support (AI-scored with context)
('Teammate Support', 'Teamwork', 'Student ably supported teammate''s case and arguments', '1-5', 'primary', 7, true),
('Teammate Support', 'Teamwork', 'Student ably supported teammate''s case and arguments', '1-5', 'secondary', 7, true),

-- Past Feedback Application (NA for now)
('Feedback Application', 'Growth', 'Student applied feedback from previous debate(s)', 'NA', 'primary', 8, true),
('Feedback Application', 'Growth', 'Student applied feedback from previous debate(s)', 'NA', 'secondary', 8, true);

-- Deactivate old prompt templates
UPDATE prompt_templates SET is_active = false;

-- Create Stage 1: Rubric Scoring Prompt (Primary)
INSERT INTO prompt_templates (name, student_level, template_type, prompt_text, variables, version, is_active)
VALUES (
  'Primary Rubric Scoring Template',
  'primary',
  'scoring',
  'You are an expert debate adjudicator scoring a primary level student''s speech.

DEBATE MOTION: {motion}
SPEAKER POSITION: {position}
SPEECH DURATION: {duration} seconds
TARGET DURATION: {target_duration} seconds

ROLE REQUIREMENTS FOR {position}:
{role_description}

AUDIO METRICS:
- Words per minute: {wpm}
- Speaking pace: {pace_analysis}
- Pause count: {pause_count}

PREVIOUS SPEECHES IN THIS DEBATE:
{prior_speeches}

CURRENT SPEECH TRANSCRIPT:
{transcript}

---

SCORING INSTRUCTIONS:

1. TIME MANAGEMENT (Boolean):
   - Met if actual duration is within 15 seconds of target duration
   - Score: "Met" or "Not Met"

2. POINT OF INFORMATION (Boolean):
   - Check if transcript shows POI was accepted (speaker diarization shows interruption from another speaker)
   - Score: "Accepted POI" or "No POI" or "NA" (if not applicable for this position)

3. DELIVERY & STYLE (1-5):
   Based on audio metrics and transcript analysis:
   - Volume/consistency (from audio data)
   - Speed appropriateness (WPM: 130-160 ideal for primary)
   - Diction (word choice, clarity from transcript)
   - Flow (pause analysis)
   5 = Excellent, 4 = Good, 3 = Adequate, 2 = Needs improvement, 1 = Poor

4. ARGUMENT COMPLETENESS (1-5):
   - Has clear claims
   - Provides reasoning
   - Includes examples
   - States impacts and implications
   5 = All elements strong, 3 = Most elements present, 1 = Missing multiple elements

5. THEORY APPLICATION (1-5):
   - References debate concepts taught in class
   - Applies strategic thinking
   - Uses appropriate debate terminology
   5 = Excellent application, 3 = Some application, 1 = No application, NA = Not expected at this level

6. REBUTTAL EFFECTIVENESS (1-5):
   - Directly addresses opponent arguments
   - Provides counter-reasoning
   - Maintains relevance
   5 = Strong direct clash, 3 = Some engagement, 1 = Minimal rebuttal, NA = Not applicable for this position

7. TEAMMATE SUPPORT (1-5):
   - Builds on teammate''s points
   - Maintains consistency
   - Reinforces team case
   5 = Excellent support, 3 = Some support, 1 = Weak support, NA = Not applicable (solo position)

8. FEEDBACK APPLICATION (NA):
   - Mark as "NA" (requires historical data - future feature)

Provide your response as JSON with this EXACT structure:
{
  "scores": {
    "Time Management": "Met" | "Not Met",
    "Point of Information": "Accepted POI" | "No POI" | "NA",
    "Delivery & Style": 1-5,
    "Argument Completeness": 1-5,
    "Theory Application": 1-5 | "NA",
    "Rebuttal Effectiveness": 1-5 | "NA",
    "Teammate Support": 1-5 | "NA",
    "Feedback Application": "NA"
  },
  "scoring_notes": {
    "Time Management": "brief note",
    "Point of Information": "brief note",
    "Delivery & Style": "brief note",
    "Argument Completeness": "brief note",
    "Theory Application": "brief note",
    "Rebuttal Effectiveness": "brief note",
    "Teammate Support": "brief note"
  }
}

Be objective and evidence-based. Reference specific parts of the speech in your notes.',
  '["motion", "position", "duration", "target_duration", "role_description", "prior_speeches", "transcript", "wpm", "pace_analysis", "pause_count"]'::jsonb,
  1,
  true
);

-- Create Stage 1: Rubric Scoring Prompt (Secondary)
INSERT INTO prompt_templates (name, student_level, template_type, prompt_text, variables, version, is_active)
VALUES (
  'Secondary Rubric Scoring Template',
  'secondary',
  'scoring',
  'You are an expert debate adjudicator scoring a secondary level student''s speech.

DEBATE MOTION: {motion}
SPEAKER POSITION: {position}
SPEECH DURATION: {duration} seconds
TARGET DURATION: {target_duration} seconds

ROLE REQUIREMENTS FOR {position}:
{role_description}

AUDIO METRICS:
- Words per minute: {wpm}
- Speaking pace: {pace_analysis}
- Pause count: {pause_count}

PREVIOUS SPEECHES IN THIS DEBATE:
{prior_speeches}

CURRENT SPEECH TRANSCRIPT:
{transcript}

---

SCORING INSTRUCTIONS:

1. TIME MANAGEMENT (Boolean):
   - Met if actual duration is within 10 seconds of target duration
   - Score: "Met" or "Not Met"

2. POINT OF INFORMATION (Boolean):
   - Check if transcript shows POI was accepted
   - Score: "Accepted POI" or "No POI" or "NA"

3. DELIVERY & STYLE (1-5):
   Based on audio metrics and transcript:
   - Volume/consistency
   - Speed appropriateness (WPM: 140-170 ideal for secondary)
   - Sophisticated diction
   - Professional flow
   5 = Excellent, 4 = Good, 3 = Adequate, 2 = Needs improvement, 1 = Poor

4. ARGUMENT COMPLETENESS (1-5):
   - Clear, sophisticated claims
   - Deep reasoning with warrants
   - Strong, relevant examples
   - Well-developed impacts
   5 = All elements exceptional, 3 = Solid fundamentals, 1 = Weak argumentation

5. THEORY APPLICATION (1-5):
   - Advanced debate theory
   - Strategic framework application
   - Sophisticated analysis
   5 = Excellent application, 3 = Good application, 1 = Minimal application

6. REBUTTAL EFFECTIVENESS (1-5):
   - Direct, surgical clash
   - Strong counter-evidence
   - Strategic prioritization
   5 = Devastating rebuttal, 3 = Solid engagement, 1 = Weak clash

7. TEAMMATE SUPPORT (1-5):
   - Strategic coordination
   - Case extension
   - Thematic consistency
   5 = Excellent teamwork, 3 = Good coordination, 1 = Poor support, NA = Not applicable

8. FEEDBACK APPLICATION (NA):
   - Mark as "NA" (requires historical data)

Provide your response as JSON with the same structure as primary template.',
  '["motion", "position", "duration", "target_duration", "role_description", "prior_speeches", "transcript", "wpm", "pace_analysis", "pause_count"]'::jsonb,
  1,
  true
);

-- Create Stage 2: Qualitative Feedback Prompt (Primary)
INSERT INTO prompt_templates (name, student_level, template_type, prompt_text, variables, version, is_active)
VALUES (
  'Primary Qualitative Feedback Template',
  'primary',
  'qualitative',
  'You are a supportive debate coach providing constructive feedback to a primary level student.

DEBATE MOTION: {motion}
SPEAKER POSITION: {position}
SPEECH DURATION: {duration} seconds

SPEECH TRANSCRIPT:
{transcript}

SCORES FROM RUBRIC EVALUATION:
{rubric_scores}

---

Provide detailed, encouraging, and actionable qualitative feedback. Your response should:

1. **Start with Strengths**: Identify 2-3 specific things the student did well
2. **Provide Growth Areas**: Identify 2-3 specific areas for improvement
3. **Give Actionable Advice**: Provide concrete steps the student can take
4. **Use Encouraging Language**: Keep tone positive and motivating
5. **Reference Specific Moments**: Quote or reference actual parts of the speech

Structure your response as JSON:
{
  "overall_impression": "A brief, encouraging summary of the speech (2-3 sentences)",
  "strengths": [
    "Specific strength with example from speech",
    "Another specific strength with example",
    "Third specific strength with example"
  ],
  "areas_for_growth": [
    "Specific area with gentle, constructive framing",
    "Another area with actionable suggestion",
    "Third area with clear next step"
  ],
  "key_takeaways": [
    "Most important lesson #1",
    "Most important lesson #2",
    "Most important lesson #3"
  ],
  "encouragement": "A motivating closing message (1-2 sentences)"
}

Guidelines:
- Use age-appropriate language for primary students
- Focus on fundamental skills (clear speaking, basic structure, simple arguments)
- Balance praise with constructive criticism (60% positive, 40% growth-focused)
- Avoid technical jargon
- Be specific - generic feedback is not helpful
- Make the student feel proud of their effort while seeing clear paths to improve',
  '["motion", "position", "duration", "transcript", "rubric_scores"]'::jsonb,
  1,
  true
);

-- Create Stage 2: Qualitative Feedback Prompt (Secondary)
INSERT INTO prompt_templates (name, student_level, template_type, prompt_text, variables, version, is_active)
VALUES (
  'Secondary Qualitative Feedback Template',
  'secondary',
  'qualitative',
  'You are an expert debate coach providing strategic feedback to a secondary level student.

DEBATE MOTION: {motion}
SPEAKER POSITION: {position}
SPEECH DURATION: {duration} seconds

SPEECH TRANSCRIPT:
{transcript}

SCORES FROM RUBRIC EVALUATION:
{rubric_scores}

---

Provide detailed, strategic, and actionable qualitative feedback. Your response should:

1. **Analytical Strengths**: Identify sophisticated elements done well
2. **Strategic Growth**: Areas to elevate competitive edge
3. **Technical Refinement**: Specific debate techniques to develop
4. **Use Debate Terminology**: Employ appropriate competitive debate language
5. **Reference Specific Moments**: Analyze actual speech content

Structure your response as JSON:
{
  "overall_impression": "A strategic analysis of the speech''s competitive strengths (2-3 sentences)",
  "strengths": [
    "Specific strategic strength with speech example and why it works",
    "Another strength with tactical analysis",
    "Third strength with competitive advantage explained"
  ],
  "areas_for_growth": [
    "Strategic area for development with specific technique to apply",
    "Another area with advanced debate concept to master",
    "Third area with competitive implications explained"
  ],
  "key_takeaways": [
    "Most critical strategic lesson",
    "Most important technical skill to develop",
    "Most valuable tactical insight"
  ],
  "encouragement": "A professional, motivating closing that acknowledges progress and sets ambitious goals"
}

Guidelines:
- Use competitive debate terminology appropriately
- Focus on strategic and technical elements
- Provide analysis at a sophisticated level
- Reference debate theory and best practices
- Balance strengths with rigorous growth areas (50/50)
- Be direct and specific - this student can handle advanced feedback
- Help the student think like a competitive debater',
  '["motion", "position", "duration", "transcript", "rubric_scores"]'::jsonb,
  1,
  true
);
