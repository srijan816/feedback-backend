#!/usr/bin/env python3
"""
Store the already-transcribed 33MB audio transcript in database
"""

import json
import psycopg2

SPEECH_ID = 2

def main():
    # Load the transcript data
    with open("test_data/33mb_transcript_raw.json") as f:
        transcript_result = json.load(f)

    print("📊 Transcript Summary:")
    words = transcript_result.get("words", [])
    print(f"  Total words: {len(words)}")
    print(f"  Duration: {transcript_result.get('audio_duration')} seconds")
    print()

    # Connect to database
    conn = psycopg2.connect(
        host="/var/run/postgresql",
        port=5433,
        database="debate_feedback",
        user="ubuntu"
    )

    cur = conn.cursor()

    # Create transcript record
    full_text = transcript_result.get("text", "")

    cur.execute("""
        INSERT INTO transcripts (speech_id, transcript_text, created_at)
        VALUES (%s, %s, NOW())
        RETURNING id
    """, (SPEECH_ID, full_text))

    transcript_id = cur.fetchone()[0]
    print(f"✓ Created transcript record: {transcript_id}")

    # Store words with speaker labels
    print(f"  Storing {len(words)} words...")

    for idx, word in enumerate(words):
        if idx % 1000 == 0:
            print(f"    Progress: {idx}/{len(words)}")

        cur.execute("""
            INSERT INTO transcript_words
            (transcript_id, word_index, text, start_ms, end_ms, confidence, speaker)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            transcript_id,
            idx,
            word["text"],
            word["start"],
            word["end"],
            word["confidence"],
            word.get("speaker")
        ))

    conn.commit()
    cur.close()
    conn.close()

    print(f"\n✅ Stored {len(words)} words in database")
    print(f"Transcript ID: {transcript_id}")

if __name__ == "__main__":
    main()
