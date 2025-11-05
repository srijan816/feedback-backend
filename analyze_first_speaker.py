#!/usr/bin/env python3
"""
Analyze utterances chronologically to identify the first speaker
"""

import json

with open('test_data/33mb_transcript_raw.json') as f:
    data = json.load(f)

utterances = data.get('utterances', [])

# Sort by start time
sorted_utterances = sorted(utterances, key=lambda x: x['start'])

print("First 10 utterances in chronological order:")
print("=" * 80)

for i, utt in enumerate(sorted_utterances[:10]):
    start_min = utt['start'] / 1000 / 60
    end_min = utt['end'] / 1000 / 60
    duration = (utt['end'] - utt['start']) / 1000

    text_preview = utt['text'][:100] + "..." if len(utt['text']) > 100 else utt['text']

    print(f"\n#{i+1} - Speaker {utt['speaker']}")
    print(f"  Time: {start_min:.2f}m - {end_min:.2f}m (duration: {duration:.1f}s)")
    print(f"  Text: {text_preview}")

print("\n" + "=" * 80)
print("First substantive speaker (longest early speech):")
print("=" * 80)

# Find first speaker with >5 minutes continuous speech
for i, utt in enumerate(sorted_utterances):
    duration = (utt['end'] - utt['start']) / 1000
    if duration > 300:  # More than 5 minutes
        start_min = utt['start'] / 1000 / 60
        end_min = utt['end'] / 1000 / 60

        print(f"\nSpeaker {utt['speaker']}")
        print(f"  Time: {start_min:.2f}m - {end_min:.2f}m")
        print(f"  Duration: {duration/60:.2f} minutes")
        print(f"  Text preview: {utt['text'][:200]}...")

        # This is likely the PM (first speaker)
        print(f"\n✓ This is likely the FIRST SPEAKER (PM)")
        print(f"  Use Speaker: {utt['speaker']}")
        break
