#!/usr/bin/env python3
"""
Test Rubric Scoring with Gemini Flash Latest
"""

import os
import json
from pathlib import Path
from google import genai
from google.genai import types

# Read the speech transcript
SPEECH_PATH = Path(__file__).parent / "test_data" / "gabby_prop1_speech.txt"
PROMPT_TEMPLATE_PATH = Path(__file__).parent / "prompts" / "RUBRIC_SCORING_PROMPT.md"

def load_prompt_template():
    """Load the rubric scoring prompt template"""
    with open(PROMPT_TEMPLATE_PATH, 'r') as f:
        return f.read()

def load_speech():
    """Load the speech transcript"""
    with open(SPEECH_PATH, 'r') as f:
        return f.read()

def extract_speech_info(speech_text):
    """Extract motion, position, time from speech file"""
    lines = speech_text.split('\n')
    motion = ""
    position = ""
    actual_time = ""
    transcript = ""

    in_transcript = False
    for line in lines:
        if line.startswith("Motion:"):
            motion = line.replace("Motion:", "").strip()
        elif line.startswith("Position:"):
            position = line.replace("Position:", "").strip()
        elif line.startswith("Actual Time:"):
            actual_time = line.replace("Actual Time:", "").strip()
        elif "===== TRANSCRIPT =====" in line:
            in_transcript = True
        elif in_transcript:
            transcript += line + "\n"

    return motion, position, actual_time, transcript.strip()

def format_time_to_seconds(time_str):
    """Convert MM:SS to seconds"""
    parts = time_str.split(":")
    return int(parts[0]) * 60 + int(parts[1])

def build_scoring_prompt(motion, position, expected_duration, actual_time, transcript, prior_context=""):
    """Build the complete scoring prompt"""
    template = load_prompt_template()

    prompt = template.replace('{{MOTION}}', motion)
    prompt = prompt.replace('{{POSITION}}', position)
    prompt = prompt.replace('{{EXPECTED_DURATION}}', str(expected_duration))
    prompt = prompt.replace('{{ACTUAL_TIME}}', actual_time)
    prompt = prompt.replace('{{TRANSCRIPT}}', transcript)
    prompt = prompt.replace('{{PRIOR_SPEECHES_CONTEXT}}', prior_context or 'This is the first speech.')

    return prompt

def score_rubrics():
    """Score the speech using Gemini Flash Latest"""

    # Load speech
    speech_text = load_speech()
    motion, position, actual_time, transcript = extract_speech_info(speech_text)

    print(f"Motion: {motion}")
    print(f"Position: {position}")
    print(f"Actual Time: {actual_time}")
    print(f"Transcript Length: {len(transcript)} chars\n")

    # Build prompt
    prompt = build_scoring_prompt(
        motion=motion,
        position=position,
        expected_duration=8,  # 8 minutes for WSDC
        actual_time=actual_time,
        transcript=transcript,
        prior_context=""  # First speech
    )

    print("Sending to Gemini Flash Latest for scoring...\n")

    # Initialize Gemini client
    client = genai.Client(
        api_key=os.environ.get("GEMINI_API_KEY"),
    )

    model = "gemini-flash-latest"
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=prompt),
            ],
        ),
    ]

    generate_content_config = types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(
            thinking_budget=24576,
        ),
        response_mime_type="application/json",
    )

    # Generate scores
    response_text = ""
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    ):
        response_text += chunk.text

    # Parse JSON response
    try:
        result = json.loads(response_text)
        return result
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse LLM response as JSON: {e}\nResponse: {response_text}")

if __name__ == "__main__":
    print("=" * 80)
    print("TESTING RUBRIC SCORING WITH GEMINI FLASH LATEST")
    print("=" * 80)
    print()

    result = score_rubrics()

    print("\n" + "=" * 80)
    print("RUBRIC SCORES")
    print("=" * 80)
    print(json.dumps(result["scores"], indent=2))

    print("\n" + "=" * 80)
    print("JUSTIFICATIONS")
    print("=" * 80)
    for rubric, justification in result["justifications"].items():
        print(f"\n{rubric}:")
        print(f"  {justification}")

    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"Average Score: {result['average_score']}")
    print(f"Total Scored Rubrics: {result['total_scored_rubrics']}")

    # Save result
    output_path = Path(__file__).parent / "test_data" / "rubric_scores_result.json"
    with open(output_path, 'w') as f:
        json.dump(result, f, indent=2)

    print(f"\nResults saved to: {output_path}")
