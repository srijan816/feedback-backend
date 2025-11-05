#!/usr/bin/env python3
"""
Enrich V2 feedback with chunk metadata (timestamps, quotes)
"""

import json
import psycopg2

# Load the raw feedback
with open('test_data/feedback_v2_pharma_result.json') as f:
    feedback = json.load(f)

# Load input
with open('test_data/feedback_v2_pharma_input.json') as f:
    input_data = json.load(f)

# Get transcript words for Speaker B
conn = psycopg2.connect(
    host="/var/run/postgresql",
    port=5433,
    database="debate_feedback",
    user="ubuntu"
)

cur = conn.cursor()
# Get ONLY the PM speech using the time range from input
start_ms = input_data.get('start_ms', 0)
end_ms = input_data.get('end_ms', 999999999)

cur.execute("""
    SELECT word_index, text, start_ms, end_ms, speaker
    FROM transcript_words
    WHERE transcript_id = %s
      AND speaker = %s
      AND start_ms >= %s
      AND end_ms <= %s
    ORDER BY word_index ASC
""", (input_data['transcript_id'], input_data['speaker_filter'], start_ms, end_ms))

words = cur.fetchall()
cur.close()
conn.close()

# Build word objects
word_objects = [{
    'word_index': w[0],
    'text': w[1],
    'start_ms': w[2],
    'end_ms': w[3],
    'speaker': w[4]
} for w in words]

# Calculate speaker offset (first word start time)
speaker_offset_ms = word_objects[0]['start_ms']
speaker_offset_sec = speaker_offset_ms / 1000

print(f'Speaker {input_data["speaker_filter"]} offset: {speaker_offset_sec:.1f} seconds')

# Load chunks that were sent to Gemini (created by TypeScript chunker)
with open('test_data/chunks_used_for_gemini.json') as f:
    chunks = json.load(f)

# Convert chunks to have absolute timestamps (they currently have relative timestamps from 0)
for chunk in chunks:
    chunk['start_ms_absolute'] = chunk['start_ms'] + speaker_offset_ms
    chunk['end_ms_absolute'] = chunk['end_ms'] + speaker_offset_ms

print(f'Created {len(chunks)} chunks')

# Enrich each playable moment
enriched_moments = []

for moment in feedback['playable_moments']:
    chunk_id = moment['chunk_id']

    # Find the chunk
    chunk = next((c for c in chunks if c['chunk_id'] == chunk_id), None)

    if not chunk:
        print(f'Warning: Chunk {chunk_id} not found, skipping')
        continue

    # Extract quote from chunk text (first 200 characters)
    quote = chunk['text'][:200] + ('...' if len(chunk['text']) > 200 else '')

    # Calculate absolute timestamps (with speaker offset)
    start_seconds = int(chunk['start_ms_absolute'] / 1000)
    end_seconds = int(chunk['end_ms_absolute'] / 1000)

    # Format times for display (MM:SS)
    def format_time(seconds):
        mins = seconds // 60
        secs = seconds % 60
        return f'{mins:02d}:{secs:02d}'

    # Times relative to speaker's portion (chunk already has relative times)
    rel_start = int(chunk['start_ms'] / 1000)
    rel_end = int(chunk['end_ms'] / 1000)

    enriched_moment = {
        'chunk_id': chunk_id,
        'start_seconds': start_seconds,  # Already absolute (with offset)
        'end_seconds': end_seconds,  # Already absolute (with offset)
        'start_time': format_time(rel_start),  # Relative time for display
        'end_time': format_time(rel_end),
        'category': moment['category'],
        'severity': moment['severity'],
        'what_they_said': quote,
        'issue': moment['issue'],
        'recommendation': moment['recommendation']
    }

    enriched_moments.append(enriched_moment)

# Update feedback with enriched moments
feedback['playable_moments'] = enriched_moments

# Add audio metadata
feedback['audio_metadata'] = {
    'url': input_data['audio_url'],
    'duration_seconds': int(word_objects[-1]['end_ms'] / 1000) if word_objects else 0
}

# Add chunks metadata
feedback['chunks_metadata'] = {
    'total_chunks': len(chunks),
    'chunk_labels': [f'Chunk {c["chunk_id"]}' for c in chunks]
}

# Save enriched feedback
with open('test_data/feedback_v2_pharma_result.json', 'w') as f:
    json.dump(feedback, f, indent=2)

print(f'\n✅ Enriched {len(enriched_moments)} playable moments')
print(f'✓ Saved to: test_data/feedback_v2_pharma_result.json')

# Display summary
print(f'\nPlayable moments with absolute timestamps:')
for i, m in enumerate(enriched_moments, 1):
    print(f'  {i}. [{m["start_time"]}] Absolute: {m["start_seconds"]}s - {m["severity"]} - {m["category"]}')
