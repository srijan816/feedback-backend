#!/usr/bin/env python3
"""
Automatically detect PM speaker and time range from AssemblyAI transcript
Uses word-level speaker diarization to find first substantive speech
"""

import json
import sys
import psycopg2

def detect_pm_speaker_from_db(transcript_id=51):
    """
    Detect PM speaker from database using word-level speaker diarization
    This is more accurate than using utterances

    Returns:
        dict with keys: speaker, start_ms, end_ms, duration_sec
    """

    print("🔍 Detecting PM speaker from word-level diarization...")
    print("=" * 80)

    # Connect to database
    conn = psycopg2.connect(
        host="/var/run/postgresql",
        port=5433,
        database="debate_feedback",
        user="ubuntu"
    )
    cur = conn.cursor()

    # Get all speakers
    cur.execute("""
        SELECT DISTINCT speaker
        FROM transcript_words
        WHERE transcript_id = %s AND speaker IS NOT NULL
        ORDER BY speaker
    """, (transcript_id,))

    speakers = [row[0] for row in cur.fetchall()]
    print(f"✓ Found {len(speakers)} speakers: {', '.join(speakers)}")
    print()

    # For each speaker, find continuous speech blocks
    GAP_TOLERANCE_MS = 60000  # 1 minute gap tolerance

    all_speech_blocks = []

    for speaker in speakers:
        # Get all words for this speaker
        cur.execute("""
            SELECT start_ms, end_ms
            FROM transcript_words
            WHERE transcript_id = %s AND speaker = %s
            ORDER BY start_ms
        """, (transcript_id, speaker))

        words = cur.fetchall()

        if not words:
            continue

        # Aggregate into continuous blocks
        blocks = []
        current_block_start = words[0][0]
        current_block_end = words[0][1]

        for start_ms, end_ms in words[1:]:
            gap = start_ms - current_block_end

            if gap < GAP_TOLERANCE_MS:
                # Continue current block
                current_block_end = end_ms
            else:
                # Save current block and start new one
                blocks.append({
                    'speaker': speaker,
                    'start_ms': current_block_start,
                    'end_ms': current_block_end,
                    'duration_sec': (current_block_end - current_block_start) / 1000
                })
                current_block_start = start_ms
                current_block_end = end_ms

        # Don't forget last block
        blocks.append({
            'speaker': speaker,
            'start_ms': current_block_start,
            'end_ms': current_block_end,
            'duration_sec': (current_block_end - current_block_start) / 1000
        })

        all_speech_blocks.extend(blocks)

    cur.close()
    conn.close()

    # Filter to substantive speeches (>4 minutes)
    substantive_speeches = [b for b in all_speech_blocks if b['duration_sec'] > 240]

    if not substantive_speeches:
        print("❌ No substantive speeches (>4 min) found!")
        print("   This may be a short debate or transcription issue")
        sys.exit(1)

    # Sort by start time
    substantive_speeches.sort(key=lambda x: x['start_ms'])

    print(f"📊 Found {len(substantive_speeches)} substantive speeches (>4 min):")
    print("-" * 80)
    for i, speech in enumerate(substantive_speeches, 1):
        dur_min_sec = f"{int(speech['duration_sec']//60)}:{int(speech['duration_sec']%60):02d}"
        start_min = speech['start_ms'] / 60000
        print(f"\n{i}. Speaker {speech['speaker']}")
        print(f"   Start: {start_min:.1f} min ({speech['start_ms']}ms)")
        print(f"   End: {speech['end_ms']}ms")
        print(f"   Duration: {dur_min_sec}")

    # First substantive speech = PM
    # But check if there are consecutive blocks from the same speaker (PM speech with POI/pause)
    pm_blocks = [substantive_speeches[0]]
    first_speaker = substantive_speeches[0]['speaker']

    # Check if next blocks are also from PM speaker before any other speaker's substantive speech
    for speech in substantive_speeches[1:]:
        if speech['speaker'] == first_speaker:
            # Check if this is before any other speaker's substantive speech
            other_speakers_before = [s for s in substantive_speeches[1:]
                                    if s['speaker'] != first_speaker and s['start_ms'] < speech['start_ms']]
            if not other_speakers_before:
                pm_blocks.append(speech)
            else:
                break
        else:
            break

    # Merge PM blocks
    if len(pm_blocks) > 1:
        print(f"\n💡 Detected {len(pm_blocks)} blocks for PM speaker - merging...")
        pm = {
            'speaker': first_speaker,
            'start_ms': pm_blocks[0]['start_ms'],
            'end_ms': pm_blocks[-1]['end_ms'],
            'duration_sec': sum(b['duration_sec'] for b in pm_blocks)
        }
    else:
        pm = pm_blocks[0]

    print("\n" + "=" * 80)
    print("✅ PRIME MINISTER DETECTED")
    print("=" * 80)
    print(f"Speaker: {pm['speaker']}")
    start_min = pm['start_ms'] / 60000
    print(f"Start: {start_min:.1f} min ({pm['start_ms']}ms)")
    print(f"End: {pm['end_ms']}ms")
    dur_min_sec = f"{int(pm['duration_sec']//60)}:{int(pm['duration_sec']%60):02d}"
    print(f"Duration: {dur_min_sec}")

    return {
        'speaker': pm['speaker'],
        'start_ms': pm['start_ms'],
        'end_ms': pm['end_ms'],
        'duration_sec': pm['duration_sec']
    }


def detect_pm_speaker(transcript_file='test_data/33mb_transcript_raw.json'):
    """
    Legacy function - kept for backwards compatibility
    Uses utterances from JSON file
    """
    # For now, just use database version with transcript_id 51
    return detect_pm_speaker_from_db(transcript_id=51)


def main():
    """CLI entry point"""
    import sys

    # Get transcript ID from command line or use default
    transcript_id = int(sys.argv[1]) if len(sys.argv) > 1 else 51

    result = detect_pm_speaker_from_db(transcript_id)

    print("\n" + "=" * 80)
    print("OUTPUT (JSON):")
    print("=" * 80)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
