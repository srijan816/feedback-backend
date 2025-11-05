-- Seed prompts and rubrics for debate feedback system

-- Insert Primary Level Prompt Template
INSERT INTO prompt_templates (name, student_level, template_type, prompt_text, version, is_active) VALUES
('Primary Full Feedback Template', 'primary', 'full',
'You are an expert debate coach providing feedback to a primary level student.

DEBATE MOTION: {motion}
SPEAKER POSITION: {position}
SPEECH DURATION: {duration} seconds

ROLE REQUIREMENTS FOR {position}:
{role_description}

PREVIOUS SPEECHES CONTEXT:
{prior_speeches}

CURRENT SPEECH TRANSCRIPT:
{transcript}

---

Please analyze this speech according to the following rubrics:
{rubrics}

Provide your response as JSON with this EXACT structure:
{
  "scores": {
    "Argumentation": 1-5 or "NA",
    "Delivery & Clarity": 1-5 or "NA",
    "Structure": 1-5 or "NA",
    "Engagement": 1-5 or "NA"
  },
  "feedback": {
    "Argumentation": ["specific point 1", "specific point 2", "specific point 3"],
    "Delivery & Clarity": ["specific point 1", "specific point 2"],
    "Structure": ["specific point 1", "specific point 2"],
    "Engagement": ["specific point 1", "specific point 2"]
  }
}

IMPORTANT GUIDELINES:
- Be specific and constructive
- Reference actual parts of the speech
- Balance strengths with areas for improvement
- Use encouraging language appropriate for primary students
- Keep feedback concise (3-4 bullet points per category)
- Focus on fundamental debate skills: clear speaking, simple arguments, basic structure
- Avoid overly technical debate terminology', 1, true);

-- Insert Secondary Level Prompt Template
INSERT INTO prompt_templates (name, student_level, template_type, prompt_text, version, is_active) VALUES
('Secondary Full Feedback Template', 'secondary', 'full',
'You are an expert debate coach providing feedback to a secondary level student.

DEBATE MOTION: {motion}
SPEAKER POSITION: {position}
SPEECH DURATION: {duration} seconds

ROLE REQUIREMENTS FOR {position}:
{role_description}

PREVIOUS SPEECHES CONTEXT:
{prior_speeches}

CURRENT SPEECH TRANSCRIPT:
{transcript}

---

Please analyze this speech according to the following rubrics:
{rubrics}

Provide your response as JSON with this EXACT structure:
{
  "scores": {
    "Argumentation": 1-5 or "NA",
    "Rebuttal Quality": 1-5 or "NA",
    "Evidence & Examples": 1-5 or "NA",
    "Speaking Rate & Clarity": 1-5 or "NA",
    "Role Fulfillment": 1-5 or "NA"
  },
  "feedback": {
    "Argumentation": ["specific point 1", "specific point 2", "specific point 3"],
    "Rebuttal Quality": ["specific point 1", "specific point 2", "specific point 3"],
    "Evidence & Examples": ["specific point 1", "specific point 2"],
    "Speaking Rate & Clarity": ["specific point 1", "specific point 2"],
    "Role Fulfillment": ["specific point 1", "specific point 2", "specific point 3"]
  }
}

IMPORTANT GUIDELINES:
- Be specific and analytical
- Reference actual arguments and moments from the speech
- Assess role fulfillment based on the speaker''s position
- Evaluate engagement with prior speakers'' arguments when applicable
- Provide actionable improvements with clear reasoning
- Use appropriate debate terminology
- Consider both strategic and technical aspects of debating', 1, true);

-- Note: Rubrics are already inserted via schema.sql
-- These prompts will use those rubrics dynamically

-- Update rubrics if needed for more detailed criteria
UPDATE rubrics SET criteria = '{"5": "Clear, well-developed claims with logical reasoning and relevant, specific examples", "3": "Some clear claims with basic reasoning, but examples may be vague or limited", "1": "Unclear claims with little to no reasoning or examples"}'
WHERE name = 'Argumentation' AND student_level = 'primary';

UPDATE rubrics SET criteria = '{"5": "Excellent pace (120-150 wpm), clear pronunciation, minimal filler words, strong eye contact", "3": "Acceptable pace with some clarity issues, moderate filler words, some eye contact", "1": "Too fast/slow, unclear speech, excessive filler words, poor eye contact"}'
WHERE name = 'Delivery & Clarity' AND student_level = 'primary';

UPDATE rubrics SET criteria = '{"5": "Clear introduction, logical flow, effective signposting, strong conclusion", "3": "Basic structure present but may lack clear signposting or smooth transitions", "1": "No clear structure, disorganized, hard to follow"}'
WHERE name = 'Structure' AND student_level = 'primary';

UPDATE rubrics SET criteria = '{"5": "High energy, genuine enthusiasm, connects with audience, maintains interest", "3": "Some engagement but may seem rehearsed or lack energy at times", "1": "Monotone, disengaged, fails to connect with audience"}'
WHERE name = 'Engagement' AND student_level = 'primary';

-- Secondary level rubric criteria
UPDATE rubrics SET criteria = '{"5": "Sophisticated analysis with strong logical chain, multiple well-developed arguments with clear impacts", "3": "Adequate arguments with some logical development, impacts may be unclear", "1": "Weak arguments with poor logic, missing or vague impacts"}'
WHERE name = 'Argumentation' AND student_level = 'secondary';

UPDATE rubrics SET criteria = '{"5": "Direct, specific refutation of opposing arguments, identifies key clashes, provides counter-evidence", "3": "Some engagement with opposition but may miss key arguments or lack specificity", "1": "No meaningful rebuttal, ignores opposing case, or only offers assertions"}'
WHERE name = 'Rebuttal Quality' AND student_level = 'secondary';

UPDATE rubrics SET criteria = '{"5": "Multiple credible sources cited with details, relevant real-world examples, statistics/data used effectively", "3": "Some examples or evidence provided but may lack credibility or relevance", "1": "No evidence, only assertions, or examples are irrelevant"}'
WHERE name = 'Evidence & Examples' AND student_level = 'secondary';

UPDATE rubrics SET criteria = '{"5": "Optimal speaking rate (140-160 wpm), crystal clear articulation, minimal to no filler words", "3": "Acceptable rate with some clarity issues, moderate use of filler words", "1": "Too fast or too slow, unclear speech, excessive filler words (um, like, uh)"}'
WHERE name = 'Speaking Rate & Clarity' AND student_level = 'secondary';

UPDATE rubrics SET criteria = '{"5": "Perfectly executed all role-specific duties, strong team coordination, strategic positioning", "3": "Met basic role requirements but may have missed some strategic opportunities", "1": "Failed to fulfill role expectations, poor team coordination, strategic errors"}'
WHERE name = 'Role Fulfillment' AND student_level = 'secondary';
