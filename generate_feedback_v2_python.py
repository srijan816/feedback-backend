#!/usr/bin/env python3
"""
Generate V2 Feedback using Python SDK with thinking_config
"""

import os
import json
import psycopg2
from google import genai
from google.genai import types

GEMINI_API_KEY = "AIzaSyDwdU2z6Dld3hLy8oEvEBy3Lx8-Mxg4y2s"

def generate_feedback():
    # Load input
    with open('test_data/feedback_v2_pharma_input.json') as f:
        input_data = json.load(f)

    # Load prompt template
    with open('prompts/FEEDBACK_V2_WITH_TIMESTAMPS.md') as f:
        prompt_template = f.read()

    # Get transcript words from database for Speaker F
    conn = psycopg2.connect(
        host="/var/run/postgresql",
        port=5433,
        database="debate_feedback",
        user="ubuntu"
    )

    cur = conn.cursor()
    # Get ONLY the continuous PM speech using the time range from input
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

    print(f"📊 Loaded {len(words)} words for Speaker {input_data['speaker_filter']}")

    # Build chunked transcript (simplified - just text for now)
    # We'll use the TypeScript chunking service output instead
    # For now, let me read from the existing generated feedback to get the chunked format

    # Actually, let's call the Node.js chunking service
    import subprocess
    import tempfile

    # Create a simple Node script to generate chunks
    # Calculate relative duration (NOT absolute timestamp!)
    # Normalize timestamps to start at 0
    if words:
        offset_ms = words[0][2]  # First word's start time
        speech_duration_ms = words[-1][3] - words[0][2]  # Relative duration

        normalized_words = [{
            'word_index': w[0],
            'text': w[1],
            'start_ms': w[2] - offset_ms,  # Normalize to 0
            'end_ms': w[3] - offset_ms,
            'speaker': w[4]
        } for w in words]
    else:
        offset_ms = 0
        speech_duration_ms = 0
        normalized_words = []

    node_script = """
    const { createSemanticChunks, formatChunksForLLM } = require('./dist/services/transcriptChunking.js');
    const fs = require('fs');

    const words = %s;
    const speechDuration = %d;

    const chunks = createSemanticChunks(words, speechDuration);
    const formatted = formatChunksForLLM(chunks);

    // Save chunks for enrichment
    fs.writeFileSync('test_data/chunks_used_for_gemini.json', JSON.stringify(chunks, null, 2));

    console.log(formatted);
    """ % (json.dumps(normalized_words), speech_duration_ms)

    # Save script in project directory with .cjs extension for CommonJS
    script_path = 'temp_chunk_script.cjs'
    with open(script_path, 'w') as f:
        f.write(node_script)

    result = subprocess.run(['node', script_path], capture_output=True, text=True)

    if result.returncode != 0:
        print(f"❌ Chunking failed: {result.stderr}")
        os.unlink(script_path)
        sys.exit(1)

    chunked_transcript = result.stdout

    os.unlink(script_path)

    # Build complete prompt
    motion_type = 'policy' if 'would' in input_data['motion'].lower() else 'principle'

    prompt = prompt_template
    prompt = prompt.replace('{{MOTION}}', input_data['motion'])
    prompt = prompt.replace('{{MOTION_TYPE}}', motion_type)
    prompt = prompt.replace('{{POSITION}}', input_data['position'])
    prompt = prompt.replace('{{EXPECTED_DURATION}}', str(input_data['expected_duration']))
    actual_time_str = f"{int(input_data['actual_time_seconds'] / 60):02d}:{input_data['actual_time_seconds'] % 60:02d}"
    prompt = prompt.replace('{{ACTUAL_TIME}}', actual_time_str)
    prompt = prompt.replace('{{CHUNKED_TRANSCRIPT}}', chunked_transcript)

    print("\n🤖 Calling Gemini Flash with thinking...")

    # Initialize client
    client = genai.Client(api_key=GEMINI_API_KEY)

    contents = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=prompt)],
        ),
    ]

    generate_content_config = types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(
            thinking_budget=24576,
        ),
        response_mime_type="application/json",
    )

    # Generate - using gemini-flash-latest as specified
    full_response = ""
    for chunk in client.models.generate_content_stream(
        model="gemini-flash-latest",
        contents=contents,
        config=generate_content_config,
    ):
        if chunk.text:
            full_response += chunk.text
            print(".", end="", flush=True)

    print("\n\n✓ Generation complete!")

    # Save raw response for debugging
    with open('test_data/feedback_v2_raw_response.txt', 'w') as f:
        f.write(full_response)

    # Parse JSON response
    try:
        feedback = json.loads(full_response)
    except json.JSONDecodeError as e:
        print(f"\n❌ JSON parsing error: {e}")
        print(f"Raw response saved to: test_data/feedback_v2_raw_response.txt")
        print(f"\nFirst 500 chars of response:")
        print(full_response[:500])
        raise

    # Add metadata about the speech offset for enrichment
    feedback['_metadata'] = {
        'speaker': input_data['speaker_filter'],
        'offset_ms': offset_ms,  # Offset to convert relative to absolute timestamps
        'start_ms_absolute': words[0][2] if words else 0,
        'end_ms_absolute': words[-1][3] if words else 0
    }

    # Save result
    with open('test_data/feedback_v2_pharma_result.json', 'w') as f:
        json.dump(feedback, f, indent=2)

    print(f"✓ Saved to test_data/feedback_v2_pharma_result.json")
    print(f"   Speaker offset: {offset_ms}ms ({offset_ms/60000:.1f} min)")

    # Display summary
    print(f"\n📊 Rubric Scores: {feedback['rubric_scores']['average_score']:.1f}/5")
    print(f"🎧 Playable Moments: {len(feedback['playable_moments'])}")

if __name__ == "__main__":
    generate_feedback()
