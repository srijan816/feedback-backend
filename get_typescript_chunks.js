/**
 * Get the exact same chunks that were used for Gemini analysis
 */

import fs from 'fs';
import pool from './dist/config/database.js';
import { createSemanticChunks, formatChunksForLLM } from './dist/services/transcriptChunking.js';

const input = JSON.parse(fs.readFileSync('test_data/feedback_v2_pharma_input.json', 'utf-8'));

// Fetch transcript words using the time range from input
const startMs = input.start_ms || 0;
const endMs = input.end_ms || 999999999;

const result = await pool.query(
  `SELECT id, word_index, text, start_ms, end_ms, confidence, speaker
   FROM transcript_words
   WHERE transcript_id = $1
     AND speaker = $2
     AND start_ms >= $3
     AND end_ms <= $4
   ORDER BY word_index ASC`,
  [input.transcript_id, input.speaker_filter, startMs, endMs]
);

let words = result.rows;
console.log(`Fetched ${words.length} words for Speaker ${input.speaker_filter}`);

// Normalize timestamps to start at 0 (same as Python script does)
if (words.length > 0) {
  const offsetMs = words[0].start_ms;
  words = words.map(w => ({
    ...w,
    start_ms: w.start_ms - offsetMs,
    end_ms: w.end_ms - offsetMs
  }));
  console.log(`Normalized timestamps (offset: ${offsetMs}ms = ${(offsetMs/60000).toFixed(1)}min)`);
}

// Calculate speech duration (now relative)
const speechDurationMs = words.length > 0 ? words[words.length - 1].end_ms : 0;

// Create the EXACT same chunks that were used for Gemini
const chunks = createSemanticChunks(words, speechDurationMs);

console.log(`Created ${chunks.length} semantic chunks`);

// Save chunks with their text
const chunksData = chunks.map(chunk => ({
  chunk_id: chunk.chunk_id,
  label: chunk.label,
  start_ms: chunk.start_ms,
  end_ms: chunk.end_ms,
  start_time: chunk.start_time,
  end_time: chunk.end_time,
  text: chunk.text,
  word_count: chunk.word_count
}));

fs.writeFileSync('test_data/chunks_used_for_gemini.json', JSON.stringify(chunksData, null, 2));

console.log('✓ Saved chunks to: test_data/chunks_used_for_gemini.json');

// Also show first few chunks
console.log('\nFirst 3 chunks:');
chunksData.slice(0, 3).forEach(c => {
  console.log(`\nChunk ${c.chunk_id}: ${c.label}`);
  console.log(`  Time: ${c.start_time} - ${c.end_time}`);
  console.log(`  Text: ${c.text.substring(0, 100)}...`);
});

await pool.end();
