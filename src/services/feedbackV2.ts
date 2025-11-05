/**
 * Feedback Generation V2 - With Timestamped Playable Moments
 * Uses Gemini 2.5 Pro with extended thinking budget
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import pool from '../config/database.js';
import {
  TranscriptWord,
  SemanticChunk,
  createSemanticChunks,
  formatChunksForLLM,
  chunkToPlayableMoment
} from './transcriptChunking.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
// Using 1.5 Flash - more stable
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent';

export interface PlayableMoment {
  chunk_id: number;
  start_seconds: number;
  end_seconds: number;
  start_time: string;    // "02:15"
  end_time: string;      // "03:00"
  category: 'gap' | 'unclear' | 'weak' | 'transition' | 'excellent';
  severity: 'praise' | 'critical';
  what_they_said: string;
  issue: string;
  recommendation: string;
}

export interface FeedbackV2Result {
  rubric_scores: {
    scores: Record<string, number | string>;
    justifications: Record<string, string>;
    average_score: number;
    total_scored_rubrics: number;
  };
  strategic_overview: {
    hook_and_signposting: string;
    strategic_assessment: string;
    missing_arguments: string;
  };
  playable_moments: PlayableMoment[];
  audio_metadata: {
    url?: string;
    duration_seconds: number;
  };
  chunks_metadata: {
    total_chunks: number;
    chunk_labels: string[];
  };
}

interface LLMPlayableMoment {
  chunk_id: number;
  category: string;
  severity: string;
  issue: string;
  recommendation: string;
}

interface LLMResponse {
  rubric_scores: {
    scores: Record<string, number | string>;
    justifications: Record<string, string>;
    average_score: number;
    total_scored_rubrics: number;
  };
  strategic_overview: {
    hook_and_signposting: string;
    strategic_assessment: string;
    missing_arguments: string;
  };
  playable_moments: LLMPlayableMoment[];
}

/**
 * Fetch transcript words from database
 * Optionally filter by speaker for multi-speaker transcripts
 */
async function fetchTranscriptWords(transcriptId: number, speakerFilter?: string): Promise<TranscriptWord[]> {
  let query = `SELECT id, word_index, text, start_ms, end_ms, confidence, speaker
               FROM transcript_words
               WHERE transcript_id = $1`;

  const params: any[] = [transcriptId];

  if (speakerFilter) {
    query += ` AND speaker = $2`;
    params.push(speakerFilter);
  }

  query += ` ORDER BY word_index ASC`;

  const result = await pool.query(query, params);

  return result.rows;
}

/**
 * Determine motion type from motion text
 */
function getMotionType(motion: string): string {
  const lower = motion.toLowerCase();
  if (lower.includes('this house would')) {
    return 'policy';
  } else if (lower.includes('this house prefers')) {
    return 'comparison';
  } else {
    return 'principle';
  }
}

/**
 * Build the complete V2 prompt
 */
function buildV2Prompt(params: {
  motion: string;
  position: string;
  expectedDuration: number;
  actualTime: string;
  chunkedTranscript: string;
}): string {
  const promptTemplate = fs.readFileSync(
    path.join(process.cwd(), 'prompts', 'FEEDBACK_V2_WITH_TIMESTAMPS.md'),
    'utf-8'
  );

  const motionType = getMotionType(params.motion);

  let prompt = promptTemplate.replace('{{MOTION}}', params.motion);
  prompt = prompt.replace('{{MOTION_TYPE}}', motionType);
  prompt = prompt.replace('{{POSITION}}', params.position);
  prompt = prompt.replace('{{EXPECTED_DURATION}}', params.expectedDuration.toString());
  prompt = prompt.replace('{{ACTUAL_TIME}}', params.actualTime);
  prompt = prompt.replace('{{CHUNKED_TRANSCRIPT}}', params.chunkedTranscript);

  return prompt;
}

/**
 * Call Gemini 2.5 Pro with structured JSON output
 */
async function callGeminiV2(prompt: string): Promise<LLMResponse> {
  try {
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
          maxOutputTokens: 4096
        }
        // Note: thinkingConfig requires Python SDK with google-genai library
        // REST API doesn't support it yet
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 120000  // 2 minutes timeout
      }
    );

    const text = response.data.candidates[0].content.parts[0].text;
    console.log('Gemini Response Length:', text.length);
    console.log('Gemini Response Preview:', text.substring(0, 500));
    return JSON.parse(text);
  } catch (error: any) {
    if (error.response) {
      console.error('Gemini API Error:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

/**
 * Generate V2 feedback with playable moments
 */
export async function generateFeedbackV2(params: {
  transcriptId: number;
  motion: string;
  position: string;
  expectedDuration: number;
  actualTimeSeconds: number;
  audioUrl?: string;
  speakerFilter?: string;  // Filter to specific speaker for multi-speaker transcripts
}): Promise<FeedbackV2Result> {
  // 1. Fetch transcript words (optionally filtered by speaker)
  const words = await fetchTranscriptWords(params.transcriptId, params.speakerFilter);

  if (words.length === 0) {
    throw new Error('No transcript words found');
  }

  // 2. Calculate speech duration
  const speechDurationMs = words[words.length - 1].end_ms;

  // 3. Create semantic chunks
  const chunks = createSemanticChunks(words, speechDurationMs);

  // 4. Format chunks for LLM
  const chunkedTranscript = formatChunksForLLM(chunks);

  // 5. Build prompt
  const actualTimeStr = `${Math.floor(params.actualTimeSeconds / 60).toString().padStart(2, '0')}:${(params.actualTimeSeconds % 60).toString().padStart(2, '0')}`;

  const prompt = buildV2Prompt({
    motion: params.motion,
    position: params.position,
    expectedDuration: params.expectedDuration,
    actualTime: actualTimeStr,
    chunkedTranscript
  });

  // 6. Call LLM
  const llmResponse = await callGeminiV2(prompt);

  // 7. Enrich playable moments with chunk metadata
  // IMPORTANT: If speaker filtering was used, chunks are relative to filtered words
  // We need to add the offset of the speaker's first word in the full audio
  const speakerOffset = words.length > 0 ? Math.floor(words[0].start_ms / 1000) : 0;

  const playableMoments: PlayableMoment[] = llmResponse.playable_moments.map(moment => {
    const chunk = chunks.find(c => c.chunk_id === moment.chunk_id);

    if (!chunk) {
      throw new Error(`Invalid chunk_id ${moment.chunk_id} cited by LLM`);
    }

    const metadata = chunkToPlayableMoment(chunk);

    return {
      chunk_id: moment.chunk_id,
      start_seconds: metadata.start_seconds + speakerOffset,
      end_seconds: metadata.end_seconds + speakerOffset,
      start_time: metadata.start_time,  // Keep relative time for display
      end_time: metadata.end_time,
      category: moment.category as any,
      severity: moment.severity as any,
      what_they_said: metadata.what_they_said,
      issue: moment.issue,
      recommendation: moment.recommendation
    };
  });

  // 8. Return complete result
  return {
    rubric_scores: llmResponse.rubric_scores,
    strategic_overview: llmResponse.strategic_overview,
    playable_moments: playableMoments,
    audio_metadata: {
      url: params.audioUrl,
      duration_seconds: Math.ceil(speechDurationMs / 1000)
    },
    chunks_metadata: {
      total_chunks: chunks.length,
      chunk_labels: chunks.map(c => c.label)
    }
  };
}
