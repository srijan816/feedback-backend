import { query } from '../config/database.js';
import { callLLM } from './llm.js';
import logger from '../utils/logger.js';
import { Rubric, StudentLevel } from '../types/index.js';

export interface FeedbackInput {
  speech_id: string;
  debate_id: string;
  motion: string;
  speaker_name: string;
  speaker_position: string;
  student_level: StudentLevel;
  transcript_text: string;
  duration_seconds: number;
}

export interface FeedbackOutput {
  scores: Record<string, number | 'NA'>;
  qualitative_feedback: Record<string, string[]>;
  processing_time_ms: number;
  llm_provider: string;
  llm_model: string;
  prompt_used: string;
}

/**
 * Get role description for a speaker position
 */
function getRoleDescription(position: string): string {
  const roleDescriptions: Record<string, string> = {
    'Prop 1': `- Establish the core definition and framework for the motion
- Present the first 1-2 main arguments
- Set the tone and direction for your team
- No rebuttal required (first speaker)`,

    'Prop 2': `- Refute Opp 1's arguments (direct clash)
- Present 1-2 new Proposition arguments
- Support and extend Prop 1's case
- Begin building weighing arguments`,

    'Prop 3': `- Summarize and crystallize Proposition case
- Rebut key Opposition arguments
- Provide comparative weighing (why Prop wins)
- No new arguments (summary speech)`,

    'Opp 1': `- Refute Prop 1's framework and arguments
- Present the first 1-2 Opposition arguments
- Establish Opposition's stance
- Direct clash with Proposition's case`,

    'Opp 2': `- Refute Prop 1 and Prop 2's arguments
- Present 1-2 new Opposition arguments
- Support and extend Opp 1's case
- Begin building weighing arguments`,

    'Opp 3': `- Summarize and crystallize Opposition case
- Rebut key Proposition arguments
- Provide comparative weighing (why Opp wins)
- No new arguments (summary speech)`,
  };

  return (
    roleDescriptions[position] ||
    `- Fulfill your designated role as ${position}
- Engage with opposing arguments
- Support your team's case
- Provide clear reasoning and evidence`
  );
}

/**
 * Fetch prior speeches in the debate for context
 */
async function getPriorSpeeches(
  debate_id: string,
  current_speech_created_at: Date
): Promise<
  Array<{
    speaker_position: string;
    transcript_text: string;
  }>
> {
  const result = await query(
    `SELECT s.speaker_position, t.transcript_text, s.created_at
     FROM speeches s
     JOIN transcripts t ON s.id = t.speech_id
     WHERE s.debate_id = $1
     AND s.created_at < $2
     AND s.transcription_status = 'completed'
     ORDER BY s.created_at ASC`,
    [debate_id, current_speech_created_at]
  );

  return result.rows;
}

/**
 * Get active rubrics for student level
 */
async function getRubrics(studentLevel: StudentLevel): Promise<Rubric[]> {
  const result = await query<Rubric>(
    `SELECT * FROM rubrics
     WHERE (student_level = $1 OR student_level = 'both')
     AND is_active = true
     ORDER BY display_order, category`,
    [studentLevel]
  );

  return result.rows;
}

/**
 * Get active prompt template
 */
async function getPromptTemplate(studentLevel: StudentLevel): Promise<string> {
  const result = await query(
    `SELECT prompt_text FROM prompt_templates
     WHERE (student_level = $1 OR student_level = 'both')
     AND template_type = 'full'
     AND is_active = true
     ORDER BY version DESC
     LIMIT 1`,
    [studentLevel]
  );

  if (result.rows.length === 0) {
    // Fallback to default prompt if none exists
    return getDefaultPromptTemplate(studentLevel);
  }

  return result.rows[0].prompt_text;
}

/**
 * Default prompt template if none exists in database
 */
function getDefaultPromptTemplate(studentLevel: StudentLevel): string {
  if (studentLevel === 'primary') {
    return `You are an expert debate coach providing feedback to a primary level student.

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

Provide your response as JSON with this exact structure:
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

IMPORTANT:
- Be specific and constructive
- Reference actual parts of the speech
- Balance strengths with areas for improvement
- Use encouraging language appropriate for primary students
- Keep feedback concise (3-4 bullet points per category)`;
  } else {
    return `You are an expert debate coach providing feedback to a secondary level student.

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

Provide your response as JSON with this exact structure:
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
    "Rebuttal Quality": ["specific point 1", "specific point 2"],
    "Evidence & Examples": ["specific point 1", "specific point 2"],
    "Speaking Rate & Clarity": ["specific point 1", "specific point 2"],
    "Role Fulfillment": ["specific point 1", "specific point 2"]
  }
}

IMPORTANT:
- Be specific and analytical
- Reference actual arguments and moments from the speech
- Assess role fulfillment based on the speaker's position
- Evaluate engagement with prior speakers' arguments
- Provide actionable improvements`;
  }
}

/**
 * Build the complete prompt with all context
 */
async function buildFeedbackPrompt(input: FeedbackInput): Promise<string> {
  // Get template
  const template = await getPromptTemplate(input.student_level);

  // Get rubrics
  const rubrics = await getRubrics(input.student_level);
  const rubricsText = rubrics
    .map(
      (r) =>
        `- ${r.name}: ${r.description} (Scoring: ${r.scoring_type})`
    )
    .join('\n');

  // Get prior speeches for context
  const speechResult = await query(
    'SELECT created_at FROM speeches WHERE id = $1',
    [input.speech_id]
  );
  const currentSpeechTime = speechResult.rows[0]?.created_at;

  const priorSpeeches = await getPriorSpeeches(input.debate_id, currentSpeechTime);
  const priorSpeechesText =
    priorSpeeches.length > 0
      ? priorSpeeches
          .map(
            (ps) => `[${ps.speaker_position}]: ${ps.transcript_text.substring(0, 500)}...`
          )
          .join('\n\n')
      : 'None (this is the first speech)';

  // Get role description
  const roleDescription = getRoleDescription(input.speaker_position);

  // Replace placeholders
  const prompt = template
    .replace('{motion}', input.motion)
    .replace('{position}', input.speaker_position)
    .replace(/{position}/g, input.speaker_position)
    .replace('{duration}', input.duration_seconds.toString())
    .replace('{role_description}', roleDescription)
    .replace('{prior_speeches}', priorSpeechesText)
    .replace('{transcript}', input.transcript_text)
    .replace('{rubrics}', rubricsText);

  return prompt;
}

/**
 * Parse LLM response to extract scores and feedback
 */
function parseFeedbackResponse(responseText: string): {
  scores: Record<string, number | 'NA'>;
  qualitative_feedback: Record<string, string[]>;
} {
  try {
    // Try to extract JSON from markdown code blocks if present
    let jsonText = responseText;
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    } else {
      // Try without json keyword
      const codeMatch = responseText.match(/```\s*([\s\S]*?)\s*```/);
      if (codeMatch) {
        jsonText = codeMatch[1];
      }
    }

    const parsed = JSON.parse(jsonText);

    return {
      scores: parsed.scores || {},
      qualitative_feedback: parsed.feedback || {},
    };
  } catch (error) {
    logger.error('Failed to parse LLM feedback response', {
      error,
      response: responseText.substring(0, 200),
    });
    throw new Error('Failed to parse feedback response as JSON');
  }
}

/**
 * Generate feedback for a speech
 */
export async function generateFeedback(
  input: FeedbackInput,
  llmProvider: 'gemini_flash' | 'gemini_pro' | 'claude' = 'gemini_flash'
): Promise<FeedbackOutput> {
  const startTime = Date.now();

  try {
    logger.info('Generating feedback', {
      speech_id: input.speech_id,
      speaker_position: input.speaker_position,
      student_level: input.student_level,
    });

    // Build prompt with all context
    const prompt = await buildFeedbackPrompt(input);

    // Check if we should use contextual model (Pro) for speeches with prior context
    const speechResult = await query(
      'SELECT created_at FROM speeches WHERE id = $1',
      [input.speech_id]
    );
    const currentSpeechTime = speechResult.rows[0]?.created_at;
    const priorSpeeches = await getPriorSpeeches(input.debate_id, currentSpeechTime);
    const useContextual = priorSpeeches.length > 0;

    // Call LLM
    const llmResponse = await callLLM(prompt, llmProvider, useContextual);

    // Parse response
    const { scores, qualitative_feedback } = parseFeedbackResponse(
      llmResponse.text
    );

    const processingTime = Date.now() - startTime;

    logger.info('Feedback generated successfully', {
      speech_id: input.speech_id,
      processing_time_ms: processingTime,
      llm_provider: llmProvider,
    });

    return {
      scores,
      qualitative_feedback,
      processing_time_ms: processingTime,
      llm_provider: useContextual ? 'gemini_pro' : llmProvider,
      llm_model: useContextual
        ? 'gemini-2.5-pro'
        : 'gemini-2.5-flash-latest',
      prompt_used: prompt,
    };
  } catch (error) {
    logger.error('Feedback generation failed', {
      error,
      speech_id: input.speech_id,
    });
    throw error;
  }
}
