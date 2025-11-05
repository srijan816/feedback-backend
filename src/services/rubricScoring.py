#!/usr/bin/env python3
"""
Rubric Scoring Service using Gemini Flash with Structured JSON Output
"""

import os
import json
from pathlib import Path
from google import genai
from google.genai import types

# Load the rubric scoring prompt template
PROMPT_TEMPLATE_PATH = Path(__file__).parent.parent.parent / "prompts" / "RUBRIC_SCORING_PROMPT.md"

def load_prompt_template():
    """Load the rubric scoring prompt template"""
    with open(PROMPT_TEMPLATE_PATH, 'r') as f:
        return f.read()

def format_time(seconds: int) -> str:
    """Convert seconds to MM:SS format"""
    minutes = seconds // 60
    secs = seconds % 60
    return f"{minutes:02d}:{secs:02d}"

def build_scoring_prompt(
    motion: str,
    position: str,
    expected_duration: int,
    actual_time_seconds: int,
    transcript: str,
    prior_speeches_context: str = ""
) -> str:
    """
    Build the complete scoring prompt by filling in the template

    Args:
        motion: The debate motion
        position: Speaker position (Prop 1, Prop 2, Opp 1, etc.)
        expected_duration: Expected speech duration in minutes
        actual_time_seconds: Actual speaking time in seconds
        transcript: Full speech transcript
        prior_speeches_context: Context from prior speeches (for 2nd/3rd speakers)

    Returns:
        Complete prompt ready to send to LLM
    """
    template = load_prompt_template()

    actual_time = format_time(actual_time_seconds)

    prompt = template.replace('{{MOTION}}', motion)
    prompt = prompt.replace('{{POSITION}}', position)
    prompt = prompt.replace('{{EXPECTED_DURATION}}', str(expected_duration))
    prompt = prompt.replace('{{ACTUAL_TIME}}', actual_time)
    prompt = prompt.replace('{{TRANSCRIPT}}', transcript)
    prompt = prompt.replace('{{PRIOR_SPEECHES_CONTEXT}}', prior_speeches_context or 'This is the first speech.')

    return prompt

def score_rubrics(
    motion: str,
    position: str,
    expected_duration: int,
    actual_time_seconds: int,
    transcript: str,
    prior_speeches_context: str = "",
    api_key: str = None
) -> dict:
    """
    Score a debate speech on 8 rubrics using Gemini Flash

    Args:
        motion: The debate motion
        position: Speaker position (Prop 1, Prop 2, Opp 1, etc.)
        expected_duration: Expected speech duration in minutes
        actual_time_seconds: Actual speaking time in seconds
        transcript: Full speech transcript
        prior_speeches_context: Context from prior speeches
        api_key: Gemini API key (if not in environment)

    Returns:
        dict: {
            "scores": { rubric_name: score or "NA" },
            "justifications": { rubric_name: justification_text },
            "average_score": float,
            "total_scored_rubrics": int
        }
    """
    # Get API key
    if api_key is None:
        api_key = os.environ.get("GEMINI_API_KEY")

    if not api_key:
        raise ValueError("GEMINI_API_KEY not found in environment or parameters")

    # Build prompt
    prompt = build_scoring_prompt(
        motion=motion,
        position=position,
        expected_duration=expected_duration,
        actual_time_seconds=actual_time_seconds,
        transcript=transcript,
        prior_speeches_context=prior_speeches_context
    )

    # Initialize Gemini client
    client = genai.Client(api_key=api_key)

    model = "gemini-flash-latest"

    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=prompt),
            ],
        ),
    ]

    # Configure with structured JSON output and thinking
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

def score_rubrics_sync(
    motion: str,
    position: str,
    expected_duration: int,
    actual_time_seconds: int,
    transcript: str,
    prior_speeches_context: str = "",
    api_key: str = None
) -> dict:
    """
    Synchronous version - score rubrics and return immediately
    """
    return score_rubrics(
        motion=motion,
        position=position,
        expected_duration=expected_duration,
        actual_time_seconds=actual_time_seconds,
        transcript=transcript,
        prior_speeches_context=prior_speeches_context,
        api_key=api_key
    )

# Example usage
if __name__ == "__main__":
    # Example test
    result = score_rubrics(
        motion="This House Would give prisoners the right to vote",
        position="Prop 1",
        expected_duration=5,
        actual_time_seconds=315,  # 5:15
        transcript="""
        [Sample transcript here]
        Good morning judges. Today we're here to discuss why prisoners should have the right to vote.
        Let me signpost my speech. I'll present two main arguments: first, that voting is a fundamental right,
        and second, that prisoner voting improves criminal justice policies.

        My first argument is about fundamental rights...
        """,
        prior_speeches_context="",
        api_key="AIzaSyDwdU2z6Dld3hLy8oEvEBy3Lx8-Mxg4y2s"
    )

    print(json.dumps(result, indent=2))
