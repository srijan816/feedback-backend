# Feedback V2 Quality Fix Plan

## Root Causes Identified:

### 1. **Speech Duration Bug** (CRITICAL)
- Python script passes absolute timestamp (2052100ms) instead of relative duration (372680ms)
- Causes chunker to create ~16 chunks instead of 5
- Gemini analyzes different chunks than we display

### 2. **Time-Based Chunking** (MAJOR)
- Current: Chunks are 75-90s time windows
- Problem: Chunks start mid-sentence, don't align with arguments
- Solution: Chunk by semantic boundaries (argument transitions)

### 3. **Prompt Quality** (MODERATE)
- Prompt doesn't emphasize citing EXACT words
- No instruction to match chunk_id to specific content
- Gemini hallucinates chunk IDs

### 4. **Word Offset Issue** (MINOR)
- Filtered words still have absolute timestamps
- Should normalize to start at 0ms for cleaner chunking

## Fixes to Implement:

### FIX 1: Correct Speech Duration Calculation
```python
# In generate_feedback_v2_python.py line 75
# OLD: speechDuration = words[-1][3]
# NEW: speechDuration = words[-1][3] - words[0][2]
```

### FIX 2: Normalize Word Timestamps
```python
# Adjust words to start at 0ms
offset = words[0][2]
normalized_words = [{
    'word_index': w[0],
    'text': w[1],
    'start_ms': w[2] - offset,  # Normalize to 0
    'end_ms': w[3] - offset,
    'speaker': w[4]
} for w in words]
```

### FIX 3: Improve Prompt Clarity
Add to prompt:
- "You MUST cite the chunk_id where you hear the issue"
- "Each chunk contains the EXACT words spoken - reference specific phrases"
- "Do NOT cite chunk IDs that don't exist (max chunk_id is shown above)"
- Show chunk count clearly: "There are X chunks total (0 to X-1)"

### FIX 4: Better Semantic Chunking
- Review transcriptChunking.ts algorithm
- Consider adding argument boundary detection
- Maybe use pause detection or signpost words ("First", "Second", "Finally")

### FIX 5: Post-Generation Validation
- Check all cited chunk_ids exist
- Verify feedback keywords appear in cited chunks
- Reject and regenerate if mismatch >50%

## Expected Outcome:
- Feedback cites chunks that actually exist (0-4)
- Quotes match the feedback content
- Each playable moment shows relevant speech excerpt
- High keyword overlap (>5/10 words)
