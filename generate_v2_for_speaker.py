#!/usr/bin/env python3
"""
Generate V2 feedback for a specific speaker from the full debate transcript
"""

import json
import sys
import os
from detect_pm_speaker import detect_pm_speaker_from_db

# Add src directory to path
sys.path.insert(0, 'src')

TRANSCRIPT_ID = 53  # Updated to use transcript with Speaker Identification
MOTION = "This House would nationalise the research, development, and distribution of pharmaceuticals"
POSITION = "PM"
EXPECTED_DURATION = 480  # 8 minutes
AUDIO_URL = "/storage/uploads/9afc6a87-d28c-4ef2-9f78-9eb6a555e7d3.mp3"

def main():
    print("=" * 80)
    print(f"GENERATING V2 FEEDBACK - AUTO-DETECTING PM SPEAKER")
    print("=" * 80)
    print()

    # Auto-detect PM speaker from transcript
    print("🔍 Step 1: Auto-detecting PM speaker...")
    pm_info = detect_pm_speaker_from_db(TRANSCRIPT_ID)
    print()

    speaker = pm_info['speaker']
    start_ms = pm_info['start_ms']
    end_ms = pm_info['end_ms']
    duration_sec = int(pm_info['duration_sec'])

    print("=" * 80)
    print(f"✅ USING DETECTED PM: Speaker {speaker}")
    print(f"   Time range: {start_ms}ms - {end_ms}ms")
    print(f"   Duration: {duration_sec//60}:{duration_sec%60:02d}")
    print("=" * 80)
    print()

    # Prepare input JSON for feedback generation
    input_data = {
        "transcript_id": TRANSCRIPT_ID,
        "speaker_filter": speaker,
        "motion": MOTION,
        "position": POSITION,
        "expected_duration": EXPECTED_DURATION,
        "actual_time_seconds": duration_sec,
        "audio_url": AUDIO_URL,
        "start_ms": start_ms,  # Automatically detected
        "end_ms": end_ms        # Automatically detected
    }

    # Save input file
    os.makedirs("test_data", exist_ok=True)
    with open("test_data/feedback_v2_pharma_input.json", "w") as f:
        json.dump(input_data, f, indent=2)

    print("✓ Created input file: test_data/feedback_v2_pharma_input.json")
    print()
    print("Input parameters:")
    print(f"  Transcript ID: {TRANSCRIPT_ID}")
    print(f"  Speaker: {speaker} (auto-detected)")
    print(f"  Time Range: {start_ms}ms - {end_ms}ms")
    print(f"  Motion: {MOTION}")
    print(f"  Position: {POSITION}")
    print(f"  Duration: {duration_sec}s ({duration_sec//60}:{duration_sec%60:02d})")
    print()
    print("✅ Ready! Now run: python3 generate_feedback_v2_python.py")

if __name__ == "__main__":
    main()
