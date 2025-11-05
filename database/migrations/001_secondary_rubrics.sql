-- ============================================
-- Migration: Update Secondary Student Rubrics to 8-Rubric System
-- Date: 2025-10-28
-- Description: Replace current secondary rubrics with the comprehensive 8-rubric system
-- ============================================

-- Deactivate old secondary rubrics
UPDATE rubrics
SET is_active = false, updated_at = CURRENT_TIMESTAMP
WHERE student_level = 'secondary' AND is_active = true;

-- Insert the 8 secondary rubrics
INSERT INTO rubrics (name, category, student_level, scoring_type, description, criteria, display_order, is_active) VALUES

-- 1. Time Management
(
  'Time Management',
  'Structure',
  'secondary',
  '1-5',
  'Student spoke for the duration of the specified time frame',
  '{
    "1": "Unobserved. Significantly under or over time (>1 minute deviation).",
    "2": "Student attempt noted. Needs extended teacher support to properly execute skill. Significantly off target time.",
    "3": "Student effort noted. Can execute skill with minimal teacher input and guidance. Within 30-45 seconds of target time.",
    "4": "Student can execute skill with little to no prompting. Within 15-30 seconds of target time.",
    "5": "Student can execute skill without prompting; exceeds expectations for child of that level. Hits target time within 15 seconds."
  }'::jsonb,
  1,
  true
),

-- 2. POI Engagement
(
  'POI Engagement',
  'Engagement',
  'secondary',
  '1-5',
  'Student offered and/or accepted a point of information relevant to the topic',
  '{
    "NA": "Not applicable for this speech type (e.g., reply speeches).",
    "1": "Unobserved. No POI activity during debate.",
    "2": "Student attempt noted. Needs extended teacher support to properly execute skill. Attempted 1 POI but poorly timed or irrelevant.",
    "3": "Student effort noted. Can execute skill with minimal teacher input and guidance. Offered/accepted 1-2 relevant POIs.",
    "4": "Student can execute skill with little to no prompting. Offered/accepted 2-3 strategic, well-timed POIs.",
    "5": "Student can execute skill without prompting; exceeds expectations for child of that level. Offered/accepted 3+ highly strategic POIs that advanced debate."
  }'::jsonb,
  2,
  true
),

-- 3. Delivery & Style
(
  'Delivery & Style',
  'Delivery',
  'secondary',
  '1-5',
  'Student spoke in a stylistic and persuasive manner (e.g. volume, speed, tone, diction, and flow)',
  '{
    "1": "Unobserved. Inaudible, monotone, or extremely poor pacing. Excessive filler words. Difficult to understand.",
    "2": "Student attempt noted. Needs extended teacher support to properly execute skill. Audible but major issues with pace, tone, or clarity. Frequent filler words.",
    "3": "Student effort noted. Can execute skill with minimal teacher input and guidance. Clear and audible with adequate pacing. Some filler words. Generally understandable delivery.",
    "4": "Student can execute skill with little to no prompting. Strong volume, good pace, clear diction. Minimal filler words. Engaging tone with some vocal variety.",
    "5": "Student can execute skill without prompting; exceeds expectations for child of that level. Excellent volume, perfect pace, crystal clear diction. No filler words. Dynamic, persuasive tone with strong vocal variety."
  }'::jsonb,
  3,
  true
),

-- 4. Argument Completeness
(
  'Argument Completeness',
  'Content',
  'secondary',
  '1-5',
  'Student''s argument is complete in that it has relevant claims, supported by sufficient reasoning, examples, impacts, and implications',
  '{
    "1": "Unobserved. No clear arguments presented. Missing most components (claims, reasoning, examples, impacts).",
    "2": "Student attempt noted. Needs extended teacher support to properly execute skill. Arguments attempted but missing multiple key components. Claims unclear or reasoning weak.",
    "3": "Student effort noted. Can execute skill with minimal teacher input and guidance. Arguments include claims and basic reasoning. Some examples provided. Impacts mentioned but could be stronger.",
    "4": "Student can execute skill with little to no prompting. Complete arguments with clear claims, solid reasoning, relevant examples, and well-articulated impacts and implications.",
    "5": "Student can execute skill without prompting; exceeds expectations for child of that level. Exceptional arguments with crystal-clear claims, sophisticated reasoning, compelling examples, and deeply analyzed impacts with broader implications."
  }'::jsonb,
  4,
  true
),

-- 5. Theory Application
(
  'Theory Application',
  'Strategy',
  'secondary',
  '1-5',
  'Student argument reflects application of theory taught during class time (e.g. strategic framing, weighing, stakeholder analysis, burden shifts, counter set-ups)',
  '{
    "1": "Unobserved. No application of debate theory or techniques taught in class.",
    "2": "Student attempt noted. Needs extended teacher support to properly execute skill. Attempted to use taught theory but execution is unclear or ineffective.",
    "3": "Student effort noted. Can execute skill with minimal teacher input and guidance. Basic application of 1-2 debate techniques (e.g., simple framing or weighing).",
    "4": "Student can execute skill with little to no prompting. Clear application of multiple debate techniques (e.g., strategic framing, weighing, stakeholder analysis). Techniques used effectively.",
    "5": "Student can execute skill without prompting; exceeds expectations for child of that level. Sophisticated application of advanced debate theory (burden shifts, counter set-ups, comparative weighing, mechanistic reasoning). Multiple techniques used strategically and seamlessly."
  }'::jsonb,
  5,
  true
),

-- 6. Rebuttal Effectiveness
(
  'Rebuttal Effectiveness',
  'Content',
  'secondary',
  '1-5',
  'Student''s rebuttal is effective, and directly responds to an opponent''s arguments',
  '{
    "NA": "Not applicable for first speakers with no prior speeches to rebut.",
    "1": "Unobserved. No rebuttal provided or completely failed to engage with opponent arguments.",
    "2": "Student attempt noted. Needs extended teacher support to properly execute skill. Attempted rebuttal but lacks direct clash. Talking past opponents rather than engaging their specific claims.",
    "3": "Student effort noted. Can execute skill with minimal teacher input and guidance. Basic rebuttal that engages some opponent arguments. Some direct clash but could be more specific or thorough.",
    "4": "Student can execute skill with little to no prompting. Effective rebuttal with clear, direct clash. Addresses specific opponent claims with counter-reasoning and evidence.",
    "5": "Student can execute skill without prompting; exceeds expectations for child of that level. Exceptional rebuttal with sophisticated, layered clash. Directly refutes key opponent arguments with multiple angles of attack, comparative weighing, and strategic turns/flips."
  }'::jsonb,
  6,
  true
),

-- 7. Teamwork & Extension
(
  'Teamwork & Extension',
  'Strategy',
  'secondary',
  '1-5',
  'Student ably supported teammate''s case and arguments',
  '{
    "NA": "Not applicable for first speakers or solo debate formats.",
    "1": "Unobserved. Failed to reference or support teammate''s case. Contradicted team position.",
    "2": "Student attempt noted. Needs extended teacher support to properly execute skill. Mentioned teammate''s arguments but failed to extend or support them effectively. Possible minor contradictions.",
    "3": "Student effort noted. Can execute skill with minimal teacher input and guidance. Referenced teammate''s arguments and provided basic support. Consistent with team position.",
    "4": "Student can execute skill with little to no prompting. Clearly extended and reinforced teammate''s key arguments. Added new layers or perspectives that strengthened team case.",
    "5": "Student can execute skill without prompting; exceeds expectations for child of that level. Exceptional teamwork - seamlessly integrated teammate''s arguments into broader narrative, provided sophisticated extensions, and strategically built on team framework to create cohesive case."
  }'::jsonb,
  7,
  true
),

-- 8. Feedback Implementation
(
  'Feedback Implementation',
  'Development',
  'secondary',
  '1-5',
  'Student applied feedback from previous debate(s)',
  '{
    "NA": "Not applicable for first debate with no prior feedback available.",
    "1": "Unobserved. Repeated same mistakes from previous feedback without improvement.",
    "2": "Student attempt noted. Needs extended teacher support to properly execute skill. Attempted to address 1 feedback point but execution still weak or incomplete.",
    "3": "Student effort noted. Can execute skill with minimal teacher input and guidance. Addressed 1-2 feedback points from previous debates with visible improvement.",
    "4": "Student can execute skill with little to no prompting. Clearly addressed multiple feedback points. Significant improvement visible in previously critiqued areas.",
    "5": "Student can execute skill without prompting; exceeds expectations for child of that level. Exceptional improvement - addressed all major feedback points from previous debates and demonstrated mastery of previously weak skills."
  }'::jsonb,
  8,
  true
);

-- Create a view to show active secondary rubrics for easy reference
CREATE OR REPLACE VIEW active_secondary_rubrics AS
SELECT
  name,
  category,
  description,
  criteria,
  display_order
FROM rubrics
WHERE student_level = 'secondary'
  AND is_active = true
ORDER BY display_order;

-- Verify the migration
DO $$
DECLARE
  active_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_count
  FROM rubrics
  WHERE student_level = 'secondary' AND is_active = true;

  IF active_count <> 8 THEN
    RAISE EXCEPTION 'Migration failed: Expected 8 active secondary rubrics, found %', active_count;
  END IF;

  RAISE NOTICE 'Migration successful: 8 secondary rubrics active';
END $$;
