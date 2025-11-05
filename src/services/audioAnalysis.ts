import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../utils/logger.js';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export interface AudioMetrics {
  duration: number; // seconds
  averageWPM?: number; // calculated after transcription
  peakVolume: number; // dB
  averageVolume: number; // dB
  volumeConsistency: number; // 0-1 scale (1 = very consistent)
  silencePauses: {
    totalPauses: number;
    averagePauseLength: number; // seconds
    longPauses: number; // pauses > 2 seconds
  };
  bitrate: number; // kbps
  sampleRate: number; // Hz
  channels: number;
}

/**
 * Extract audio metrics using ffmpeg
 */
export async function analyzeAudio(filePath: string): Promise<AudioMetrics> {
  try {
    logger.info('Starting audio analysis', { filePath });

    // Check if file exists
    await fs.access(filePath);

    // Get basic audio info
    const infoCommand = `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`;
    const { stdout: infoOutput } = await execAsync(infoCommand);
    const audioInfo = JSON.parse(infoOutput);

    const audioStream = audioInfo.streams.find((s: any) => s.codec_type === 'audio');
    if (!audioStream) {
      throw new Error('No audio stream found in file');
    }

    const duration = parseFloat(audioInfo.format.duration || '0');
    const bitrate = parseInt(audioInfo.format.bit_rate || '0') / 1000; // Convert to kbps
    const sampleRate = parseInt(audioStream.sample_rate || '0');
    const channels = parseInt(audioStream.channels || '0');

    // Extract volume statistics using volumedetect filter
    const volumeCommand = `ffmpeg -i "${filePath}" -af "volumedetect" -vn -sn -dn -f null /dev/null 2>&1 | grep -E "mean_volume|max_volume"`;
    const { stdout: volumeOutput } = await execAsync(volumeCommand);

    // Parse volume data
    const meanVolumeMatch = volumeOutput.match(/mean_volume:\s*([-\d.]+)\s*dB/);
    const maxVolumeMatch = volumeOutput.match(/max_volume:\s*([-\d.]+)\s*dB/);

    const averageVolume = meanVolumeMatch ? parseFloat(meanVolumeMatch[1]) : -30;
    const peakVolume = maxVolumeMatch ? parseFloat(maxVolumeMatch[1]) : -10;

    // Calculate volume consistency (inverse of dynamic range, normalized)
    const dynamicRange = Math.abs(peakVolume - averageVolume);
    const volumeConsistency = Math.max(0, Math.min(1, 1 - dynamicRange / 40));

    // Detect silences (pauses) - threshold -40dB, duration >0.3s
    const silenceCommand = `ffmpeg -i "${filePath}" -af "silencedetect=noise=-40dB:d=0.3" -f null - 2>&1 | grep -E "silence_(start|end)" | head -100`;

    let silenceOutput = '';
    try {
      const result = await execAsync(silenceCommand);
      silenceOutput = result.stdout;
    } catch (error) {
      // If no silences found, that's okay
      logger.debug('No significant pauses detected');
    }

    // Parse silence data
    const silenceStarts: number[] = [];
    const silenceEnds: number[] = [];

    const startMatches = silenceOutput.matchAll(/silence_start:\s*([\d.]+)/g);
    for (const match of startMatches) {
      silenceStarts.push(parseFloat(match[1]));
    }

    const endMatches = silenceOutput.matchAll(/silence_end:\s*([\d.]+)/g);
    for (const match of endMatches) {
      silenceEnds.push(parseFloat(match[1]));
    }

    // Calculate pause statistics
    const pauseDurations: number[] = [];
    const minLength = Math.min(silenceStarts.length, silenceEnds.length);

    for (let i = 0; i < minLength; i++) {
      const pauseLength = silenceEnds[i] - silenceStarts[i];
      if (pauseLength > 0) {
        pauseDurations.push(pauseLength);
      }
    }

    const totalPauses = pauseDurations.length;
    const averagePauseLength = totalPauses > 0
      ? pauseDurations.reduce((sum, len) => sum + len, 0) / totalPauses
      : 0;
    const longPauses = pauseDurations.filter(len => len > 2).length;

    const metrics: AudioMetrics = {
      duration,
      peakVolume,
      averageVolume,
      volumeConsistency,
      silencePauses: {
        totalPauses,
        averagePauseLength,
        longPauses,
      },
      bitrate,
      sampleRate,
      channels,
    };

    logger.info('Audio analysis complete', { metrics });
    return metrics;
  } catch (error) {
    logger.error('Audio analysis failed', { filePath, error });
    throw error;
  }
}

/**
 * Calculate words per minute after transcription is complete
 */
export function calculateWPM(wordCount: number, durationSeconds: number): number {
  if (durationSeconds === 0) return 0;
  return Math.round((wordCount / durationSeconds) * 60);
}

/**
 * Analyze speaking pace based on WPM
 */
export function analyzePace(wpm: number, studentLevel: 'primary' | 'secondary'): {
  rating: string;
  description: string;
} {
  const targets = {
    primary: { min: 130, max: 160, ideal: 145 },
    secondary: { min: 140, max: 170, ideal: 155 },
  };

  const target = targets[studentLevel];

  if (wpm < target.min) {
    return {
      rating: 'slow',
      description: `Speaking pace is slower than ideal (${wpm} WPM vs ${target.min}-${target.max} WPM target)`,
    };
  } else if (wpm > target.max) {
    return {
      rating: 'fast',
      description: `Speaking pace is faster than ideal (${wpm} WPM vs ${target.min}-${target.max} WPM target)`,
    };
  } else {
    return {
      rating: 'good',
      description: `Speaking pace is within ideal range (${wpm} WPM)`,
    };
  }
}

/**
 * Detect POI acceptance from speaker diarization
 * Looks for short interruptions from other speakers during the main speech
 */
export function detectPOI(
  mainSpeaker: string,
  segments: Array<{ speaker: string; start: number; end: number; text: string }>
): {
  poiDetected: boolean;
  poiCount: number;
  poiSegments: Array<{ speaker: string; timestamp: number; text: string }>;
} {
  const poiSegments: Array<{ speaker: string; timestamp: number; text: string }> = [];

  // Look for segments from other speakers that are short (likely POIs)
  // POIs are typically 10-30 seconds
  for (const segment of segments) {
    if (segment.speaker !== mainSpeaker) {
      const duration = segment.end - segment.start;
      if (duration >= 5 && duration <= 45) {
        // Likely a POI
        poiSegments.push({
          speaker: segment.speaker,
          timestamp: segment.start,
          text: segment.text,
        });
      }
    }
  }

  return {
    poiDetected: poiSegments.length > 0,
    poiCount: poiSegments.length,
    poiSegments,
  };
}

/**
 * Format audio metrics for prompt injection
 */
export function formatMetricsForPrompt(
  metrics: AudioMetrics,
  wordCount?: number
): string {
  const wpm = wordCount && metrics.duration > 0
    ? calculateWPM(wordCount, metrics.duration)
    : undefined;

  return `
Duration: ${metrics.duration.toFixed(1)}s
${wpm ? `Words per minute: ${wpm}` : ''}
Average volume: ${metrics.averageVolume.toFixed(1)} dB
Peak volume: ${metrics.peakVolume.toFixed(1)} dB
Volume consistency: ${(metrics.volumeConsistency * 100).toFixed(0)}%
Total pauses: ${metrics.silencePauses.totalPauses}
Average pause length: ${metrics.silencePauses.averagePauseLength.toFixed(2)}s
Long pauses (>2s): ${metrics.silencePauses.longPauses}
  `.trim();
}
