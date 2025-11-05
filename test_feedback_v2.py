#!/usr/bin/env python3
"""
Test Feedback V2 Generation with Playable Moments
Tests the new timestamped feedback system
"""

import os
import json
import psycopg2
from pathlib import Path

# Database connection
def get_db_connection():
    return psycopg2.connect(
        dbname="debate_feedback",
        user="ubuntu",
        host="/var/run/postgresql",
        port="5433"
    )

# For this test, we'll need to:
# 1. Find or create a transcript with word-level timestamps
# 2. Parse the test speech file we created earlier
# 3. If needed, populate transcript_words table

def check_transcript_words(transcript_id):
    """Check if we have word-level data for this transcript"""
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT COUNT(*), MIN(start_ms), MAX(end_ms)
        FROM transcript_words
        WHERE transcript_id = %s
    """, (transcript_id,))

    result = cur.fetchone()
    cur.close()
    conn.close()

    return result

def main():
    print("=" * 80)
    print("TESTING FEEDBACK V2 - WITH PLAYABLE MOMENTS")
    print("=" * 80)
    print()

    # Check if we have word-level data
    print("Checking for transcript_words data...")
    conn = get_db_connection()
    cur = conn.cursor()

    # Find any transcript with word-level data
    cur.execute("""
        SELECT DISTINCT tw.transcript_id, t.speech_id, COUNT(tw.id) as word_count
        FROM transcript_words tw
        JOIN transcripts t ON tw.transcript_id = t.id
        GROUP BY tw.transcript_id, t.speech_id
        ORDER BY word_count DESC
        LIMIT 1
    """)

    result = cur.fetchone()

    if result:
        transcript_id, speech_id, word_count = result
        print(f"✓ Found transcript with word-level data:")
        print(f"  Transcript ID: {transcript_id}")
        print(f"  Speech ID: {speech_id}")
        print(f"  Word Count: {word_count}")
        print()

        # Get speech details
        cur.execute("""
            SELECT s.speaker_name, s.position, s.audio_file_path,
                   d.motion, s.duration_seconds
            FROM speeches s
            JOIN debates d ON s.debate_id = d.id
            WHERE s.id = %s
        """, (speech_id,))

        speech_data = cur.fetchone()

        if speech_data:
            speaker_name, position, audio_path, motion, duration = speech_data
            print(f"Speech Details:")
            print(f"  Speaker: {speaker_name or 'Unknown'}")
            print(f"  Position: {position}")
            print(f"  Motion: {motion}")
            print(f"  Duration: {duration}s")
            print(f"  Audio: {audio_path}")
            print()

            # Save metadata for TypeScript service to use
            metadata = {
                "transcript_id": transcript_id,
                "speech_id": speech_id,
                "motion": motion,
                "position": position,
                "expected_duration": 8,  # WSDC standard
                "actual_time_seconds": duration or 487,  # ~8:07
                "audio_url": f"/{audio_path}" if audio_path else None
            }

            output_path = Path("test_data/feedback_v2_input.json")
            output_path.parent.mkdir(exist_ok=True)

            with open(output_path, 'w') as f:
                json.dump(metadata, f, indent=2)

            print(f"✓ Saved test metadata to: {output_path}")
            print()
            print("Next step: Run TypeScript service to generate V2 feedback")
            print("  npm run test:feedbackv2")
        else:
            print("❌ Speech data not found")
    else:
        print("❌ No transcripts with word-level data found")
        print()
        print("Note: You may need to transcribe Gabby's speech with AssemblyAI")
        print("      to get word-level timestamps with speaker_labels=true")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
