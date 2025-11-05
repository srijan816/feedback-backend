/**
 * Rubric Scoring Service using Gemini Flash with Structured JSON Output
 */

import { readFileSync } from 'fs';
import path from 'path';
import axios from 'axios';

// Load the rubric scoring prompt template
const PROMPT_TEMPLATE_PATH = path.join(__dirname, '../../prompts/RUBRIC_SCORING_PROMPT.md');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDwdU2z6Dld3hLy8oEvEBy3Lx8-Mxg4y2s';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

interface RubricScores {
  'Time Management': number | 'NA';
  'POI Engagement': number | 'NA';
  'Delivery & Style': number | 'NA';
  'Argument Completeness': number | 'NA';
  'Theory Application': number | 'NA';
  'Rebuttal Effectiveness': number | 'NA';
  'Teamwork & Extension': number | 'NA';
  'Feedback Implementation': number | 'NA';
}

interface RubricJustifications {
  'Time Management': string;
  'POI Engagement': string;
  'Delivery & Style': string;
  'Argument Completeness': string;
  'Theory Application': string;
  'Rebuttal Effectiveness': string;
  'Teamwork & Extension': string;
  'Feedback Implementation': string;
}

export interface RubricScoringResult {
  scores: RubricScores;
  justifications: RubricJustifications;
  average_score: number;
  total_scored_rubrics: number;
}

function loadPromptTemplate(): string {
  return readFileSync(PROMPT_TEMPLATE_PATH, 'utf-8');
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function buildScoringPrompt(params: {
  motion: string;
  position: string;
  expectedDuration: number;
  actualTimeSeconds: number;
  transcript: string;
  priorSpeechesContext?: string;
}): string {
  const template = loadPromptTemplate();

  const actualTime = formatTime(params.actualTimeSeconds);

  let prompt = template.replace(/\{\{MOTION\}\}/g, params.motion);
  prompt = prompt.replace(/\{\{POSITION\}\}/g, params.position);
  prompt = prompt.replace(/\{\{EXPECTED_DURATION\}\}/g, params.expectedDuration.toString());
  prompt = prompt.replace(/\{\{ACTUAL_TIME\}\}/g, actualTime);
  prompt = prompt.replace(/\{\{TRANSCRIPT\}\}/g, params.transcript);
  prompt = prompt.replace(/\{\{PRIOR_SPEECHES_CONTEXT\}\}/g, params.priorSpeechesContext || 'This is the first speech.');

  return prompt;
}

export async function scoreRubrics(params: {
  motion: string;
  position: string;
  expectedDuration: number;
  actualTimeSeconds: number;
  transcript: string;
  priorSpeechesContext?: string;
  apiKey?: string;
}): Promise<RubricScoringResult> {
  const apiKey = params.apiKey || GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not found in environment or parameters');
  }

  // Build prompt
  const prompt = buildScoringPrompt({
    motion: params.motion,
    position: params.position,
    expectedDuration: params.expectedDuration,
    actualTimeSeconds: params.actualTimeSeconds,
    transcript: params.transcript,
    priorSpeechesContext: params.priorSpeechesContext,
  });

  // Call Gemini API with structured output
  try {
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${apiKey}`,
      {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3, // Lower temperature for more consistent scoring
          maxOutputTokens: 2048,
        },
        thinkingConfig: {
          thinkingBudget: 24576,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    // Extract the JSON response
    const candidate = response.data.candidates?.[0];
    const content = candidate?.content;
    const text = content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('No response text from Gemini API');
    }

    // Parse JSON
    const result: RubricScoringResult = JSON.parse(text);

    return result;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Gemini API Error:', error.response?.data || error.message);
      throw new Error(`Failed to score rubrics: ${error.response?.data?.error?.message || error.message}`);
    }
    throw error;
  }
}

// Example usage
async function example() {
  const result = await scoreRubrics({
    motion: 'This House Would give prisoners the right to vote',
    position: 'Prop 1',
    expectedDuration: 5,
    actualTimeSeconds: 315, // 5:15
    transcript: `
      Good morning judges. Today we're here to discuss why prisoners should have the right to vote.
      Let me signpost my speech. I'll present two main arguments: first, that voting is a fundamental right,
      and second, that prisoner voting improves criminal justice policies.

      My first argument is about fundamental rights...
    `,
  });

  console.log(JSON.stringify(result, null, 2));
}

// Uncomment to test
// example();
