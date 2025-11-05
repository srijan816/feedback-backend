#!/usr/bin/env python3
from docx import Document

file_path = "/home/ubuntu/apps/feedback-backend/Mai/G7-12-PSD-II- Tuesdays-6pm/Emma Lai/Unit 1/Feedback - 1.2 - Emma Lai.docx"

doc = Document(file_path)

for table in doc.tables:
    for row in table.rows:
        for cell in row.cells:
            if "Teacher comments:" in cell.text:
                print(cell.text)
                break
