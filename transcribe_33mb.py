#!/usr/bin/env python3
"""
Transcribe 33MB audio file with AssemblyAI
- Word-level timestamps
- Speaker diarization with slam-1 model
"""

import os
import sys
import json
import time
import requests
from pathlib import Path

ASSEMBLYAI_API_KEY = "c1ed5b0fcb9b432cbd673cb7b7dc61a8"
AUDIO_FILE = "storage/uploads/9afc6a87-d28c-4ef2-9f78-9eb6a555e7d3.mp3"
SPEECH_ID = 2

def upload_file(file_path):
    """Upload audio file to AssemblyAI"""
    print(f"📤 Uploading {file_path}...")

    headers = {"authorization": ASSEMBLYAI_API_KEY}

    with open(file_path, "rb") as f:
        response = requests.post(
            "https://api.assemblyai.com/v2/upload",
            headers=headers,
            data=f
        )

    if response.status_code != 200:
        print(f"❌ Upload failed: {response.text}")
        sys.exit(1)

    upload_url = response.json()["upload_url"]
    print(f"✓ Uploaded: {upload_url}")
    return upload_url

def start_transcription(audio_url):
    """Start transcription with word-level timestamps and speaker diarization"""
    print("🎙️  Starting transcription...")

    headers = {
        "authorization": ASSEMBLYAI_API_KEY,
        "content-type": "application/json"
    }

    data = {
        "audio_url": audio_url,
        "speaker_labels": True,  # Enable speaker diarization (generic labels)
        "speech_model": "slam-1",  # Use slam-1 for better speaker diarization
        "language_code": "en",
        # Enable Speaker Identification to extract actual names from context
        "speech_understanding": {
            "request": {
                "speaker_identification": {
                    "speaker_type": "name",  # Extract actual names like "Shruti"
                    "known_values": []  # Auto-discover names from introductions
                }
            }
        }
    }

    response = requests.post(
        "https://api.assemblyai.com/v2/transcript",
        headers=headers,
        json=data
    )

    if response.status_code != 200:
        print(f"❌ Transcription request failed: {response.text}")
        sys.exit(1)

    transcript_id = response.json()["id"]
    print(f"✓ Transcription started: {transcript_id}")
    return transcript_id

def poll_transcription(transcript_id):
    """Poll for transcription completion"""
    print("⏳ Waiting for transcription to complete...")

    headers = {"authorization": ASSEMBLYAI_API_KEY}
    url = f"https://api.assemblyai.com/v2/transcript/{transcript_id}"

    while True:
        response = requests.get(url, headers=headers)
        result = response.json()

        status = result["status"]

        if status == "completed":
            print("✓ Transcription completed!")
            return result
        elif status == "error":
            print(f"❌ Transcription failed: {result.get('error')}")
            sys.exit(1)
        else:
            print(f"  Status: {status}... (checking again in 10s)")
            time.sleep(10)

def save_transcript_data(transcript_result):
    """Save transcript to JSON file for inspection"""
    output_file = "test_data/33mb_transcript_raw.json"

    os.makedirs("test_data", exist_ok=True)

    with open(output_file, "w") as f:
        json.dump(transcript_result, f, indent=2)

    print(f"✓ Raw transcript saved to: {output_file}")

    # Print summary
    words = transcript_result.get("words", [])
    utterances = transcript_result.get("utterances", [])

    print(f"\n📊 Summary:")
    print(f"  Total words: {len(words)}")
    print(f"  Total utterances: {len(utterances)}")
    print(f"  Duration: {transcript_result.get('audio_duration', 0)} seconds")

    if utterances:
        speakers = set(u["speaker"] for u in utterances)
        print(f"  Speakers detected: {len(speakers)} ({', '.join(speakers)})")

    return transcript_result

def store_in_database(transcript_result):
    """Store transcript words in PostgreSQL database"""
    import psycopg2

    print("\n💾 Storing transcript in database...")

    conn = psycopg2.connect(
        host="/var/run/postgresql",
        port=5433,
        database="debate_feedback",
        user="ubuntu"
    )

    cur = conn.cursor()

    # Create transcript record
    cur.execute("""
        INSERT INTO transcripts (speech_id, transcript_text, word_count, created_at)
        VALUES (%s, %s, %s, NOW())
        RETURNING id
    """, (SPEECH_ID, transcript_result.get('text', ''), len(transcript_result.get('words', []))))

    transcript_id = cur.fetchone()[0]
    print(f"✓ Created transcript record: {transcript_id}")

    # Store words with speaker labels
    words = transcript_result.get("words", [])

    print(f"  Storing {len(words)} words...")

    for idx, word in enumerate(words):
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
            word.get("speaker")  # May be None if speaker diarization failed
        ))

    conn.commit()
    cur.close()
    conn.close()

    print(f"✓ Stored {len(words)} words in database")
    print(f"\nTranscript ID: {transcript_id}")

    return transcript_id

def main():
    print("=" * 80)
    print("ASSEMBLYAI TRANSCRIPTION - 33MB AUDIO FILE")
    print("=" * 80)
    print()

    # 1. Upload file
    upload_url = upload_file(AUDIO_FILE)

    # 2. Start transcription
    transcript_id = start_transcription(upload_url)

    # 3. Poll for completion
    result = poll_transcription(transcript_id)

    # 4. Save raw data
    save_transcript_data(result)

    # 5. Store in database
    db_transcript_id = store_in_database(result)

    print("\n" + "=" * 80)
    print("✅ TRANSCRIPTION COMPLETE!")
    print("=" * 80)
    print(f"Database Transcript ID: {db_transcript_id}")
    print(f"Speech ID: {SPEECH_ID}")
    print(f"Audio File: {AUDIO_FILE}")
    print()

if __name__ == "__main__":
    main()
