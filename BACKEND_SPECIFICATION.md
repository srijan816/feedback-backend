# Backend Specification - Debate Recording & Feedback Platform

## Overview
Node.js/Python backend for processing debate speech recordings, generating AI-powered transcriptions and feedback, and managing debate sessions.

---

## 1. Architecture Overview

### 1.1 High-Level Architecture
```
┌─────────────┐
│   iOS App   │
└──────┬──────┘
       │ HTTPS/REST
       ▼
┌─────────────────────────────────────┐
│         API Gateway (Express)        │
│  - Authentication                   │
│  - Request validation               │
│  - Rate limiting                    │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│      Core Services Layer            │
│  - Debate Management                │
│  - File Upload Handler              │
│  - Schedule Service                 │
│  - User Management                  │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│   Async Processing Queue (Bull)     │
│  - Transcription Jobs               │
│  - Feedback Generation Jobs         │
│  - Google Docs Creation Jobs        │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│      Background Workers             │
│  - OpenAI Transcription Worker      │
│  - LLM Feedback Worker              │
│  - Google Docs Worker               │
│  - Storage Management Worker        │
└──────┬──────────────────────────────┘
       │
       ▼
┌──────────────────┬──────────────────┐
│   External APIs   │   Storage        │
│  - OpenAI API     │  - VPS Local     │
│  - Gemini API     │  - Google Drive  │
│  - Claude API     │                  │
│  - ChatGPT API    │                  │
│  - Grok API       │                  │
│  - Google Docs    │                  │
└───────────────────┴──────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│      Database (PostgreSQL)          │
│  - Users, Schedules, Debates        │
│  - Speeches, Transcripts, Feedback  │
│  - Prompts, Rubrics                 │
└─────────────────────────────────────┘
```

### 1.2 Technology Stack

**Runtime**: Node.js 20+ with TypeScript
**Framework**: Express.js
**Database**: PostgreSQL 15+
**Queue**: Redis + Bull (job queue)
**File Storage**:
  - Local: `/var/storage/debate-recordings/`
  - Cloud: Google Drive API
**APIs**:
  - OpenAI API (transcription)
  - Google Gemini API (feedback generation)
  - Claude API (optional)
  - ChatGPT API (optional)
  - Grok API (optional)
  - Google Docs API (document generation)
  - Google Drive API (storage)

---

## 2. Database Schema

### 2.1 Tables

#### `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('teacher', 'admin')),
  institution VARCHAR(255) DEFAULT 'capstone',
  device_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_device ON users(device_id);
```

#### `students`
```sql
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  level VARCHAR(50) NOT NULL CHECK (level IN ('primary', 'secondary')),
  institution VARCHAR(255) DEFAULT 'capstone',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_students_name ON students(name);
```

#### `schedules`
```sql
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES users(id),
  class_id VARCHAR(100),
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  suggested_motion TEXT,
  default_format VARCHAR(50),
  default_speech_time INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_schedules_teacher ON schedules(teacher_id);
CREATE INDEX idx_schedules_time ON schedules(day_of_week, start_time);
```

#### `schedule_students`
```sql
CREATE TABLE schedule_students (
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  PRIMARY KEY (schedule_id, student_id)
);
```

#### `debates`
```sql
CREATE TABLE debates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES users(id),
  motion TEXT NOT NULL,
  format VARCHAR(50) NOT NULL,
  student_level VARCHAR(50) NOT NULL,
  speech_time_seconds INTEGER NOT NULL,
  reply_time_seconds INTEGER,
  status VARCHAR(50) DEFAULT 'in_progress',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_debates_teacher ON debates(teacher_id);
CREATE INDEX idx_debates_created ON debates(created_at);
```

#### `debate_participants`
```sql
CREATE TABLE debate_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID REFERENCES debates(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id),
  student_name VARCHAR(255) NOT NULL,
  team VARCHAR(50) NOT NULL,
  position VARCHAR(50) NOT NULL,
  speaker_order INTEGER NOT NULL
);

CREATE INDEX idx_participants_debate ON debate_participants(debate_id);
```

#### `speeches`
```sql
CREATE TABLE speeches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID REFERENCES debates(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES debate_participants(id),
  speaker_name VARCHAR(255) NOT NULL,
  speaker_position VARCHAR(50) NOT NULL,
  audio_file_path VARCHAR(500),
  audio_file_url TEXT,
  duration_seconds INTEGER,
  upload_status VARCHAR(50) DEFAULT 'pending',
  transcription_status VARCHAR(50) DEFAULT 'pending',
  feedback_status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  transcription_started_at TIMESTAMP,
  transcription_completed_at TIMESTAMP,
  feedback_started_at TIMESTAMP,
  feedback_completed_at TIMESTAMP
);

CREATE INDEX idx_speeches_debate ON speeches(debate_id);
CREATE INDEX idx_speeches_status ON speeches(transcription_status, feedback_status);
```

#### `transcripts`
```sql
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speech_id UUID REFERENCES speeches(id) ON DELETE CASCADE,
  transcript_text TEXT NOT NULL,
  word_count INTEGER,
  speaking_rate DECIMAL(5,2),
  api_provider VARCHAR(50) DEFAULT 'openai',
  processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transcripts_speech ON transcripts(speech_id);
```

#### `feedback`
```sql
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speech_id UUID REFERENCES speeches(id) ON DELETE CASCADE,
  google_doc_id VARCHAR(255),
  google_doc_url TEXT NOT NULL,
  scores JSONB,
  qualitative_feedback JSONB,
  llm_provider VARCHAR(50),
  llm_model VARCHAR(100),
  processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_feedback_speech ON feedback(speech_id);
CREATE INDEX idx_feedback_doc ON feedback(google_doc_id);
```

#### `rubrics`
```sql
CREATE TABLE rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(255) NOT NULL,
  student_level VARCHAR(50) NOT NULL,
  scoring_type VARCHAR(50) CHECK (scoring_type IN ('NA', '1-5', 'qualitative')),
  description TEXT,
  weight DECIMAL(3,2) DEFAULT 1.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rubrics_level ON rubrics(student_level, is_active);
```

#### `prompt_templates`
```sql
CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  student_level VARCHAR(50) NOT NULL,
  template_type VARCHAR(50) CHECK (template_type IN ('scoring', 'qualitative', 'full')),
  prompt_text TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_prompts_active ON prompt_templates(student_level, template_type, is_active);
```

---

## 3. API Endpoints

### 3.1 Authentication

#### `POST /api/auth/login`
**Description**: Authenticate teacher/admin
**Request**:
```json
{
  "email": "teacher@capstone.com",
  "device_id": "iPhone-ABC123"
}
```
**Response**:
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": "uuid",
    "name": "John Doe",
    "email": "teacher@capstone.com",
    "role": "teacher"
  }
}
```

### 3.2 Schedule Management

#### `GET /api/schedule/current`
**Description**: Get current class schedule and auto-populate data
**Query Params**: `teacher_id`, `timestamp`
**Response**:
```json
{
  "class_id": "debate-101",
  "students": [
    { "id": "uuid", "name": "Alice", "level": "secondary" }
  ],
  "suggested_motion": "This house would ban social media",
  "format": "WSDC",
  "speech_time": 480,
  "alternatives": [
    {
      "class_id": "debate-102",
      "start_time": "16:30",
      "startDateTime": "2025-11-06T08:30:00.000Z"
    }
  ]
}
```

> **Note:** Alternative classes now include a `startDateTime` field (ISO8601, Hong Kong timezone) so the frontend can schedule the exact session when multiple classes share the same start time.

#### `POST /api/schedule`
**Description**: Create/update schedule (admin only)
**Request**:
```json
{
  "teacher_id": "uuid",
  "class_id": "debate-101",
  "day_of_week": 1,
  "start_time": "14:00:00",
  "end_time": "15:30:00",
  "student_ids": ["uuid1", "uuid2"],
  "suggested_motion": "This house would...",
  "default_format": "WSDC"
}
```

### 3.3 Debate Management

#### `POST /api/debates/create`
**Description**: Create new debate session
**Request**:
```json
{
  "teacher_id": "uuid",
  "motion": "This house would ban homework",
  "format": "WSDC",
  "student_level": "primary",
  "teams": {
    "prop": [
      { "student_id": "uuid1", "name": "Alice", "position": "Prop 1" },
      { "student_id": "uuid2", "name": "Bob", "position": "Prop 2" }
    ],
    "opp": [
      { "student_id": "uuid3", "name": "Charlie", "position": "Opp 1" }
    ]
  },
  "speech_time_seconds": 300,
  "reply_time_seconds": 120
}
```
**Response**:
```json
{
  "debate_id": "uuid",
  "created_at": "2025-01-20T14:30:00Z"
}
```

#### `GET /api/debates/{debate_id}`
**Description**: Get debate details and all speeches
**Response**:
```json
{
  "id": "uuid",
  "motion": "...",
  "format": "WSDC",
  "speeches": [
    {
      "id": "uuid",
      "speaker_name": "Alice",
      "position": "Prop 1",
      "status": "complete",
      "feedback_url": "https://docs.google.com/..."
    }
  ]
}
```

### 3.4 Speech Upload & Processing

#### `POST /api/debates/{debate_id}/speeches`
**Description**: Upload speech audio file
**Content-Type**: `multipart/form-data`
**Fields**:
- `audio_file`: File (M4A/AAC)
- `speaker_name`: String
- `speaker_position`: String
- `duration_seconds`: Number
- `student_level`: String

**Response**:
```json
{
  "speech_id": "uuid",
  "status": "uploaded",
  "processing_started": true,
  "estimated_completion_seconds": 180
}
```

#### `GET /api/speeches/{speech_id}/status`
**Description**: Check processing status
**Response**:
```json
{
  "speech_id": "uuid",
  "transcription_status": "complete",
  "feedback_status": "processing",
  "google_doc_url": null,
  "updated_at": "2025-01-20T14:35:00Z"
}
```

#### `GET /api/speeches/{speech_id}/feedback`
**Description**: Get feedback details
**Response**:
```json
{
  "speech_id": "uuid",
  "google_doc_url": "https://docs.google.com/document/d/...",
  "scores": {
    "argumentation": 4,
    "delivery": 3,
    "rebuttal": "NA"
  },
  "qualitative_feedback": {
    "strengths": ["Clear structure", "Good evidence"],
    "improvements": ["Slow down speaking pace"]
  },
  "created_at": "2025-01-20T14:38:00Z"
}
```

### 3.5 Feedback History

#### `GET /api/teachers/{teacher_id}/debates`
**Description**: Get debate history
**Query Params**: `limit`, `offset`, `start_date`, `end_date`
**Response**:
```json
{
  "debates": [
    {
      "debate_id": "uuid",
      "motion": "...",
      "date": "2025-01-20",
      "speeches_count": 6,
      "speeches": [...]
    }
  ],
  "total": 42,
  "page": 1
}
```

### 3.6 Prompt Management (Admin)

#### `GET /api/prompts`
**Description**: Get all active prompt templates
**Response**:
```json
{
  "prompts": [
    {
      "id": "uuid",
      "name": "Primary Scoring Rubric",
      "student_level": "primary",
      "template_type": "scoring",
      "prompt_text": "...",
      "version": 3
    }
  ]
}
```

#### `POST /api/prompts`
**Description**: Create new prompt template
**Request**:
```json
{
  "name": "Secondary Qualitative Feedback",
  "student_level": "secondary",
  "template_type": "qualitative",
  "prompt_text": "Analyze the following debate speech transcript..."
}
```

#### `PUT /api/prompts/{id}`
**Description**: Update prompt (creates new version, keeps old)

---

## 4. Processing Pipeline

### 4.1 Speech Processing Workflow

```
Speech Upload
     │
     ▼
┌──────────────────┐
│ Save to VPS      │
│ /var/storage/... │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Queue Job        │
│ TranscribeJob    │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────┐
│ Transcription Worker     │
│ - Call OpenAI API        │
│ - Store transcript       │
│ - Update status          │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Queue Job                │
│ FeedbackGenerationJob    │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Feedback Worker          │
│ - Get all prior speeches │
│ - Build context          │
│ - Call Gemini API        │
│ - Parse scores           │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Google Docs Worker       │
│ - Create doc from template│
│ - Populate with feedback │
│ - Set permissions        │
│ - Get shareable link     │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Update Database          │
│ - Set feedback_status    │
│ - Store google_doc_url   │
│ - Notify frontend        │
└──────────────────────────┘
```

### 4.2 Job Queue Configuration

**Queue Name**: `debate-processing`

**Jobs**:
1. `transcribe-speech`
   - Priority: High
   - Retry: 3 attempts
   - Timeout: 5 minutes

2. `generate-feedback`
   - Priority: High
   - Retry: 3 attempts
   - Timeout: 10 minutes

3. `create-google-doc`
   - Priority: Medium
   - Retry: 3 attempts
   - Timeout: 3 minutes

4. `cleanup-storage`
   - Priority: Low
   - Retry: 2 attempts
   - Timeout: 5 minutes

---

## 5. External API Integration

### 5.1 OpenAI Transcription

**Endpoint**: `https://api.openai.com/v1/audio/transcriptions`
**Model**: `whisper-1` (or gpt-4o-mini if available for transcription)
**Request**:
```javascript
const formData = new FormData();
formData.append('file', audioFileStream);
formData.append('model', 'whisper-1');
formData.append('language', 'en');
formData.append('response_format', 'verbose_json');

const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
  },
  body: formData
});
```

**Response Processing**:
- Extract `text` (full transcript)
- Calculate word count
- Calculate speaking rate (words per minute)
- Store in `transcripts` table

### 5.2 Google Gemini Feedback Generation

**Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`
**Models**:
- Primary: `gemini-2.0-flash-exp` (fast, cost-effective)
- Secondary: `gemini-exp-1206` (higher quality, slower)

**Request Structure**:
```javascript
{
  "contents": [{
    "parts": [{
      "text": `${PROMPT_TEMPLATE}

DEBATE MOTION: ${motion}
SPEAKER POSITION: ${position}
STUDENT LEVEL: ${level}

PREVIOUS SPEECHES CONTEXT:
${priorTranscripts.join('\n\n')}

CURRENT SPEECH TRANSCRIPT:
${currentTranscript}

Please provide scores and feedback according to the rubrics.`
    }]
  }],
  "generationConfig": {
    "temperature": 0.4,
    "topP": 0.95,
    "maxOutputTokens": 8192
  }
}
```

**Response Parsing**:
- Extract JSON with scores and feedback
- Validate against rubrics
- Store in `feedback` table

### 5.3 Alternative LLM Providers

**Configuration**:
```javascript
const LLM_PROVIDERS = {
  gemini_flash: {
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/...',
    model: 'gemini-2.0-flash-exp'
  },
  gemini_pro: {
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/...',
    model: 'gemini-exp-1206'
  },
  claude: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-sonnet-20241022'
  },
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini'
  },
  grok: {
    endpoint: 'https://api.x.ai/v1/chat/completions',
    model: 'grok-beta'
  }
};
```

### 5.4 Google Docs API

**Create Document**:
```javascript
const docs = google.docs({ version: 'v1', auth });
const doc = await docs.documents.create({
  requestBody: {
    title: `Feedback - ${speakerName} - ${motion.substring(0, 50)}`
  }
});
```

**Populate Content**:
```javascript
await docs.documents.batchUpdate({
  documentId: doc.data.documentId,
  requestBody: {
    requests: [
      {
        insertText: {
          location: { index: 1 },
          text: `Student Name: ${speakerName}\n\n...`
        }
      },
      {
        insertTable: {
          location: { index: 100 },
          rows: rubrics.length + 1,
          columns: 3
        }
      }
      // ... more formatting requests
    ]
  }
});
```

**Set Permissions**:
```javascript
const drive = google.drive({ version: 'v3', auth });
await drive.permissions.create({
  fileId: doc.data.documentId,
  requestBody: {
    role: 'writer',
    type: 'user',
    emailAddress: teacherEmail
  }
});

await drive.permissions.create({
  fileId: doc.data.documentId,
  requestBody: {
    role: 'reader',
    type: 'anyone'
  }
});
```

### 5.5 Google Drive Storage

**Upload Audio File** (for long-term storage):
```javascript
const drive = google.drive({ version: 'v3', auth });
const fileMetadata = {
  name: audioFileName,
  parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]
};
const media = {
  mimeType: 'audio/m4a',
  body: fs.createReadStream(localFilePath)
};

const file = await drive.files.create({
  requestBody: fileMetadata,
  media: media,
  fields: 'id, webViewLink'
});
```

---

## 6. File Storage Management

### 6.1 Local VPS Storage

**Directory Structure**:
```
/var/storage/debate-recordings/
  ├── {debate_id}/
  │   ├── {speech_id}_original.m4a
  │   ├── {speech_id}_compressed.m4a (optional)
  │   └── metadata.json
```

**Storage Policy**:
- Keep files locally until processing complete
- After 2 debates by same teacher, trigger cleanup job
- Cleanup job moves files to Google Drive then deletes local copies

**Cleanup Worker**:
```javascript
// Triggered after every 2nd debate completion per teacher
async function cleanupOldDebates(teacherId) {
  const oldDebates = await getDebatesOlderThanN(teacherId, 2);

  for (const debate of oldDebates) {
    // 1. Upload all speeches to Google Drive
    await uploadDebateToGoogleDrive(debate.id);

    // 2. Update database with Drive URLs
    await updateSpeechStorageUrls(debate.id);

    // 3. Delete local files
    await deleteLocalDebateFiles(debate.id);
  }
}
```

### 6.2 Google Drive Organization

**Folder Structure**:
```
Debate Recordings/
  ├── 2025/
  │   ├── January/
  │   │   ├── debate_{id}/
  │   │   │   ├── audio_files/
  │   │   │   └── feedback_docs/
```

---

## 7. Prompt Engineering Framework

### 7.1 Prompt Template Structure

**File**: `prompts/feedback_template_v1.txt`

```
You are an expert debate coach providing feedback to a {STUDENT_LEVEL} level student.

DEBATE MOTION: {MOTION}
SPEAKER POSITION: {POSITION} (e.g., Prop 1, Opp 2)
SPEECH DURATION: {DURATION} seconds

ROLE REQUIREMENTS FOR {POSITION}:
{ROLE_DESCRIPTION}

CONTEXT - PREVIOUS SPEECHES:
{PRIOR_SPEECHES_SUMMARY}

CURRENT SPEECH TRANSCRIPT:
{TRANSCRIPT}

---

Please analyze this speech according to the following rubrics and provide:

1. SCORES (use "NA" if not applicable, or rate 1-5):
{RUBRIC_LIST}

2. QUALITATIVE FEEDBACK (3-5 bullet points per category):
   - Argumentation
   - Delivery & Style
   - Engagement & Rebuttal
   - Role Fulfillment

FORMAT YOUR RESPONSE AS JSON:
{
  "scores": {
    "argumentation": 1-5 or "NA",
    "delivery": 1-5 or "NA",
    ...
  },
  "feedback": {
    "argumentation": ["point 1", "point 2", ...],
    "delivery": ["point 1", ...],
    ...
  }
}
```

### 7.2 Role-Specific Context

**Example for "Prop 1"**:
```
ROLE_DESCRIPTION for Prop 1:
- Establish the core definition and framework for the motion
- Present the first 1-2 main arguments
- Set the tone and direction for your team
- No rebuttal required (first speaker)
```

**Example for "Opp 2"**:
```
ROLE_DESCRIPTION for Opp 2:
- Refute Prop 1's arguments (direct clash)
- Address Prop 2's points if time permits
- Present 1-2 new Opposition arguments
- Support and extend Opp 1's case
```

### 7.3 Rubric Definitions Format

**File**: `prompts/rubrics_primary.json`
```json
{
  "rubrics": [
    {
      "name": "Argumentation",
      "description": "Clarity of claims, use of reasoning and examples",
      "scoring": "1-5",
      "criteria": {
        "5": "Clear claims with strong reasoning and relevant examples",
        "3": "Some clear claims but weak reasoning or examples",
        "1": "Unclear claims with little to no reasoning"
      }
    },
    {
      "name": "Delivery",
      "description": "Speaking pace, volume, clarity, eye contact",
      "scoring": "1-5"
    }
  ]
}
```

### 7.4 Prompt Versioning & Testing

**Process for Prompt Updates**:
1. Admin creates new prompt version in database
2. Mark as `is_active: false` initially
3. Test on sample speeches
4. Compare results with previous version
5. If satisfactory, set `is_active: true` and deactivate old version

**A/B Testing** (future):
- Run both prompt versions on same speech
- Compare quality manually
- Track which version produces better feedback

---

## 8. Google Docs Template

### 8.1 Primary Level Template

```
╔══════════════════════════════════════════════════════════╗
║           DEBATE FEEDBACK REPORT - PRIMARY LEVEL          ║
╚══════════════════════════════════════════════════════════╝

Student Name: {SPEAKER_NAME}
Date: {DATE}
Debate Motion: {MOTION}
Speaker Position: {POSITION}
Speech Duration: {DURATION}

─────────────────────────────────────────────────────────────

SCORES (1 = Needs Improvement, 5 = Excellent, NA = Not Applicable)

┌─────────────────────────┬────────┬──────────────────────┐
│ Rubric Category         │ Score  │ Weight               │
├─────────────────────────┼────────┼──────────────────────┤
│ Argumentation           │  {S1}  │  ●●●●●               │
│ Delivery & Clarity      │  {S2}  │  ●●●●●               │
│ Structure               │  {S3}  │  ●●●●○               │
│ Engagement              │  {S4}  │  ●●●○○               │
│ Role Fulfillment        │  {S5}  │  ●●●●○               │
└─────────────────────────┴────────┴──────────────────────┘

─────────────────────────────────────────────────────────────

TEACHER'S COMMENTS

✦ ARGUMENTATION
{FEEDBACK_BULLET_POINTS_1}

✦ DELIVERY & STYLE
{FEEDBACK_BULLET_POINTS_2}

✦ ENGAGEMENT & REBUTTAL
{FEEDBACK_BULLET_POINTS_3}

✦ ROLE FULFILLMENT
{FEEDBACK_BULLET_POINTS_4}

─────────────────────────────────────────────────────────────

Generated by Capstone Debate Feedback System
Powered by AI Analysis | Reviewed by {TEACHER_NAME}
```

### 8.2 Secondary Level Template

Similar structure but with additional rubrics:
- Evidence & Examples
- Rebuttal Quality
- Strategic Thinking
- Speaking Rate & Filler Words

---

## 9. Implementation Plan

### Phase 1: Core Infrastructure ✓
- [x] Set up Node.js + TypeScript + Express
- [x] Set up PostgreSQL database
- [x] Create database schema
- [x] Set up Redis + Bull queue
- [x] Basic API endpoints (auth, debates, speeches)

### Phase 2: File Upload & Storage
- [ ] Implement multipart file upload
- [ ] Local VPS storage management
- [ ] Google Drive integration
- [ ] Cleanup worker

### Phase 3: Transcription Pipeline
- [ ] OpenAI API integration
- [ ] Transcription worker
- [ ] Store transcripts in database
- [ ] Error handling & retries

### Phase 4: Feedback Generation
- [ ] Prompt template system
- [ ] Gemini API integration
- [ ] Context building (prior speeches)
- [ ] JSON response parsing
- [ ] Multi-LLM provider support

### Phase 5: Google Docs
- [ ] Google Docs API setup
- [ ] Template implementation
- [ ] Document generation worker
- [ ] Permission management
- [ ] Link sharing

### Phase 6: Schedule & Auto-population
- [ ] Schedule CRUD APIs
- [ ] Current schedule lookup logic
- [ ] Student management APIs

### Phase 7: Testing & Refinement
- [ ] End-to-end testing
- [ ] Prompt refinement based on output quality
- [ ] Performance optimization
- [ ] Error monitoring

---

## 10. Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/debate_feedback
REDIS_URL=redis://localhost:6379

# Storage
STORAGE_PATH=/var/storage/debate-recordings
GOOGLE_DRIVE_FOLDER_ID=your_folder_id

# API Keys
OPENAI_API_KEY=sk-...
GOOGLE_GEMINI_API_KEY=...
ANTHROPIC_API_KEY=sk-ant-...
GROK_API_KEY=xai-...

# Google Cloud (for Docs & Drive)
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----

# JWT
JWT_SECRET=your_secret_key_here
JWT_EXPIRY=7d

# App Config
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=https://your-frontend-domain.com
```

---

## 11. Security Considerations

1. **Authentication**: JWT tokens with short expiry, refresh token rotation
2. **File Upload**: Validate file types, max size limits (100MB), virus scanning
3. **Rate Limiting**: 100 requests/minute per user, 10 uploads/minute
4. **API Keys**: Store in environment, never commit to repo
5. **Database**: Parameterized queries, input validation
6. **CORS**: Whitelist only frontend domain
7. **HTTPS**: Enforce SSL/TLS for all endpoints

---

## 12. Monitoring & Logging

**Metrics to Track**:
- Speech processing time (transcription + feedback)
- API error rates (OpenAI, Gemini, Google APIs)
- Queue job failures
- Storage usage
- Cost per speech (API calls)

**Logging**:
- Use Winston or Pino for structured logging
- Log levels: error, warn, info, debug
- Store logs in `/var/log/debate-backend/`
- Rotate daily, keep 30 days

---

## 13. Cost Estimation

**Per Speech (8 minutes, ~1200 words transcript)**:
- OpenAI Whisper: ~$0.02 (audio transcription)
- Gemini Flash: ~$0.01 (1M tokens context, ~5K output)
- Google Docs API: Free
- Google Drive Storage: Negligible

**Total per speech**: ~$0.03
**Monthly (30 debates × 6 speeches)**: ~$5.40
**Saturday heavy load (30 debates)**: ~$5.40

**Total estimated monthly cost**: $15-25 (including buffer)

---

## End of Backend Specification
