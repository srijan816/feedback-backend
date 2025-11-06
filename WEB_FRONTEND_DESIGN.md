# Web-Based Teacher Portal - Comprehensive Design Document

## Executive Summary

This document outlines the design for a web-based frontend that provides teachers with personalized portals for managing debate feedback. Each teacher has a unique URL where they can:
- Write real-time notes during debates
- Review AI-generated feedback
- Edit rubric scores and qualitative feedback
- Approve final feedback (triggering DOCX conversion)
- Access historical feedback records

---

## 1. SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    WEB BROWSER                               │
│  Teacher Portal UI (React/Vue/Vanilla JS + WebSocket)       │
└────────────┬────────────────────────────────────────────────┘
             │
             │ HTTP/HTTPS + WebSocket
             │
┌────────────▼────────────────────────────────────────────────┐
│                EXPRESS API GATEWAY                           │
│  - Existing Routes                                           │
│  - NEW: /srijan, /tamkeen, /mai, /saurav, /jami, /naveen    │
│  - NEW: /api/teachers/:teacherName/...                      │
│  - WebSocket Server (Socket.io)                             │
└────────────┬────────────────────────────────────────────────┘
             │
             ├───────────────┬─────────────────┬───────────────┐
             │               │                 │               │
        ┌────▼────┐    ┌────▼────┐      ┌────▼────┐    ┌────▼────┐
        │PostgreSQL│    │  Redis  │      │  Bull   │    │ Google  │
        │   DB     │    │  Cache  │      │  Queue  │    │ APIs    │
        └──────────┘    └─────────┘      └─────────┘    └─────────┘
```

### Key Components

1. **Teacher Portal Routes** - Unique URL per teacher
2. **Real-Time WebSocket** - Live updates during debates
3. **Feedback Draft System** - Store edits before approval
4. **Approval Workflow** - Multi-stage feedback lifecycle
5. **DOCX Generator** - Convert approved feedback to Word docs

---

## 2. TEACHER PORTAL LAYOUT

### 2.1 Main Teacher Portal Page (`/:teacherName`)

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo]    Teacher Portal - Srijan              [Logout] [⚙️]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  📝 ACTIVE DEBATES (Live Note-Taking)                    │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │  Debate: THW ban social media for minors        │    │   │
│  │  │  Status: 🔴 IN PROGRESS (3/8 speeches done)     │    │   │
│  │  │  Started: 2:15 PM                               │    │   │
│  │  │                                                  │    │   │
│  │  │  [View Live Scoreboard] [Write Notes]           │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │                                                          │   │
│  │  + No active debates                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ⏳ PENDING REVIEW (Feedback awaiting approval)         │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │  Motion: THW abolish the UN Security Council    │   │   │
│  │  │  Student: Arjun Mehta (PM)                      │   │   │
│  │  │  Generated: Nov 4, 3:45 PM (2 hours ago)        │   │   │
│  │  │  Status: 🟡 DRAFT (3 edits)                     │   │   │
│  │  │                                                  │   │   │
│  │  │  [Review & Edit] [Approve ✓] [Discard]         │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  │  [2 more pending...]                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ✅ FEEDBACK HISTORY (Approved & Delivered)             │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  Search: [_______________] Filter: [All Debates ▼]      │   │
│  │                                                          │   │
│  │  Nov 3, 2025 - THW ban fossil fuels by 2030             │   │
│  │    → 8 speeches | All approved | [📄 Download ZIP]      │   │
│  │                                                          │   │
│  │  Oct 29, 2025 - THW allow genetic engineering           │   │
│  │    → 6 speeches | All approved | [📄 Download ZIP]      │   │
│  │                                                          │   │
│  │  [Load more...]                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Live Note-Taking Interface (During Debate)

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Portal         Debate: THW ban social media          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Progress: ████████░░░░░░░░  4/8 speeches completed             │
│                                                                  │
│  ┌──────────────────────┐  ┌─────────────────────────────────┐ │
│  │  CURRENT SPEAKER     │  │  YOUR NOTES                     │ │
│  ├──────────────────────┤  ├─────────────────────────────────┤ │
│  │  👤 Priya Sharma     │  │  ┌───────────────────────────┐  │ │
│  │  Team: Opposition    │  │  │ Speech 1 (Arjun - PM):    │  │ │
│  │  Position: LO        │  │  │ - Strong hook but rushed  │  │ │
│  │  Status: 🎤 Speaking │  │  │ - Need more examples      │  │ │
│  │                      │  │  │ - Good eye contact        │  │ │
│  │  🔴 Recording...     │  │  │                           │  │ │
│  │  Duration: 3:42      │  │  └───────────────────────────┘  │ │
│  │                      │  │                                  │ │
│  │  [End Speech]        │  │  ┌───────────────────────────┐  │ │
│  └──────────────────────┘  │  │ Speech 2 (Maya - DPM):    │  │ │
│                             │  │ [Click to add notes...]   │  │ │
│  ┌──────────────────────┐  │  └───────────────────────────┘  │ │
│  │  SPEAKERS QUEUE      │  │                                  │ │
│  ├──────────────────────┤  │  ✨ AI Feedback will be ready   │ │
│  │  ✅ Arjun (PM)       │  │     after each speech ends       │ │
│  │  ✅ Maya (DPM)       │  │                                  │ │
│  │  ✅ Dev (MG)         │  │  📝 Your notes are auto-saved   │ │
│  │  🎤 Priya (LO)       │  │     every 3 seconds             │ │
│  │  ⏳ Rohan (DLO)      │  │                                  │ │
│  │  ⏳ Kavya (MO)       │  │  [Export All Notes]             │ │
│  │  ⏳ Aarav (PMR)      │  └─────────────────────────────────┘ │
│  │  ⏳ Zara (LOR)       │                                       │
│  └──────────────────────┘                                       │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  🔔 LIVE UPDATES                                          │  │
│  │  • 3:45 PM - Priya's speech started                       │  │
│  │  • 3:42 PM - Dev's feedback ready! [Review Now]           │  │
│  │  • 3:35 PM - Maya's speech transcribed                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Feedback Review & Edit Interface

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back to Portal        Feedback Review - Arjun Mehta (PM)     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Debate: THW abolish the UN Security Council                    │
│  Generated: Nov 4, 2025 3:45 PM                                 │
│  Status: 🟡 DRAFT (Last edited 5 mins ago)                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ACTIONS                                                 │   │
│  │  [💾 Save Edits]  [✓ Approve & Generate DOCX]  [🔄 Reset] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  📊 RUBRIC SCORES (Click to edit)                        │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                           │   │
│  │  Time Management                    [4 ▼]  ⭐⭐⭐⭐☆     │   │
│  │  POI Engagement                     [5 ▼]  ⭐⭐⭐⭐⭐    │   │
│  │  Delivery & Style                   [3 ▼]  ⭐⭐⭐☆☆     │   │
│  │  Argument Completeness              [4 ▼]  ⭐⭐⭐⭐☆     │   │
│  │  Theory Application                 [3 ▼]  ⭐⭐⭐☆☆     │   │
│  │  Rebuttal Effectiveness             [NA ▼] (First speaker)  │
│  │  Teamwork & Extension               [NA ▼] (First speaker)  │
│  │  Feedback Implementation            [NA ▼] (First debate)   │
│  │                                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  📝 QUALITATIVE FEEDBACK (Click to edit)                 │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                           │   │
│  │  ▼ Time Management (Score: 4/5)                          │   │
│  │     ✏️ [Edit Mode: ON]                                   │   │
│  │     ┌──────────────────────────────────────────────┐    │   │
│  │     │ • You managed your time effectively, finishing│    │   │
│  │     │   with 10 seconds remaining, which shows good │    │   │
│  │     │   preparation and pacing.                     │    │   │
│  │     │                                                │    │   │
│  │     │ • Consider saving 30 seconds for a stronger   │    │   │
│  │     │   conclusion to reinforce your main points.   │    │   │
│  │     │                                                │    │   │
│  │     │ [+ Add Point] [✓ Save] [✕ Cancel]            │    │   │
│  │     └──────────────────────────────────────────────┘    │   │
│  │                                                           │   │
│  │  ▼ POI Engagement (Score: 5/5)                           │   │
│  │     [Edit] [Delete]                                      │   │
│  │     • Excellent POI handling - you took 3 POIs...        │   │
│  │     • Your responses were direct and confident...        │   │
│  │                                                           │   │
│  │  [Expand all 8 rubrics...]                               │   │
│  │                                                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🎯 STRATEGIC OVERVIEW                                   │   │
│  │  [Edit]                                                  │   │
│  │                                                           │   │
│  │  Hook & Signposting:                                     │   │
│  │  Your opening hook about climate urgency was compelling, │   │
│  │  and you clearly outlined 3 substantives...              │   │
│  │                                                           │   │
│  │  [Show full...]                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  📎 ADDITIONAL NOTES (Your manual notes)                 │   │
│  │  ┌───────────────────────────────────────────────────┐  │   │
│  │  │ During the debate I noticed:                      │  │   │
│  │  │ - Great eye contact with judges                   │  │   │
│  │  │ - Needs to work on vocal variety                  │  │   │
│  │  │ - Strong chemistry with partner                   │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🎬 PLAYABLE MOMENTS (From transcript)                   │   │
│  │  [View Transcript with Timestamps]                       │   │
│  │                                                           │   │
│  │  🟢 Excellent (2:15) - "Security Council veto power..."  │   │
│  │  🔴 Weak (4:30) - "Um... the... economic impacts are..." │   │
│  │  🟡 Gap (5:45) - Long pause before rebuttal              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  📤 FINAL APPROVAL                                       │   │
│  │                                                           │   │
│  │  ⚠️ Once approved, this feedback will:                   │   │
│  │     1. Be converted to a formatted DOCX file             │   │
│  │     2. Be locked from further editing                    │   │
│  │     3. Be ready for download/sharing with student        │   │
│  │                                                           │   │
│  │  [Cancel] [✓ APPROVE & GENERATE DOCX]                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. DATABASE SCHEMA CHANGES

### 3.1 New Tables

#### `feedback_drafts` - Store edited feedback before approval

```sql
CREATE TABLE feedback_drafts (
    id SERIAL PRIMARY KEY,
    feedback_id INTEGER REFERENCES feedback(id) ON DELETE CASCADE,
    teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    -- Edited scores (JSONB allows flexible storage)
    edited_scores JSONB,
    -- Example: {"Time Management": 5, "POI Engagement": 4, ...}

    -- Edited qualitative feedback
    edited_qualitative_feedback JSONB,
    -- Example: {"Time Management": ["Point 1 edited", "New point 2"], ...}

    -- Edited strategic overview
    edited_strategic_overview JSONB,

    -- Teacher's manual notes
    teacher_notes TEXT,

    -- Edit tracking
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(feedback_id) -- Only one draft per feedback
);

CREATE INDEX idx_feedback_drafts_feedback ON feedback_drafts(feedback_id);
CREATE INDEX idx_feedback_drafts_teacher ON feedback_drafts(teacher_id);
```

#### `debate_notes` - Real-time notes during debate

```sql
CREATE TABLE debate_notes (
    id SERIAL PRIMARY KEY,
    debate_id INTEGER REFERENCES debates(id) ON DELETE CASCADE,
    teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    -- Per-speech notes
    speech_id INTEGER REFERENCES speeches(id) ON DELETE CASCADE,
    speaker_name VARCHAR(100),

    -- Note content
    note_text TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_debate_notes_debate ON debate_notes(debate_id);
CREATE INDEX idx_debate_notes_speech ON debate_notes(speech_id);
CREATE INDEX idx_debate_notes_teacher ON debate_notes(teacher_id);
```

#### `feedback_approvals` - Track approval workflow

```sql
CREATE TABLE feedback_approvals (
    id SERIAL PRIMARY KEY,
    feedback_id INTEGER REFERENCES feedback(id) ON DELETE CASCADE,
    teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    -- Approval status
    status VARCHAR(20) DEFAULT 'draft',
    -- Values: 'draft', 'pending_review', 'approved', 'rejected'

    -- DOCX file path after approval
    docx_file_path VARCHAR(500),
    docx_url TEXT, -- Public URL if uploaded to cloud

    -- Timestamps
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(feedback_id)
);

CREATE INDEX idx_feedback_approvals_status ON feedback_approvals(status);
CREATE INDEX idx_feedback_approvals_teacher ON feedback_approvals(teacher_id);
```

### 3.2 Modify Existing Tables

#### Update `feedback` table

```sql
-- Add approval status tracking
ALTER TABLE feedback ADD COLUMN approval_status VARCHAR(20) DEFAULT 'pending_review';
ALTER TABLE feedback ADD COLUMN approved_at TIMESTAMP;
ALTER TABLE feedback ADD COLUMN docx_url TEXT;

CREATE INDEX idx_feedback_approval_status ON feedback(approval_status);
```

#### Update `speeches` table

```sql
-- Add notes count for UI display
ALTER TABLE speeches ADD COLUMN teacher_notes_count INTEGER DEFAULT 0;
```

---

## 4. API ENDPOINTS

### 4.1 Teacher Portal Routes (Web Pages)

```javascript
// Serve teacher-specific portal pages
GET /:teacherName              // Main portal dashboard
GET /:teacherName/debate/:debateId/live  // Live note-taking interface
GET /:teacherName/feedback/:feedbackId/review  // Review & edit interface
```

### 4.2 Teacher Portal API Routes

#### **Authentication & Profile**

```javascript
GET /api/teachers/:teacherName/profile
Response: {
  id: 1,
  name: "srijan",
  email: "srijan@example.com",
  total_debates: 45,
  pending_reviews: 3,
  approved_feedbacks: 120
}
```

#### **Dashboard Data**

```javascript
GET /api/teachers/:teacherName/dashboard
Response: {
  active_debates: [
    {
      id: 10,
      motion: "THW ban social media",
      status: "in_progress",
      speeches_completed: 3,
      total_speeches: 8,
      started_at: "2025-11-05T14:15:00Z"
    }
  ],
  pending_reviews: [
    {
      feedback_id: 42,
      student_name: "Arjun Mehta",
      position: "PM",
      motion: "THW abolish UN Security Council",
      generated_at: "2025-11-04T15:45:00Z",
      edit_count: 3,
      status: "draft"
    }
  ],
  recent_approved: [...]
}
```

#### **Real-Time Notes**

```javascript
POST /api/teachers/:teacherName/debates/:debateId/notes
Body: {
  speech_id: 15,
  speaker_name: "Arjun Mehta",
  note_text: "Strong hook but rushed conclusion"
}
Response: {
  note_id: 123,
  created_at: "2025-11-05T14:30:00Z"
}

GET /api/teachers/:teacherName/debates/:debateId/notes
Response: {
  notes: [
    {
      note_id: 123,
      speech_id: 15,
      speaker_name: "Arjun Mehta",
      note_text: "Strong hook but rushed conclusion",
      created_at: "2025-11-05T14:30:00Z"
    },
    ...
  ]
}

PUT /api/teachers/:teacherName/notes/:noteId
Body: {
  note_text: "Updated note content"
}

DELETE /api/teachers/:teacherName/notes/:noteId
```

#### **Feedback Editing**

```javascript
GET /api/teachers/:teacherName/feedback/:feedbackId/draft
Response: {
  feedback_id: 42,
  original: {
    scores: {...},
    qualitative_feedback: {...},
    strategic_overview: {...}
  },
  draft: {
    edited_scores: {...},
    edited_qualitative_feedback: {...},
    edited_strategic_overview: {...},
    teacher_notes: "Great eye contact...",
    version: 3,
    updated_at: "2025-11-05T14:00:00Z"
  },
  approval_status: "draft"
}

POST /api/teachers/:teacherName/feedback/:feedbackId/draft
Body: {
  edited_scores: {
    "Time Management": 5,
    "POI Engagement": 4,
    ...
  },
  edited_qualitative_feedback: {
    "Time Management": [
      "Edited point 1",
      "New point 2"
    ],
    ...
  },
  edited_strategic_overview: {
    "hook_and_signposting": "Updated overview...",
    ...
  },
  teacher_notes: "Additional manual notes..."
}
Response: {
  draft_id: 55,
  version: 4,
  saved_at: "2025-11-05T14:05:00Z"
}

PUT /api/teachers/:teacherName/feedback/:feedbackId/draft
Body: { /* same as POST */ }
```

#### **Approval Workflow**

```javascript
POST /api/teachers/:teacherName/feedback/:feedbackId/approve
Response: {
  approval_id: 77,
  status: "approved",
  docx_generation_job_id: "docx-gen-123",
  message: "Feedback approved. DOCX generation in progress..."
}

GET /api/teachers/:teacherName/feedback/:feedbackId/approval-status
Response: {
  status: "approved",
  docx_url: "https://storage.example.com/feedback/arjun-pm-nov4.docx",
  approved_at: "2025-11-05T14:10:00Z"
}

POST /api/teachers/:teacherName/feedback/:feedbackId/reject
Body: {
  reason: "Needs more work on rebuttals section"
}
Response: {
  status: "rejected",
  rejected_at: "2025-11-05T14:12:00Z"
}
```

#### **Feedback History**

```javascript
GET /api/teachers/:teacherName/feedback/history
Query params:
  - page: 1
  - limit: 20
  - status: "approved" | "draft" | "all"
  - search: "motion keywords"
  - date_from: "2025-10-01"
  - date_to: "2025-11-05"

Response: {
  feedbacks: [
    {
      feedback_id: 40,
      student_name: "Zara Khan",
      position: "LO",
      motion: "THW ban fossil fuels",
      debate_date: "2025-11-03",
      status: "approved",
      approved_at: "2025-11-03T18:30:00Z",
      docx_url: "https://..."
    },
    ...
  ],
  pagination: {
    total: 120,
    page: 1,
    limit: 20,
    total_pages: 6
  }
}
```

#### **Bulk Export**

```javascript
GET /api/teachers/:teacherName/debates/:debateId/export
Query params:
  - format: "zip" | "pdf" | "docx"

Response: {
  download_url: "https://storage.example.com/exports/debate-10-all-feedback.zip",
  expires_at: "2025-11-05T20:00:00Z"
}
```

### 4.3 WebSocket Events (Real-Time Updates)

```javascript
// Client connects
Socket.io connection to /teachers/:teacherName

// Events emitted by server
events: {
  "debate:started": {
    debate_id: 10,
    motion: "THW ban social media",
    started_at: "2025-11-05T14:15:00Z"
  },

  "speech:started": {
    speech_id: 15,
    speaker_name: "Arjun Mehta",
    position: "PM",
    started_at: "2025-11-05T14:16:00Z"
  },

  "speech:completed": {
    speech_id: 15,
    duration_seconds: 420,
    completed_at: "2025-11-05T14:23:00Z"
  },

  "transcription:ready": {
    speech_id: 15,
    word_count: 650,
    speaking_rate: 155
  },

  "feedback:ready": {
    feedback_id: 42,
    speech_id: 15,
    status: "pending_review",
    generated_at: "2025-11-05T14:25:00Z"
  },

  "docx:ready": {
    feedback_id: 42,
    docx_url: "https://...",
    generated_at: "2025-11-05T14:27:00Z"
  }
}

// Events emitted by client
client_events: {
  "note:save": {
    debate_id: 10,
    speech_id: 15,
    note_text: "Great opening hook"
  }
}
```

---

## 5. DATA FLOW DIAGRAMS

### 5.1 Real-Time Note-Taking Flow

```
┌─────────┐         ┌─────────┐         ┌──────────┐
│ Teacher │────────>│ Browser │────────>│ WebSocket│
│ Types   │ Keypress│   UI    │  Emit   │  Server  │
│  Note   │         │         │         │          │
└─────────┘         └─────────┘         └─────┬────┘
                                               │
                                               │ Save to DB
                                               ▼
                                        ┌──────────────┐
                                        │ debate_notes │
                                        │    table     │
                                        └──────────────┘
```

### 5.2 Feedback Edit & Approval Flow

```
┌──────────────┐
│  AI-Generated│
│   Feedback   │
│   (Ready)    │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Teacher Reviews  │
│  in Web Portal   │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐      ┌─────────────────┐
│ Teacher Edits    │─────>│ Save to         │
│ Scores/Text      │      │ feedback_drafts │
└──────┬───────────┘      └─────────────────┘
       │
       │ Multiple edits (version 1, 2, 3...)
       │
       ▼
┌──────────────────┐
│ Teacher Clicks   │
│ "APPROVE"        │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐      ┌─────────────────┐
│ Update approval  │─────>│ feedback_approvals
│ status = approved│      │ table           │
└──────┬───────────┘      └─────────────────┘
       │
       ▼
┌──────────────────┐
│ Trigger DOCX     │
│ Generation Queue │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐      ┌─────────────────┐
│ Generate DOCX    │─────>│ Upload to       │
│ with final edits │      │ Storage/Drive   │
└──────┬───────────┘      └────────┬────────┘
       │                           │
       └─────────┬─────────────────┘
                 │
                 ▼
         ┌───────────────┐
         │ Update docx_url
         │ in feedback   │
         │ table         │
         └───────┬───────┘
                 │
                 ▼
         ┌───────────────┐
         │ Notify teacher│
         │ via WebSocket │
         └───────────────┘
```

### 5.3 Full System Flow (Debate → Approved Feedback)

```
┌──────────────┐
│ iOS App      │
│ Uploads      │
│ Speech Audio │
└──────┬───────┘
       │
       ▼
┌──────────────────┐      ┌─────────────────┐
│ Transcription    │─────>│ WebSocket:      │──> Teacher Portal
│ Queue (10x)      │      │ transcription   │    Updates Live
└──────┬───────────┘      │ ready           │
       │                  └─────────────────┘
       ▼
┌──────────────────┐      ┌─────────────────┐
│ Feedback         │─────>│ WebSocket:      │──> Teacher Portal
│ Queue (10x)      │      │ feedback ready  │    Shows Notification
└──────┬───────────┘      └─────────────────┘
       │
       │ Status = "pending_review"
       │
       ▼
┌──────────────────────────────────────────┐
│ Teacher Portal: Pending Review Section   │
│ - Teacher sees new feedback               │
│ - Clicks "Review & Edit"                  │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Feedback Review Interface                 │
│ - Edit scores, text, add notes            │
│ - Save drafts multiple times              │
│ - Preview final output                    │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Teacher Clicks "APPROVE & GENERATE DOCX"  │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────┐      ┌─────────────────┐
│ DOCX Generation  │─────>│ WebSocket:      │──> Teacher Portal
│ Queue (NEW)      │      │ docx ready      │    Shows Download Link
└──────┬───────────┘      └─────────────────┘
       │
       ▼
┌──────────────────┐
│ Final DOCX       │
│ Available for    │
│ Download         │
└──────────────────┘
```

---

## 6. COMPONENT BREAKDOWN

### 6.1 Frontend Components (React/Vue Structure)

```
src/
├── components/
│   ├── TeacherPortal/
│   │   ├── Dashboard.jsx              # Main portal page
│   │   ├── ActiveDebates.jsx          # Live debates section
│   │   ├── PendingReviews.jsx         # Feedback awaiting approval
│   │   ├── FeedbackHistory.jsx        # Past approved feedback
│   │   └── TeacherNav.jsx             # Navigation bar
│   │
│   ├── LiveDebate/
│   │   ├── DebateProgress.jsx         # Progress bar (3/8 speeches)
│   │   ├── CurrentSpeaker.jsx         # Active speaker widget
│   │   ├── SpeakersQueue.jsx          # Upcoming speakers list
│   │   ├── NotesEditor.jsx            # Real-time notes textarea
│   │   └── LiveUpdates.jsx            # WebSocket notifications
│   │
│   ├── FeedbackReview/
│   │   ├── FeedbackHeader.jsx         # Metadata + actions
│   │   ├── RubricScores.jsx           # Editable score dropdowns
│   │   ├── QualitativeFeedback.jsx    # Editable feedback points
│   │   ├── StrategicOverview.jsx      # Editable overview sections
│   │   ├── TeacherNotes.jsx           # Manual notes textarea
│   │   ├── PlayableMoments.jsx        # Transcript highlights
│   │   └── ApprovalButton.jsx         # Final approval CTA
│   │
│   └── Shared/
│       ├── LoadingSpinner.jsx
│       ├── ErrorBoundary.jsx
│       ├── Toast.jsx                  # Success/error notifications
│       └── ConfirmDialog.jsx          # Approval confirmation
│
├── hooks/
│   ├── useWebSocket.js                # WebSocket connection hook
│   ├── useFeedbackDraft.js            # Auto-save draft logic
│   ├── useDebateNotes.js              # Auto-save notes logic
│   └── useTeacherAuth.js              # Teacher authentication
│
├── services/
│   ├── api.js                         # Axios API client
│   ├── websocket.js                   # Socket.io client
│   └── docxGenerator.js               # DOCX generation utility
│
└── pages/
    ├── [teacherName].jsx              # Main portal route
    ├── [teacherName]/debate/[id].jsx  # Live debate page
    └── [teacherName]/feedback/[id].jsx # Feedback review page
```

### 6.2 Backend Components (Express.js Structure)

```
src/
├── routes/
│   ├── teacherPortal.routes.ts        # Teacher portal web routes
│   ├── teacherAPI.routes.ts           # Teacher API endpoints
│   ├── feedbackDraft.routes.ts        # Draft editing endpoints
│   └── debateNotes.routes.ts          # Real-time notes endpoints
│
├── controllers/
│   ├── teacherPortal.controller.ts    # Serve portal pages
│   ├── feedbackDraft.controller.ts    # Handle draft CRUD
│   ├── feedbackApproval.controller.ts # Handle approval workflow
│   └── debateNotes.controller.ts      # Handle notes CRUD
│
├── services/
│   ├── docxGenerator.service.ts       # Convert feedback to DOCX
│   ├── feedbackMerge.service.ts       # Merge original + edits
│   └── websocket.service.ts           # WebSocket event emitter
│
├── workers/
│   └── docxWorker.ts                  # NEW: DOCX generation queue worker
│
└── websockets/
    └── teacherPortal.socket.ts        # WebSocket event handlers
```

---

## 7. TECHNOLOGY STACK RECOMMENDATIONS

### 7.1 Frontend Options

**Option A: React + TypeScript (Recommended)**
- Component reusability
- Strong typing
- Large ecosystem
- Easy WebSocket integration with `socket.io-client`

**Option B: Vue 3 + TypeScript**
- Simpler learning curve
- Great for rapid development
- Built-in reactivity

**Option C: Vanilla JavaScript + Alpine.js**
- Lightweight
- No build process
- Fast initial load
- Good for simple UIs

### 7.2 Styling

- **Tailwind CSS** - Utility-first, rapid prototyping
- **Material UI** - Pre-built accessible components
- **Custom CSS** - Full control, smaller bundle

### 7.3 State Management

- **React Context API** - Built-in, no extra dependencies
- **Zustand** - Lightweight, simple API
- **Redux Toolkit** - If complex state logic needed

### 7.4 Real-Time Communication

- **Socket.io** (Already in stack) - Reliable WebSockets
- Fallback to long polling if WebSocket blocked

### 7.5 DOCX Generation

**Option A: docx.js (Node.js)**
```bash
npm install docx
```
- Pure JavaScript
- Programmatic document creation
- Full styling control

**Option B: docxtemplater**
```bash
npm install docxtemplater
```
- Template-based
- Easier for designers to create templates
- Less code

---

## 8. IMPLEMENTATION ROADMAP

### Phase 1: Database & API Foundation (Week 1)

**Tasks:**
1. Create new database tables (feedback_drafts, debate_notes, feedback_approvals)
2. Update existing tables with new columns
3. Write migration scripts
4. Create API endpoints for:
   - Teacher dashboard data
   - Feedback draft CRUD
   - Debate notes CRUD
   - Approval workflow

**Deliverable:** Working API that supports draft editing and approval

---

### Phase 2: Basic Web Portal (Week 2)

**Tasks:**
1. Set up frontend framework (React/Vue)
2. Create routing for teacher-specific URLs
3. Build Dashboard component
4. Build Pending Reviews component
5. Build Feedback History component
6. Implement basic authentication

**Deliverable:** Static portal showing debates and feedback (no editing yet)

---

### Phase 3: Feedback Review & Editing (Week 3)

**Tasks:**
1. Build Feedback Review interface
2. Implement editable rubric scores
3. Implement editable qualitative feedback
4. Add auto-save for drafts (every 3 seconds)
5. Add version tracking
6. Add preview mode

**Deliverable:** Fully functional feedback editing interface

---

### Phase 4: Real-Time Features (Week 4)

**Tasks:**
1. Set up Socket.io on backend
2. Create WebSocket event handlers
3. Implement live note-taking interface
4. Add real-time notifications
5. Add live debate progress tracking
6. Test WebSocket reconnection logic

**Deliverable:** Live note-taking and real-time updates working

---

### Phase 5: DOCX Generation & Approval (Week 5)

**Tasks:**
1. Implement DOCX generator with docx.js
2. Create DOCX generation queue worker
3. Design professional DOCX template
4. Implement approval workflow
5. Add download functionality
6. Add bulk export (ZIP all feedback)

**Deliverable:** Complete approval → DOCX workflow

---

### Phase 6: Polish & Testing (Week 6)

**Tasks:**
1. Add loading states and error handling
2. Implement toast notifications
3. Add confirmation dialogs
4. Optimize performance (lazy loading, caching)
5. Write integration tests
6. User acceptance testing with 2-3 teachers

**Deliverable:** Production-ready web portal

---

## 9. SECURITY CONSIDERATIONS

### 9.1 Authentication

- Use existing JWT auth system
- Teacher can only access their own URL
- Validate teacher name in URL matches JWT token
- Add CSRF protection for state-changing requests

### 9.2 Authorization

- Teachers can only edit their own students' feedback
- Admins can view all feedback
- Rate limiting on API endpoints (100 req/min per teacher)

### 9.3 Data Validation

- Validate rubric scores (1-5 or NA only)
- Sanitize HTML in feedback text (prevent XSS)
- Limit note length (max 5000 chars)
- Validate file uploads (audio only, max 100MB)

### 9.4 WebSocket Security

- Authenticate WebSocket connections with JWT
- Validate teacher_id before joining room
- Prevent cross-teacher event leakage

---

## 10. PERFORMANCE OPTIMIZATIONS

### 10.1 Frontend

- Lazy load components (React.lazy, code splitting)
- Debounce auto-save (save every 3s, not every keystroke)
- Cache dashboard data (5 min stale-while-revalidate)
- Infinite scroll for history (load 20 at a time)
- WebSocket connection pooling

### 10.2 Backend

- Index new database columns (feedback_id, teacher_id, status)
- Cache teacher dashboard data in Redis (5 min TTL)
- Use database connection pooling
- Paginate history queries
- Background DOCX generation (don't block API)

---

## 11. MOBILE RESPONSIVENESS

All layouts should be responsive:

```css
/* Breakpoints */
- Mobile: < 640px (1 column, stacked)
- Tablet: 640px - 1024px (2 columns)
- Desktop: > 1024px (3 columns, sidebars)
```

Mobile adaptations:
- Dashboard: Vertical cards instead of grid
- Feedback Review: Collapsible sections
- Live Notes: Full-screen editor
- Navigation: Hamburger menu

---

## 12. ACCESSIBILITY

- Semantic HTML (header, nav, main, section)
- ARIA labels for screen readers
- Keyboard navigation (tab order)
- Focus indicators
- Color contrast ratio 4.5:1 minimum
- Alt text for icons

---

## 13. ANALYTICS & MONITORING

Track key metrics:

- Teacher engagement (logins per week)
- Feedback edit rate (% of feedback edited)
- Average edits per feedback
- Approval time (generation → approval)
- DOCX download rate
- WebSocket connection stability
- API error rates

---

## 14. FUTURE ENHANCEMENTS

### Phase 7+ (Post-MVP)

1. **Student View Portal** - Students can view their own feedback
2. **Feedback Comparison** - Compare student's performance over time
3. **Analytics Dashboard** - Charts showing rubric trends
4. **Collaborative Editing** - Multiple teachers can review same debate
5. **Video Playback** - Sync video with transcript timestamps
6. **AI Re-generation** - Re-run AI with different prompts
7. **Feedback Templates** - Save common feedback snippets
8. **Export to PDF** - Alternative to DOCX
9. **Email Notifications** - Alert when feedback ready
10. **Mobile App** - Native iOS/Android teacher portal

---

## 15. DOCX TEMPLATE DESIGN

### Sample DOCX Structure

```
┌─────────────────────────────────────────────────────────┐
│  DEBATE FEEDBACK REPORT                                 │
│                                                          │
│  Student: Arjun Mehta                                   │
│  Position: Prime Minister (Government Opening)          │
│  Motion: THW abolish the UN Security Council            │
│  Date: November 4, 2025                                 │
│  Teacher: Srijan                                        │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  RUBRIC SCORES                                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────┬────────┬──────────────┐  │
│  │ Rubric                   │ Score  │ Visual       │  │
│  ├──────────────────────────┼────────┼──────────────┤  │
│  │ Time Management          │ 4/5    │ ⭐⭐⭐⭐☆   │  │
│  │ POI Engagement           │ 5/5    │ ⭐⭐⭐⭐⭐  │  │
│  │ Delivery & Style         │ 3/5    │ ⭐⭐⭐☆☆   │  │
│  │ Argument Completeness    │ 4/5    │ ⭐⭐⭐⭐☆   │  │
│  │ Theory Application       │ 3/5    │ ⭐⭐⭐☆☆   │  │
│  │ Rebuttal Effectiveness   │ N/A    │ (First spkr)│  │
│  │ Teamwork & Extension     │ N/A    │ (First spkr)│  │
│  │ Feedback Implementation  │ N/A    │ (First deb.)│  │
│  └──────────────────────────┴────────┴──────────────┘  │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  DETAILED FEEDBACK                                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📌 Time Management (4/5)                               │
│  • You managed your time effectively, finishing with    │
│    10 seconds remaining, which shows good preparation.  │
│  • Consider saving 30 seconds for a stronger conclusion │
│    to reinforce your main points.                       │
│                                                          │
│  📌 POI Engagement (5/5)                                │
│  • Excellent POI handling - you took 3 POIs and         │
│    responded directly and confidently.                  │
│  • Your POI responses strengthened your arguments       │
│    rather than derailing them.                          │
│                                                          │
│  [... continues for all 8 rubrics ...]                  │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  STRATEGIC OVERVIEW                                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  🎯 Hook & Signposting                                  │
│  Your opening hook about climate urgency was            │
│  compelling, and you clearly outlined 3 substantives... │
│                                                          │
│  🎯 Strategic Assessment                                │
│  Your argumentation focused heavily on economic         │
│  impacts, which was effective, but you could have...    │
│                                                          │
│  🎯 Missing Arguments                                   │
│  Consider addressing potential rebuttals about...       │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  TEACHER'S NOTES                                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Great eye contact with judges throughout. Noticed      │
│  strong chemistry with partner during prep time.        │
│  Continue working on vocal variety and pace.            │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  TRANSCRIPT HIGHLIGHTS                                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  🟢 Excellent Moment (2:15)                             │
│  "The Security Council veto power fundamentally         │
│  undermines democratic principles..."                   │
│                                                          │
│  🔴 Area for Improvement (4:30)                         │
│  "Um... the... economic impacts are... significant"     │
│  → Work on reducing filler words during complex points  │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  GENERATED BY                                           │
│  Debate Feedback System - AI-Powered Analysis           │
│  Reviewed and approved by: Srijan                       │
│  Generated: November 5, 2025                            │
└─────────────────────────────────────────────────────────┘
```

---

## 16. WIREFRAME SUMMARY

### Desktop Layout (1920x1080)

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] Teacher: Srijan            [🔔 Notifications] [⚙️]   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────┐  ┌───────────────────────────────┐ │
│  │ ACTIVE DEBATES     │  │ PENDING REVIEWS              │ │
│  │ (30% width)        │  │ (70% width)                   │ │
│  │                    │  │                               │ │
│  │ 🔴 Live debate     │  │ ┌──────────────────────────┐ │ │
│  │ [Write Notes]      │  │ │ Feedback card 1          │ │ │
│  │                    │  │ │ [Review] [Approve]       │ │ │
│  │                    │  │ └──────────────────────────┘ │ │
│  │                    │  │                               │ │
│  │                    │  │ ┌──────────────────────────┐ │ │
│  │                    │  │ │ Feedback card 2          │ │ │
│  │                    │  │ │ [Review] [Approve]       │ │ │
│  │                    │  │ └──────────────────────────┘ │ │
│  └────────────────────┘  └───────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ FEEDBACK HISTORY (Full width)                        │  │
│  │ [Search: ___] [Filter: All ▼]                        │  │
│  │                                                       │  │
│  │ Nov 3 - Debate about fossil fuels [8 speeches] [📄] │  │
│  │ Oct 29 - Genetic engineering [6 speeches] [📄]       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Mobile Layout (375x667 - iPhone)

```
┌────────────────────────────┐
│ [☰] Srijan    [🔔] [⚙️]   │
├────────────────────────────┤
│                            │
│ ┌────────────────────────┐ │
│ │ 🔴 ACTIVE DEBATES      │ │
│ │                        │ │
│ │ THW ban social media   │ │
│ │ 3/8 speeches done      │ │
│ │ [View] [Notes]         │ │
│ └────────────────────────┘ │
│                            │
│ ┌────────────────────────┐ │
│ │ ⏳ PENDING REVIEWS (3) │ │
│ │                        │ │
│ │ Arjun Mehta - PM       │ │
│ │ Nov 4, 3:45 PM         │ │
│ │ [Review]               │ │
│ ├────────────────────────┤ │
│ │ Maya Singh - DPM       │ │
│ │ [Review]               │ │
│ └────────────────────────┘ │
│                            │
│ ┌────────────────────────┐ │
│ │ ✅ HISTORY             │ │
│ │ [Search...]            │ │
│ │                        │ │
│ │ Nov 3 - Fossil fuels   │ │
│ │ [View]                 │ │
│ └────────────────────────┘ │
│                            │
└────────────────────────────┘
```

---

## 17. COLOR SCHEME & BRANDING

### Suggested Colors

```css
:root {
  --primary: #2563eb;      /* Blue - Action buttons */
  --secondary: #7c3aed;    /* Purple - Accents */
  --success: #10b981;      /* Green - Approved, success */
  --warning: #f59e0b;      /* Orange - Pending, draft */
  --danger: #ef4444;       /* Red - Errors, rejections */
  --neutral: #6b7280;      /* Gray - Text, borders */

  --bg-primary: #ffffff;   /* White - Main background */
  --bg-secondary: #f9fafb; /* Light gray - Cards */
  --bg-dark: #111827;      /* Dark - Headers, footer */

  --text-primary: #111827; /* Almost black - Main text */
  --text-secondary: #6b7280; /* Gray - Supporting text */
}
```

### Status Color Coding

- 🔴 Live/Recording: Red (#ef4444)
- 🟡 Draft/Pending: Yellow/Orange (#f59e0b)
- 🟢 Approved/Complete: Green (#10b981)
- ⚪ Not Started: Gray (#6b7280)

---

## 18. SAMPLE API USAGE

### Example: Teacher Opens Portal

```javascript
// Frontend code
async function loadDashboard(teacherName) {
  const response = await fetch(`/api/teachers/${teacherName}/dashboard`, {
    headers: {
      'Authorization': `Bearer ${jwt_token}`
    }
  });

  const data = await response.json();
  // data.active_debates, data.pending_reviews, data.recent_approved

  renderDashboard(data);
}
```

### Example: Teacher Edits Feedback

```javascript
// Auto-save every 3 seconds
let saveTimeout;

function onFeedbackEdit(feedbackId, editedData) {
  clearTimeout(saveTimeout);

  saveTimeout = setTimeout(async () => {
    await fetch(`/api/teachers/srijan/feedback/${feedbackId}/draft`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${jwt_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(editedData)
    });

    showToast('Draft saved ✓');
  }, 3000);
}
```

### Example: Teacher Approves Feedback

```javascript
async function approveFeedback(feedbackId) {
  const confirmed = await showConfirmDialog(
    'Approve Feedback',
    'This will generate a DOCX file and lock editing. Continue?'
  );

  if (!confirmed) return;

  const response = await fetch(
    `/api/teachers/srijan/feedback/${feedbackId}/approve`,
    {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${jwt_token}` }
    }
  );

  const { docx_generation_job_id } = await response.json();

  showToast('Feedback approved! DOCX is being generated...');

  // Listen for WebSocket event
  socket.on('docx:ready', ({ feedback_id, docx_url }) => {
    if (feedback_id === feedbackId) {
      showToast('DOCX ready for download!');
      window.location.href = docx_url;
    }
  });
}
```

---

## 19. TESTING STRATEGY

### Unit Tests

- Feedback merge logic (original + edits → final)
- DOCX generation with various inputs
- Rubric validation (1-5 or NA)
- Draft auto-save debouncing

### Integration Tests

- Full feedback editing flow
- Approval workflow (draft → approved → DOCX)
- Real-time notes saving
- WebSocket event propagation

### E2E Tests (Cypress/Playwright)

1. Teacher logs in → sees dashboard
2. Teacher opens live debate → writes notes
3. Teacher reviews feedback → edits scores
4. Teacher approves → downloads DOCX
5. Teacher views history → searches debates

---

## 20. DEPLOYMENT CHECKLIST

### Backend

- [ ] Run database migrations
- [ ] Set up DOCX generation queue worker
- [ ] Configure WebSocket server
- [ ] Set environment variables (DOCX_STORAGE_PATH, etc.)
- [ ] Enable CORS for frontend domain
- [ ] Set up monitoring (Sentry, DataDog)

### Frontend

- [ ] Build production bundle (`npm run build`)
- [ ] Set API base URL
- [ ] Set WebSocket server URL
- [ ] Configure CDN for static assets
- [ ] Enable gzip compression
- [ ] Set up error tracking

### Infrastructure

- [ ] Provision storage for DOCX files (AWS S3, Google Cloud Storage)
- [ ] Set up Redis for WebSocket scaling (if multi-server)
- [ ] Configure load balancer
- [ ] Set up SSL certificates
- [ ] Configure firewall rules

---

## SUMMARY

This comprehensive design provides:

1. **Unique teacher URLs** - /srijan, /tamkeen, etc.
2. **Real-time note-taking** - During live debates
3. **Editable feedback** - Rubrics + qualitative text
4. **Approval workflow** - Draft → Review → Approve → DOCX
5. **History tracking** - All past debates and feedback
6. **Highly customizable** - Teachers control final output
7. **Production-ready architecture** - Scalable, secure, performant

**Next Steps:**
1. Review this design with stakeholders
2. Prioritize features for MVP
3. Set up development environment
4. Begin Phase 1 implementation

---

**Document Version:** 1.0
**Last Updated:** November 5, 2025
**Author:** AI Architect
**Status:** Ready for Implementation
