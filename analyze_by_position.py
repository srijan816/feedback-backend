#!/usr/bin/env python3
"""
Analyze feedback documents by speaker position to identify position-specific patterns
"""

from docx import Document
from pathlib import Path
import re
from collections import defaultdict

def extract_position_from_filename(filename):
    """Extract speaker position (1.1, 1.2, 2.3, etc) from filename"""
    match = re.search(r'Feedback - (\d+\.\d+)', filename)
    if match:
        return match.group(1)
    return None

def extract_feedback(file_path):
    """Extract full teacher comments from docx"""
    try:
        doc = Document(file_path)

        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    if "Teacher comments:" in cell.text:
                        comment = cell.text.replace("Teacher comments:", "").strip()
                        return comment
        return None
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return None

def main():
    mai_folder = Path('/home/ubuntu/apps/feedback-backend/Mai')

    # Organize feedback by position (1.1, 1.2, 1.3, 1.4, 2.1, 2.2, etc)
    feedback_by_position = defaultdict(list)

    # Collect all feedback documents
    for docx_file in mai_folder.rglob('*.docx'):
        position = extract_position_from_filename(docx_file.name)
        if position:
            feedback = extract_feedback(docx_file)
            if feedback:
                feedback_by_position[position].append({
                    'file': str(docx_file.relative_to(mai_folder)),
                    'comment': feedback,
                    'length': len(feedback)
                })

    # Analyze patterns by position
    print("=" * 100)
    print("POSITION-SPECIFIC FEEDBACK ANALYSIS")
    print("=" * 100)

    # Sort positions
    positions = sorted(feedback_by_position.keys())

    for position in positions:
        feedbacks = feedback_by_position[position]

        print(f"\n{'=' * 100}")
        print(f"POSITION {position} - {len(feedbacks)} feedback documents")
        print(f"{'=' * 100}")

        # Calculate stats
        avg_length = sum(f['length'] for f in feedbacks) / len(feedbacks)
        print(f"\nAverage comment length: {avg_length:.0f} characters")

        # Extract common themes/phrases
        all_text = ' '.join(f['comment'].lower() for f in feedbacks)

        # Key phrase patterns to look for
        patterns = {
            'rebuttal': ['rebut', 'rebuttal', 'clash', 'engage with', 'respond to'],
            'new_arguments': ['new argument', 'introduce', 'establish', 'premise'],
            'summary': ['summary', 'summarize', 'crystallize', 'weighing'],
            'teamwork': ['teammate', 'extend', 'support', 'build on'],
            'counter_setup': ['counter set-up', 'model', 'framework', 'definition'],
            'signposting': ['signpost', 'structure', 'outline'],
            'hook': ['hook', 'opening', 'start'],
        }

        print(f"\nKey Theme Frequency:")
        for theme, keywords in patterns.items():
            count = sum(all_text.count(keyword) for keyword in keywords)
            if count > 0:
                print(f"  {theme.replace('_', ' ').title()}: {count} mentions")

        # Show 2-3 full examples
        print(f"\n--- SAMPLE FEEDBACKS FOR POSITION {position} ---")
        for i, feedback_data in enumerate(feedbacks[:3], 1):
            print(f"\n{'-' * 80}")
            print(f"Sample {i}: {feedback_data['file']}")
            print(f"{'-' * 80}")
            # Show first 800 characters
            preview = feedback_data['comment'][:800]
            print(preview)
            if len(feedback_data['comment']) > 800:
                print("...")
            print()

if __name__ == '__main__':
    main()
