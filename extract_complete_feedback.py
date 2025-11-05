#!/usr/bin/env python3
"""
Extract COMPLETE feedback documents with motion and speaker position
"""

from docx import Document
from pathlib import Path
import json

def extract_complete_feedback(file_path):
    """Extract all metadata from a feedback document"""
    try:
        doc = Document(file_path)

        data = {
            'file': str(file_path),
            'student_name': None,
            'motion': None,
            'teacher_comments': None,
            'speech_time': None,
            'speech_type': None  # Regular, reply, etc.
        }

        # Extract from tables
        for table in doc.tables:
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells]

                # Student name
                for cell_text in cells:
                    if 'Student Name:' in cell_text:
                        data['student_name'] = cell_text.replace('Student Name:', '').strip()

                # Motion
                for cell_text in cells:
                    if 'Motion:' in cell_text:
                        data['motion'] = cell_text.replace('Motion:', '').strip()

                # Teacher comments
                for cell_text in cells:
                    if 'Teacher comments:' in cell_text:
                        comment = cell_text.replace('Teacher comments:', '').strip()
                        data['teacher_comments'] = comment

                        # Extract speech time from comments
                        import re
                        time_match = re.search(r'Speaking time:\s*(\d+:\d+)', comment)
                        if time_match:
                            data['speech_time'] = time_match.group(1)

                        # Check if it's a reply speech
                        if 'reply speech' in comment.lower():
                            data['speech_type'] = 'reply'
                        else:
                            data['speech_type'] = 'constructive'

        return data
    except Exception as e:
        return {'error': str(e), 'file': str(file_path)}

def main():
    mai_folder = Path('/home/ubuntu/apps/feedback-backend/Mai')

    # Get diverse sample of 15 complete feedbacks
    all_files = list(mai_folder.rglob('*.docx'))

    # Sample from different students and units
    samples = [
        all_files[0], all_files[5], all_files[10], all_files[15], all_files[20],
        all_files[25], all_files[30], all_files[35], all_files[40], all_files[45],
        all_files[50], all_files[55], all_files[60], all_files[65], all_files[70]
    ]

    print("=" * 100)
    print("COMPLETE FEEDBACK DOCUMENT ANALYSIS")
    print("=" * 100)

    for i, file_path in enumerate(samples, 1):
        print(f"\n{'=' * 100}")
        print(f"SAMPLE {i}/15: {file_path.relative_to(mai_folder)}")
        print(f"{'=' * 100}")

        data = extract_complete_feedback(file_path)

        if 'error' in data:
            print(f"ERROR: {data['error']}")
            continue

        print(f"\nStudent: {data['student_name']}")
        print(f"Motion: {data['motion'][:100]}..." if len(data['motion']) > 100 else f"Motion: {data['motion']}")
        print(f"Speech Type: {data['speech_type']}")
        print(f"Speaking Time: {data['speech_time']}")

        print(f"\n--- FULL TEACHER COMMENTS ---")
        print(data['teacher_comments'])
        print("\n" + "-" * 100)

if __name__ == '__main__':
    main()
