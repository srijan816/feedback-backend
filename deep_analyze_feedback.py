#!/usr/bin/env python3
"""
Deep analysis of feedback docx files to extract rubrics and teacher comment patterns
"""

import os
from docx import Document
from pathlib import Path
import re

def extract_structured_feedback(file_path):
    """Extract structured feedback data from a docx file"""
    try:
        doc = Document(file_path)

        feedback_data = {
            'student_name': '',
            'motion': '',
            'rubric_items': [],
            'teacher_comments': '',
            'competition_score': '',
            'speaking_time': ''
        }

        # Extract from tables
        for table in doc.tables:
            for row in table.rows:
                cells = [cell.text.strip() for cell in row.cells]

                # Check for student name
                for cell_text in cells:
                    if 'Student Name:' in cell_text:
                        feedback_data['student_name'] = cell_text.replace('Student Name:', '').strip()

                # Check for motion
                for cell_text in cells:
                    if 'Motion:' in cell_text:
                        feedback_data['motion'] = cell_text.replace('Motion:', '').strip()

                # Check for rubric items (rows with N/A 1 2 3 4 5)
                if len(cells) > 6 and 'N/A' in cells and '1' in cells and '5' in cells:
                    # This is a rubric row
                    rubric_text = cells[0]
                    if rubric_text and 'Rubric' not in rubric_text and 'Teacher comments:' not in rubric_text:
                        feedback_data['rubric_items'].append(rubric_text)

                # Check for competition score
                if 'Competition Score:' in cells[0]:
                    feedback_data['competition_score'] = cells[0]

                # Check for teacher comments
                for cell_text in cells:
                    if 'Teacher comments:' in cell_text:
                        comment_text = cell_text.replace('Teacher comments:', '').strip()
                        if comment_text:
                            feedback_data['teacher_comments'] = comment_text

                            # Extract speaking time if present
                            time_match = re.search(r'Speaking time:\s*(\d+:\d+)', comment_text)
                            if time_match:
                                feedback_data['speaking_time'] = time_match.group(1)

        return feedback_data
    except Exception as e:
        return {'error': str(e), 'file': file_path}

def main():
    mai_folder = '/home/ubuntu/apps/feedback-backend/Mai'

    print("=" * 100)
    print("DEEP ANALYSIS OF FEEDBACK STRUCTURE")
    print("=" * 100)

    # Get all docx files
    all_files = list(Path(mai_folder).rglob('*.docx'))

    # Sample diverse files
    sample_files = all_files[:20]  # Analyze first 20

    all_rubric_items = set()
    sample_comments = []

    for i, file_path in enumerate(sample_files, 1):
        print(f"\n{'=' * 100}")
        print(f"ANALYZING FILE {i}/{len(sample_files)}")
        print(f"Path: {file_path.relative_to(mai_folder)}")
        print(f"{'=' * 100}")

        feedback = extract_structured_feedback(str(file_path))

        if 'error' in feedback:
            print(f"ERROR: {feedback['error']}")
            continue

        print(f"\nStudent: {feedback['student_name']}")
        print(f"Motion: {feedback['motion'][:100]}..." if len(feedback['motion']) > 100 else f"Motion: {feedback['motion']}")

        if feedback['rubric_items']:
            print(f"\nRUBRIC CRITERIA ({len(feedback['rubric_items'])} items):")
            for idx, item in enumerate(feedback['rubric_items'], 1):
                print(f"  {idx}. {item[:150]}..." if len(item) > 150 else f"  {idx}. {item}")
                all_rubric_items.add(item)

        if feedback['competition_score']:
            print(f"\n{feedback['competition_score']}")

        if feedback['speaking_time']:
            print(f"\nSpeaking Time: {feedback['speaking_time']}")

        if feedback['teacher_comments']:
            comment_preview = feedback['teacher_comments'][:500]
            print(f"\nTEACHER COMMENTS (first 500 chars):")
            print(comment_preview)
            print("...")

            sample_comments.append({
                'student': feedback['student_name'],
                'file': str(file_path.relative_to(mai_folder)),
                'comment_length': len(feedback['teacher_comments']),
                'full_comment': feedback['teacher_comments']
            })

    # Summary
    print("\n" + "=" * 100)
    print("COMPREHENSIVE RUBRIC ITEMS (UNIQUE)")
    print("=" * 100)

    for idx, item in enumerate(sorted(all_rubric_items), 1):
        print(f"{idx}. {item}")

    # Analyze comment patterns
    print("\n" + "=" * 100)
    print("TEACHER COMMENT ANALYSIS")
    print("=" * 100)

    if sample_comments:
        avg_length = sum(c['comment_length'] for c in sample_comments) / len(sample_comments)
        print(f"\nAverage Comment Length: {avg_length:.0f} characters")
        print(f"Shortest: {min(c['comment_length'] for c in sample_comments)} characters")
        print(f"Longest: {max(c['comment_length'] for c in sample_comments)} characters")

        # Show 3 full examples
        print("\n" + "=" * 100)
        print("FULL TEACHER COMMENT EXAMPLES")
        print("=" * 100)

        for i, comment_data in enumerate(sample_comments[:3], 1):
            print(f"\n{'-' * 100}")
            print(f"EXAMPLE {i}")
            print(f"Student: {comment_data['student']}")
            print(f"File: {comment_data['file']}")
            print(f"{'-' * 100}")
            print(comment_data['full_comment'])

if __name__ == '__main__':
    main()
