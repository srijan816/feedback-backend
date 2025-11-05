# Upload Response Format Fix - COMPLETE ✅

## Issue
iOS app showed error: **"data couldn't be read because it is not the correct format"** when uploading speech files.

## Root Cause
**Type mismatch in response format:**

iOS app expected:
```swift
struct UploadResponse: Codable {
    let speechId: String      // ← STRING
    let status: String
    let processingStarted: Bool
}
```

Backend was returning:
```json
{
  "speechId": 5,              // ← INTEGER!
  "status": "uploaded",
  "processingStarted": true
}
```

The JSON decoder in iOS failed because `speechId` was an integer instead of a string.

## Fix Applied

### 1. Updated Backend Response (debates.ts)

**File:** `src/routes/debates.ts` (line 220)

**Before:**
```typescript
const response = {
  speechId: speech.id,  // Returns integer
  status: 'uploaded',
  processingStarted: true,
};
```

**After:**
```typescript
const response = {
  speechId: speech.id.toString(),  // ✅ Convert to string!
  status: 'uploaded',
  processingStarted: true,
  // Legacy fields for backward compatibility
  speech_id: speech.id,
  processing_started: true,
  estimated_completion_seconds: 120,
};
```

### 2. Updated TypeScript Type Definition (types/index.ts)

**File:** `src/types/index.ts`

**Before:**
```typescript
export interface UploadSpeechResponse {
  speech_id: string;
  status: string;
  processing_started: boolean;
  estimated_completion_seconds: number;
}
```

**After:**
```typescript
export interface UploadSpeechResponse {
  speechId: string;              // iOS camelCase
  status: string;
  processingStarted: boolean;     // iOS camelCase
  // Legacy fields for backward compatibility
  speech_id?: string;
  processing_started?: boolean;
  estimated_completion_seconds?: number;
}
```

### 3. Rebuilt and Restarted Backend

```bash
npm run build
sudo systemctl restart debate-feedback-backend
```

## Verification ✅

### Test with curl:
```bash
$ curl -X POST "https://api.genalphai.com/api/debates/{debate_id}/speeches" \
  -H "Authorization: Bearer $TOKEN" \
  -F "audio_file=@test.m4a" \
  -F "speaker_name=Test" \
  -F "speaker_position=PM" \
  -F "duration_seconds=180"

Response:
{
  "speechId": "6",               ✅ STRING (has quotes!)
  "status": "uploaded",
  "processingStarted": true,
  "speech_id": 6,
  "processing_started": true,
  "estimated_completion_seconds": 120
}
```

### Python type verification:
```bash
$ python3 -c "import sys, json; data = json.load(sys.stdin); \
  print(f'speechId type: {type(data[\"speechId\"]).__name__}')"

speechId type: str  ✅ Confirmed it's a string!
```

## Expected iOS Behavior Now

### Before (with integer speechId):
```
❌ Upload fails
❌ Error: "data couldn't be read because it is not the correct format"
❌ Decoding error in iOS
```

### After (with string speechId):
```
✅ Upload succeeds
✅ Response decoded successfully
✅ Speech ID stored as string
✅ Can check processing status
```

## Response Format Details

The backend now returns **dual format** for compatibility:

### iOS Format (camelCase, speechId as String):
```json
{
  "speechId": "6",           // String for iOS
  "status": "uploaded",
  "processingStarted": true  // camelCase for iOS
}
```

### Legacy Format (snake_case, speech_id as Integer):
```json
{
  "speech_id": 6,            // Integer for legacy
  "processing_started": true, // snake_case for legacy
  "estimated_completion_seconds": 120
}
```

Both are included in the same response for backward compatibility.

## What Changed

| Field | Old Value | New Value | Reason |
|-------|-----------|-----------|--------|
| `speechId` | `5` (number) | `"5"` (string) | iOS expects String |
| `processingStarted` | Missing | `true` (boolean) | iOS camelCase field |
| Type definition | snake_case only | Both formats | iOS compatibility |

## Files Modified

1. ✅ `src/routes/debates.ts` (line 220)
   - Changed `speechId: speech.id` to `speechId: speech.id.toString()`

2. ✅ `src/types/index.ts` (UploadSpeechResponse interface)
   - Changed to camelCase primary fields
   - Made legacy snake_case fields optional
   - Updated documentation

3. ✅ `dist/` (rebuilt TypeScript)

## iOS App Flow - Now Working

1. **Login** ✅
   ```
   POST /api/auth/login
   Response: { token, teacher: { id, name, isAdmin } }
   ```

2. **Create Debate** ✅
   ```
   POST /api/debates/create
   Response: { debateId: "uuid" }
   ```

3. **Upload Speech** ✅ **[FIXED]**
   ```
   POST /api/debates/:debateId/speeches
   Form data: audio_file, speaker_name, speaker_position, duration_seconds
   Response: { speechId: "6", status: "uploaded", processingStarted: true }
   ```

4. **Check Status** ✅
   ```
   GET /api/speeches/:speechId/status
   Response: { status, googleDocUrl, errorMessage }
   ```

5. **Get Feedback** ✅
   ```
   GET /api/speeches/:speechId/feedback
   Response: { google_doc_url, scores, qualitative_feedback }
   ```

## Testing Checklist

Before testing iOS app:

- [x] Backend rebuilt
- [x] Backend restarted
- [x] curl test shows speechId as string
- [x] Python verification confirms string type
- [x] Response includes all iOS required fields
- [x] Response includes legacy fields for compatibility

**Ready for iOS app testing! 🚀**

## If Upload Still Fails

### 1. Check Xcode Console
Look for decoding errors:
```
🌐 Upload URL: https://api.genalphai.com/api/debates/{id}/speeches
❌ Error: typeMismatch(Swift.String, ...)
```

### 2. Add Debug Logging in iOS
In `APIClient.swift` upload method (line 145):
```swift
do {
    let decoded = try JSONDecoder().decode(UploadResponse.self, from: data)

    // ADD THIS:
    print("✅ Upload response decoded successfully")
    print("   Speech ID: \(decoded.speechId)")
    print("   Status: \(decoded.status)")

    return decoded
} catch {
    // ADD THIS:
    print("❌ Decoding failed: \(error)")
    if let json = String(data: data, encoding: .utf8) {
        print("   Raw response: \(json)")
    }
    throw NetworkError.decodingError
}
```

### 3. Test Backend Directly
```bash
# Create debate
DEBATE_ID=$(curl -s -X POST https://api.genalphai.com/api/debates/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"motion":"Test","format":"WSDC","student_level":"secondary","speech_time_seconds":300,"teams":{"prop":[{"name":"A","position":"PM"}],"opp":[{"name":"B","position":"LO"}]}}' \
  | jq -r '.debateId')

# Upload speech
curl -X POST "https://api.genalphai.com/api/debates/$DEBATE_ID/speeches" \
  -H "Authorization: Bearer $TOKEN" \
  -F "audio_file=@your_audio.m4a" \
  -F "speaker_name=Test" \
  -F "speaker_position=PM" \
  -F "duration_seconds=180" \
  | python3 -m json.tool
```

### 4. Check Response Format
The response MUST have:
```json
{
  "speechId": "string",      // ← Must be string with quotes!
  "status": "string",
  "processingStarted": boolean
}
```

If `speechId` appears as `5` instead of `"5"`, the backend change didn't take effect.

## Status: COMPLETE ✅

- ✅ Root cause identified (integer vs string type mismatch)
- ✅ Backend response format fixed (speechId now string)
- ✅ TypeScript types updated (iOS-compatible)
- ✅ Backend rebuilt and restarted
- ✅ Verified with curl (speechId is string)
- ✅ Verified with Python (type is str)
- ✅ Ready for iOS app testing

**The upload response format now matches exactly what the iOS app expects!**

---

## Summary of All Fixes

This is the **third and final fix** for iOS app integration:

1. ✅ **DNS/HTTPS** - Fixed iOS app reaching backend
2. ✅ **404 Error** - Fixed route and database schema
3. ✅ **Response Format** - Fixed speechId type (integer → string)

**All backend integration work is complete! 🎉**
