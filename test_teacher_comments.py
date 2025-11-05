#!/usr/bin/env python3
"""
Test Teacher Comments Generation with Gemini 2.5 Pro
"""

import os
import json
from pathlib import Path
from google import genai
from google.genai import types

# Read the speech transcript
SPEECH_PATH = Path(__file__).parent / "test_data" / "gabby_prop1_speech.txt"
PROMPT_TEMPLATE_PATH = Path(__file__).parent / "prompts" / "TEACHER_COMMENTS_GENERATION.md"

def load_prompt_template():
    """Load the teacher comments prompt template"""
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

def get_motion_type(motion):
    """Determine motion type from motion text"""
    lower = motion.lower()
    if "this house would" in lower:
        return "policy"
    elif "this house prefers" in lower:
        return "comparison"
    else:
        return "principle"

def build_comments_prompt(motion, position, expected_duration, actual_time, transcript, prior_context=""):
    """Build the complete teacher comments prompt"""
    template = load_prompt_template()

    motion_type = get_motion_type(motion)

    prompt = template.replace('{{MOTION}}', motion)
    prompt = prompt.replace('{{MOTION_TYPE}}', motion_type)
    prompt = prompt.replace('{{POSITION}}', position)
    prompt = prompt.replace('{{EXPECTED_DURATION}}', str(expected_duration))
    prompt = prompt.replace('{{ACTUAL_TIME}}', actual_time)
    prompt = prompt.replace('{{TRANSCRIPT}}', transcript)
    prompt = prompt.replace('{{PRIOR_SPEECHES_CONTEXT}}', prior_context or 'This is the first speech.')

    return prompt

def generate_teacher_comments():
    """Generate teacher comments using Gemini 2.5 Pro"""

    # Load speech
    speech_text = load_speech()
    motion, position, actual_time, transcript = extract_speech_info(speech_text)

    print(f"Motion: {motion}")
    print(f"Position: {position}")
    print(f"Actual Time: {actual_time}")
    print(f"Transcript Length: {len(transcript)} chars\n")

    # Build prompt
    prompt = build_comments_prompt(
        motion=motion,
        position=position,
        expected_duration=8,  # 8 minutes for WSDC
        actual_time=actual_time,
        transcript=transcript,
        prior_context=""  # First speech
    )

    print("Sending to Gemini 2.5 Pro for teacher comments generation...\n")

    # Initialize Gemini client
    client = genai.Client(
        api_key=os.environ.get("GEMINI_API_KEY"),
    )

    model = "gemini-2.5-pro"
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
            thinking_budget=32768,
        ),
    )

    # Generate comments - NOTE: NOT JSON for teacher comments, just text
    response_text = ""
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=contents,
        config=generate_content_config,
    ):
        response_text += chunk.text

    return response_text.strip()

if __name__ == "__main__":
    print("=" * 80)
    print("TESTING TEACHER COMMENTS GENERATION WITH GEMINI 2.5 PRO")
    print("=" * 80)
    print()

    comments = generate_teacher_comments()

    print("\n" + "=" * 80)
    print("TEACHER COMMENTS")
    print("=" * 80)
    print(comments)

    print("\n" + "=" * 80)
    print("STATISTICS")
    print("=" * 80)
    word_count = len(comments.split())
    char_count = len(comments)
    print(f"Word Count: {word_count}")
    print(f"Character Count: {char_count}")

    # Save result
    output_path = Path(__file__).parent / "test_data" / "teacher_comments_result.txt"
    with open(output_path, 'w') as f:
        f.write(comments)

    print(f"\nResults saved to: {output_path}")
