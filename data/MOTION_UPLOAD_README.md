# Motion Management System

## Overview

The motion management system automatically assigns debate motions to students based on:
1. **Current date/time** - Units progress every Thursday in Hong Kong time
2. **Student category** - Determined by grade level and PSD tier

## How It Works

### Unit Progression

- **Base reference**: November 6, 2025 (Thursday) = Unit 3.2
- Every Thursday, the system advances to the next unit (3.2 → 3.3 → 4.1, etc.)
- Units follow the pattern: X.1, X.2, X.3, then increment to (X+1).1
- All classes learn the same unit until the next Thursday

### Student Categories

**Primary Level:**
- G3-4 PSD I
- G3-4 PSD II
- G5-6 PSD I
- G5-6 PSD II

**Secondary Level:**
- G7-9 PSD I
- G7-12 PSD II
- G7-12 PSD III

## File Format

### Excel/CSV Structure

Your motion file should be organized as follows:

```
| Category      | 1.1                  | 1.2                  | 1.3                  | 2.1                  | ...
|---------------|----------------------|----------------------|----------------------|----------------------|----
| G3-4 PSD I    | THBT homework...     | THBT recess...       | THBT uniforms...     | THBT pets...         | ...
| G3-4 PSD II   | THW ban...           | THW require...       | THW support...       | THW implement...     | ...
| G5-6 PSD I    | THBT social media... | THBT technology...   | THBT education...    | THBT environment...  | ...
| G5-6 PSD II   | TH supports...       | TH opposes...        | TH believes...       | TH would...          | ...
| G7-9 PSD I    | THBT democracy...    | THBT capitalism...   | THBT regulation...   | THBT freedom...      | ...
| G7-12 PSD II  | THW prioritize...    | THW restrict...      | THW enforce...       | THW abolish...       | ...
| G7-12 PSD III | TH regrets...        | TH prefers...        | TH supports...       | TH opposes...        | ...
```

### Requirements

1. **First Row (Header)**: Unit numbers (1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, etc.)
2. **First Column**: Student categories (must match exactly):
   - G3-4 PSD I
   - G3-4 PSD II
   - G5-6 PSD I
   - G5-6 PSD II
   - G7-9 PSD I
   - G7-12 PSD II
   - G7-12 PSD III
3. **Cells**: Each cell contains the debate motion for that category/unit combination

### Supported File Types

- `.xlsx` (Excel)
- `.xls` (Excel legacy)
- `.csv` (Comma-separated values)

## Uploading Motions

### Web Interface

1. Navigate to: `/admin/motions`
2. Log in with your admin token
3. Click the upload area or drag and drop your file
4. Click "Upload Motion Data"
5. Verify the upload was successful
6. Use "Test All Categories" to verify motions are working

### API Endpoint

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@motions.xlsx" \
  https://your-domain.com/api/motions/upload
```

## Testing

### Test Current Unit

GET `/api/motions/current`

Returns:
```json
{
  "currentUnit": "3.2",
  "currentThursday": "2025-11-06T00:00:00.000Z",
  "baseDate": "2025-11-06T00:00:00.000Z",
  "baseUnit": "3.2"
}
```

### Test All Categories

GET `/api/motions/test`

Returns motions for all categories based on current unit.

### Test Specific Grade/Date

POST `/api/motions/query`
```json
{
  "grade": "G5-6 PSD I",
  "date": "2025-11-13"
}
```

## Integration with Schedule

When teachers query their schedule via `/api/schedule/current`, the system:

1. Identifies the class and students
2. Extracts the grade information from the first student
3. Calculates the current unit based on Hong Kong date/time
4. Determines the student category from the grade
5. Returns the appropriate motion in the `suggestedMotion` field

## Troubleshooting

### No motion returned

- Verify the motion file has been uploaded
- Check that student grades in schedule match category format
- Ensure the current unit exists in your motion file

### Wrong motion displayed

- Verify current unit calculation at `/api/motions/current`
- Check student grade format in schedule data
- Test category detection with `/api/motions/query`

### Upload fails

- Check file format (first row = units, first column = categories)
- Ensure category names match exactly
- Verify file is not corrupted
- Check file size (max 10MB)

## Example Schedule JSON

Students in your schedule should have grade information:

```json
{
  "students": [
    {
      "id": "student1",
      "name": "John Doe",
      "grade": "G5-6 PSD I"
    }
  ]
}
```

The system will automatically match "G5-6 PSD I" to the corresponding category in the motion file.
