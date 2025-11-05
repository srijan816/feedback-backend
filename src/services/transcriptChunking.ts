/**
 * Transcript Chunking Service
 * Converts word-level timestamps into semantic chunks for V2 feedback
 */

export interface TranscriptWord {
  id: number;
  word_index: number;
  text: string;
  start_ms: number;
  end_ms: number;
  confidence: number;
  speaker?: string;
}

export interface SemanticChunk {
  chunk_id: number;
  label: string;
  start_ms: number;
  end_ms: number;
  start_time: string;  // "00:00"
  end_time: string;    // "01:00"
  text: string;
  word_count: number;
}

/**
 * Convert milliseconds to MM:SS format
 */
function msToTimeString(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Group words into semantic chunks (60-90 second blocks)
 * Uses natural pause boundaries and time-based segmentation
 */
export function createSemanticChunks(words: TranscriptWord[], speechDurationMs: number): SemanticChunk[] {
  if (words.length === 0) {
    return [];
  }

  const chunks: SemanticChunk[] = [];
  const TARGET_CHUNK_DURATION_MS = 35000; // 35 seconds for precise timestamps
  const MIN_CHUNK_DURATION_MS = 25000;    // 25 seconds minimum
  const MAX_CHUNK_DURATION_MS = 50000;    // 50 seconds maximum

  let chunkStartIdx = 0;
  let currentChunkId = 0;

  while (chunkStartIdx < words.length) {
    const chunkStartMs = words[chunkStartIdx].start_ms;
    let chunkEndIdx = chunkStartIdx;

    // Find natural chunk boundary
    for (let i = chunkStartIdx + 1; i < words.length; i++) {
      const elapsedMs = words[i].end_ms - chunkStartMs;

      // If we've reached target duration, force break for precise timestamps
      if (elapsedMs >= TARGET_CHUNK_DURATION_MS) {
        chunkEndIdx = i;
        break;
      }

      // If we've exceeded max duration, force break
      if (elapsedMs >= MAX_CHUNK_DURATION_MS) {
        chunkEndIdx = i;
        break;
      }

      chunkEndIdx = i;
    }

    // If we're at the end, include all remaining words
    if (chunkEndIdx === chunkStartIdx || chunkEndIdx >= words.length - 1) {
      chunkEndIdx = words.length - 1;
    }

    // Create chunk
    const chunkWords = words.slice(chunkStartIdx, chunkEndIdx + 1);
    const chunkText = chunkWords.map(w => w.text).join(' ');
    const startMs = chunkWords[0].start_ms;
    const endMs = chunkWords[chunkWords.length - 1].end_ms;

    // Determine label based on position and duration
    let label = '';
    if (currentChunkId === 0) {
      label = 'Hook & Opening';
    } else if (startMs < 120000) { // First 2 minutes
      label = 'Model/Setup';
    } else {
      // Estimate argument number based on position
      const argNum = Math.floor((currentChunkId - 1) / 2) + 1;
      label = `Argument ${argNum}`;
    }

    chunks.push({
      chunk_id: currentChunkId,
      label,
      start_ms: startMs,
      end_ms: endMs,
      start_time: msToTimeString(startMs),
      end_time: msToTimeString(endMs),
      text: chunkText,
      word_count: chunkWords.length
    });

    currentChunkId++;
    chunkStartIdx = chunkEndIdx + 1;
  }

  return chunks;
}

/**
 * Format chunks for LLM input
 */
export function formatChunksForLLM(chunks: SemanticChunk[]): string {
  let formatted = '# TIMESTAMPED TRANSCRIPT (CHUNKED)\n\n';
  formatted += 'Below is the debate speech divided into CHUNKS with timestamps.\n';
  formatted += 'Each chunk represents a semantic section (~25-50 seconds for precise feedback).\n\n';
  formatted += '---\n\n';

  for (const chunk of chunks) {
    formatted += `[CHUNK_${chunk.chunk_id}] [${chunk.start_time} - ${chunk.end_time}] ${chunk.label}\n`;
    formatted += `"${chunk.text}"\n\n`;
  }

  formatted += '---\n\n';
  formatted += `Total chunks: ${chunks.length}\n`;
  formatted += `When citing feedback moments, reference CHUNK_ID (e.g., CHUNK_5)\n`;

  return formatted;
}

/**
 * Convert chunk_id to playable moment metadata
 */
export function chunkToPlayableMoment(chunk: SemanticChunk): {
  start_seconds: number;
  end_seconds: number;
  start_time: string;
  end_time: string;
  what_they_said: string;
} {
  return {
    start_seconds: Math.floor(chunk.start_ms / 1000),
    end_seconds: Math.ceil(chunk.end_ms / 1000),
    start_time: chunk.start_time,
    end_time: chunk.end_time,
    what_they_said: chunk.text.length > 200
      ? chunk.text.substring(0, 197) + '...'
      : chunk.text
  };
}
