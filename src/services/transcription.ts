import axios from 'axios';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import config from '../config/index.js';
import logger from '../utils/logger.js';

const execAsync = promisify(exec);

const ASSEMBLYAI_BASE_URL = 'https://api.assemblyai.com/v2';

interface AssemblyAIUploadResponse {
  upload_url: string;
}

interface AssemblyAITranscriptResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  text?: string;
  words?: Array<{
    text: string;
    start: number; // milliseconds
    end: number; // milliseconds
    confidence: number;
    speaker?: string;
  }>;
  utterances?: Array<{
    confidence: number;
    end: number; // milliseconds
    speaker: string;
    start: number; // milliseconds
    text: string;
    words: Array<{
      text: string;
      start: number;
      end: number;
      confidence: number;
      speaker: string;
    }>;
  }>;
  error?: string;
}

export interface TranscriptionWord {
  text: string;
  start_ms: number;
  end_ms: number;
  confidence: number;
  speaker?: string;
}

export interface TranscriptionUtterance {
  confidence: number;
  end_ms: number;
  speaker: string;
  start_ms: number;
  text: string;
  words: TranscriptionWord[];
}

export interface TranscriptionResult {
  transcript_text: string;
  word_count: number;
  speaking_rate: number; // words per minute
  words: TranscriptionWord[];
  utterances?: TranscriptionUtterance[]; // Speaker diarization data
  processing_time_ms: number;
  api_provider: string;
  api_model: string;
}

/**
 * Normalize audio volume using ffmpeg
 * This helps transcribe quiet audio files from iOS
 */
async function normalizeAudioVolume(inputPath: string): Promise<string> {
  try {
    // Create normalized file path
    const ext = path.extname(inputPath);
    const normalizedPath = inputPath.replace(ext, `_normalized${ext}`);

    // Use ffmpeg loudnorm filter for intelligent audio normalization
    // Target: -16 LUFS (standard for speech), max true peak -1.5dB
    const command = `ffmpeg -i "${inputPath}" -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 44100 -ac 1 -b:a 128k "${normalizedPath}" -y`;

    logger.info('Normalizing audio volume', {
      input: inputPath,
      output: normalizedPath,
    });

    await execAsync(command);

    logger.info('Audio normalization completed', {
      normalized: normalizedPath,
    });

    return normalizedPath;
  } catch (error) {
    logger.warn('Audio normalization failed, using original file', { error });
    // If normalization fails, return original file
    return inputPath;
  }
}

/**
 * Upload audio file to AssemblyAI
 */
async function uploadAudioFile(filePath: string): Promise<string> {
  try {
    const audioData = await fs.readFile(filePath);

    const response = await axios.post<AssemblyAIUploadResponse>(
      `${ASSEMBLYAI_BASE_URL}/upload`,
      audioData,
      {
        headers: {
          authorization: config.apis.assemblyai.apiKey,
          'content-type': 'application/octet-stream',
        },
      }
    );

    logger.info('Audio file uploaded to AssemblyAI', {
      upload_url: response.data.upload_url,
    });

    return response.data.upload_url;
  } catch (error) {
    logger.error('Failed to upload audio to AssemblyAI', error);
    throw new Error(`Audio upload failed: ${error}`);
  }
}

/**
 * Create transcription job with Slam-1 model
 */
async function createTranscriptionJob(
  audioUrl: string,
  options?: {
    keyterms?: string[];
    enableDiarization?: boolean;
    speakerCount?: number;
    minSpeakers?: number;
    maxSpeakers?: number;
    webhookUrl?: string; // NEW: Optional webhook URL for completion callback
  }
): Promise<string> {
  try {
    const requestData: any = {
      audio_url: audioUrl,
      speech_model: 'slam-1', // Use Slam-1 model
    };

    // Add webhook URL if provided (50-80% faster than polling)
    if (options?.webhookUrl) {
      requestData.webhook_url = options.webhookUrl;
      logger.info('Transcription job will use webhook', {
        webhook_url: options.webhookUrl,
      });
    }

    // Add keyterms prompt for better accuracy
    if (options?.keyterms && options.keyterms.length > 0) {
      requestData.keyterms_prompt = options.keyterms;
    }

    // Enable speaker diarization
    if (options?.enableDiarization) {
      requestData.speaker_labels = true;

      // Enable Speaker Identification to extract actual names from context
      requestData.speech_understanding = {
        request: {
          speaker_identification: {
            speaker_type: 'name',  // Extract actual names like "Shruti"
            known_values: []  // Auto-discover names from introductions
          }
        }
      };

      // Set exact number of speakers if known
      if (options.speakerCount) {
        requestData.speakers_expected = options.speakerCount;
      }

      // Set speaker range if provided
      if (options.minSpeakers || options.maxSpeakers) {
        requestData.speaker_options = {
          min_speakers_expected: options.minSpeakers || 1,
          max_speakers_expected: options.maxSpeakers || 10,
        };
      }
    }

    const response = await axios.post<AssemblyAITranscriptResponse>(
      `${ASSEMBLYAI_BASE_URL}/transcript`,
      requestData,
      {
        headers: {
          authorization: config.apis.assemblyai.apiKey,
          'content-type': 'application/json',
        },
      }
    );

    logger.info('Transcription job created', {
      transcript_id: response.data.id,
      status: response.data.status,
      uses_webhook: !!options?.webhookUrl,
    });

    return response.data.id;
  } catch (error) {
    logger.error('Failed to create transcription job', error);
    throw new Error(`Transcription job creation failed: ${error}`);
  }
}

/**
 * Poll for transcription completion
 */
async function pollTranscriptionStatus(
  transcriptId: string,
  maxAttempts: number = 60,
  intervalMs: number = 3000
): Promise<AssemblyAITranscriptResponse> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await axios.get<AssemblyAITranscriptResponse>(
        `${ASSEMBLYAI_BASE_URL}/transcript/${transcriptId}`,
        {
          headers: {
            authorization: config.apis.assemblyai.apiKey,
          },
        }
      );

      const { status } = response.data;

      if (status === 'completed') {
        logger.info('Transcription completed', {
          transcript_id: transcriptId,
          attempts,
        });
        return response.data;
      } else if (status === 'error') {
        throw new Error(
          `Transcription failed: ${response.data.error || 'Unknown error'}`
        );
      }

      // Still processing, wait and retry
      logger.debug('Transcription in progress', {
        transcript_id: transcriptId,
        status,
        attempt: attempts + 1,
      });

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      attempts++;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status !== 500) {
        throw error;
      }
      // Retry on 500 errors
      logger.warn('Retrying transcription status check', {
        attempt: attempts + 1,
      });
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      attempts++;
    }
  }

  throw new Error(`Transcription polling timeout after ${maxAttempts} attempts`);
}

/**
 * Main function to transcribe audio file
 */
export async function transcribeAudio(
  audioFilePath: string,
  options?: {
    duration_seconds?: number;
    keyterms?: string[];
    enableDiarization?: boolean;
    speakerCount?: number;
    minSpeakers?: number;
    maxSpeakers?: number;
    useWebhook?: boolean; // NEW: Enable webhook mode (default: false for backward compatibility)
  }
): Promise<TranscriptionResult> {
  const startTime = Date.now();
  let normalizedPath = audioFilePath; // Initialize with original path

  try {
    logger.info('Starting transcription', {
      audioFilePath,
      diarizationEnabled: options?.enableDiarization,
      useWebhook: options?.useWebhook || false,
    });

    // Step 0: Normalize audio volume (fixes quiet iOS recordings)
    normalizedPath = await normalizeAudioVolume(audioFilePath);

    // Step 1: Upload audio file
    const uploadUrl = await uploadAudioFile(normalizedPath);

    // Step 2: Create transcription job with Slam-1
    // Webhook URL: Set WEBHOOK_BASE_URL in environment (e.g., https://yourdomain.com)
    const webhookUrl = options?.useWebhook && config.server.webhookBaseUrl
      ? `${config.server.webhookBaseUrl}/webhooks/assemblyai`
      : undefined;

    const transcriptId = await createTranscriptionJob(uploadUrl, {
      keyterms: options?.keyterms,
      enableDiarization: options?.enableDiarization,
      speakerCount: options?.speakerCount,
      minSpeakers: options?.minSpeakers,
      maxSpeakers: options?.maxSpeakers,
      webhookUrl,
    });

    // Step 3: Poll for completion (fallback if webhook not configured)
    const result = await pollTranscriptionStatus(transcriptId);

    if (!result.text || !result.words) {
      throw new Error('Transcription completed but missing text or words');
    }

    // Step 4: Process results
    const words: TranscriptionWord[] = result.words.map((word) => ({
      text: word.text,
      start_ms: word.start,
      end_ms: word.end,
      confidence: word.confidence,
      speaker: word.speaker,
    }));

    const wordCount = result.words.length;

    // Calculate speaking rate (words per minute)
    const durationMs = result.words[result.words.length - 1]?.end || options?.duration_seconds! * 1000;
    const durationMinutes = durationMs / 60000;
    const speakingRate = wordCount / durationMinutes;

    const processingTime = Date.now() - startTime;

    // Process utterances if diarization was enabled
    let utterances: TranscriptionUtterance[] | undefined;
    if (result.utterances) {
      utterances = result.utterances.map(utt => ({
        confidence: utt.confidence,
        end_ms: utt.end,
        speaker: utt.speaker,
        start_ms: utt.start,
        text: utt.text,
        words: utt.words.map(w => ({
          text: w.text,
          start_ms: w.start,
          end_ms: w.end,
          confidence: w.confidence,
          speaker: w.speaker,
        })),
      }));

      logger.info('Speaker diarization completed', {
        utteranceCount: utterances.length,
        speakers: [...new Set(utterances.map(u => u.speaker))],
      });
    }

    logger.info('Transcription successful', {
      word_count: wordCount,
      speaking_rate: speakingRate.toFixed(2),
      processing_time_ms: processingTime,
      has_diarization: !!utterances,
    });

    // Cleanup: Delete normalized file if it was created
    if (normalizedPath !== audioFilePath) {
      try {
        await fs.unlink(normalizedPath);
        logger.debug('Normalized audio file deleted', { path: normalizedPath });
      } catch (cleanupError) {
        logger.warn('Failed to delete normalized file', { path: normalizedPath });
      }
    }

    return {
      transcript_text: result.text,
      word_count: wordCount,
      speaking_rate: parseFloat(speakingRate.toFixed(2)),
      words,
      utterances,
      processing_time_ms: processingTime,
      api_provider: 'assemblyai',
      api_model: 'slam-1',
    };
  } catch (error) {
    // Cleanup: Delete normalized file if it was created
    if (normalizedPath && normalizedPath !== audioFilePath) {
      try {
        await fs.unlink(normalizedPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }

    logger.error('Transcription failed', { error, audioFilePath });
    throw error;
  }
}

/**
 * Get debate-specific key terms for better transcription accuracy
 */
export function getDebateKeyTerms(studentLevel: string): string[] {
  const commonTerms = [
    'debate',
    'argument',
    'rebuttal',
    'proposition',
    'opposition',
    'impact',
    'weighing',
    'framework',
    'contention',
    'point of information',
    'clash',
    'burden of proof',
  ];

  if (studentLevel === 'primary') {
    return [
      ...commonTerms,
      'claim',
      'evidence',
      'example',
      'reason',
      'because',
      'therefore',
    ];
  } else {
    return [
      ...commonTerms,
      'status quo',
      'comparative advantage',
      'cost-benefit analysis',
      'causation',
      'correlation',
      'empirical evidence',
      'stakeholder',
      'implementation',
    ];
  }
}

/**
 * Fetch completed transcription results from AssemblyAI
 */
export async function fetchTranscriptionResult(
  transcriptId: string
): Promise<AssemblyAITranscriptResponse> {
  try {
    const response = await axios.get<AssemblyAITranscriptResponse>(
      `${ASSEMBLYAI_BASE_URL}/transcript/${transcriptId}`,
      {
        headers: {
          authorization: config.apis.assemblyai.apiKey,
        },
      }
    );

    return response.data;
  } catch (error) {
    logger.error('Failed to fetch transcription result', {
      error,
      transcript_id: transcriptId,
    });
    throw new Error(`Failed to fetch transcription: ${error}`);
  }
}

/**
 * Handle AssemblyAI webhook callback
 *
 * This is called when AssemblyAI completes a transcription job.
 * It's exported and used by the webhook route.
 */
export async function handleAssemblyAIWebhook(
  transcriptId: string,
  status: string
): Promise<void> {
  logger.info('Handling AssemblyAI webhook', { transcriptId, status });

  if (status === 'completed' || status === 'error') {
    // Fetch the full transcription result
    const result = await fetchTranscriptionResult(transcriptId);

    // TODO: The webhook needs to know which speech_id this belongs to
    // We'll need to store a mapping in Redis: transcript_id -> speech_id
    // For now, this is a placeholder. The actual implementation would:
    // 1. Look up speech_id from Redis using transcript_id as key
    // 2. Continue the transcription worker job processing
    // 3. Store results in database and queue feedback job

    logger.info('AssemblyAI webhook processed', {
      transcriptId,
      status: result.status,
      has_text: !!result.text,
    });
  }
}
