# Web Frontend Implementation Guide - Quick Start

## Overview

This guide provides step-by-step instructions to implement the web-based teacher portal for the debate feedback system.

---

## Phase 1: Database Setup (Day 1-2)

### 1.1 Create Migration File

Create: `src/migrations/003_web_portal_tables.sql`

```sql
-- Step 1: Create feedback_drafts table
CREATE TABLE feedback_drafts (
    id SERIAL PRIMARY KEY,
    feedback_id INTEGER REFERENCES feedback(id) ON DELETE CASCADE,
    teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    edited_scores JSONB,
    edited_qualitative_feedback JSONB,
    edited_strategic_overview JSONB,
    teacher_notes TEXT,

    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(feedback_id)
);

CREATE INDEX idx_feedback_drafts_feedback ON feedback_drafts(feedback_id);
CREATE INDEX idx_feedback_drafts_teacher ON feedback_drafts(teacher_id);

-- Step 2: Create debate_notes table
CREATE TABLE debate_notes (
    id SERIAL PRIMARY KEY,
    debate_id INTEGER REFERENCES debates(id) ON DELETE CASCADE,
    teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    speech_id INTEGER REFERENCES speeches(id) ON DELETE CASCADE,
    speaker_name VARCHAR(100),

    note_text TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_debate_notes_debate ON debate_notes(debate_id);
CREATE INDEX idx_debate_notes_speech ON debate_notes(speech_id);
CREATE INDEX idx_debate_notes_teacher ON debate_notes(teacher_id);

-- Step 3: Create feedback_approvals table
CREATE TABLE feedback_approvals (
    id SERIAL PRIMARY KEY,
    feedback_id INTEGER REFERENCES feedback(id) ON DELETE CASCADE,
    teacher_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    status VARCHAR(20) DEFAULT 'draft',
    docx_file_path VARCHAR(500),
    docx_url TEXT,

    approved_at TIMESTAMP,
    rejected_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(feedback_id)
);

CREATE INDEX idx_feedback_approvals_status ON feedback_approvals(status);
CREATE INDEX idx_feedback_approvals_teacher ON feedback_approvals(teacher_id);

-- Step 4: Modify existing tables
ALTER TABLE feedback ADD COLUMN approval_status VARCHAR(20) DEFAULT 'pending_review';
ALTER TABLE feedback ADD COLUMN approved_at TIMESTAMP;
ALTER TABLE feedback ADD COLUMN docx_url TEXT;

CREATE INDEX idx_feedback_approval_status ON feedback(approval_status);

ALTER TABLE speeches ADD COLUMN teacher_notes_count INTEGER DEFAULT 0;
```

### 1.2 Run Migration

```bash
# Option A: Use PostgreSQL directly
psql -U your_user -d debate_feedback -f src/migrations/003_web_portal_tables.sql

# Option B: Use Node.js migration runner (if you have one)
npm run migrate:up
```

### 1.3 Verify Tables

```bash
psql -U your_user -d debate_feedback -c "\dt"
# Should see: feedback_drafts, debate_notes, feedback_approvals
```

---

## Phase 2: Backend API (Day 3-5)

### 2.1 Install Dependencies

```bash
cd /home/ubuntu/apps/feedback-backend

# DOCX generation
npm install docx

# WebSocket support (if not already installed)
npm install socket.io

# Date utilities
npm install date-fns
```

### 2.2 Create API Route Files

**File 1:** `src/routes/teacherPortal.routes.ts`

```typescript
import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  getDashboard,
  getFeedbackReview,
  getLiveDebate
} from '../controllers/teacherPortal.controller';

const router = express.Router();

// Dashboard data
router.get(
  '/api/teachers/:teacherName/dashboard',
  authenticate,
  getDashboard
);

// Feedback review interface data
router.get(
  '/api/teachers/:teacherName/feedback/:feedbackId/draft',
  authenticate,
  getFeedbackReview
);

// Live debate data
router.get(
  '/api/teachers/:teacherName/debates/:debateId/live',
  authenticate,
  getLiveDebate
);

export default router;
```

**File 2:** `src/routes/feedbackDraft.routes.ts`

```typescript
import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  createOrUpdateDraft,
  approveFeedback,
  getApprovalStatus
} from '../controllers/feedbackDraft.controller';

const router = express.Router();

// Save/update draft
router.put(
  '/api/teachers/:teacherName/feedback/:feedbackId/draft',
  authenticate,
  createOrUpdateDraft
);

// Approve feedback
router.post(
  '/api/teachers/:teacherName/feedback/:feedbackId/approve',
  authenticate,
  approveFeedback
);

// Check approval status
router.get(
  '/api/teachers/:teacherName/feedback/:feedbackId/approval-status',
  authenticate,
  getApprovalStatus
);

export default router;
```

**File 3:** `src/routes/debateNotes.routes.ts`

```typescript
import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  createNote,
  getNotes,
  updateNote,
  deleteNote
} from '../controllers/debateNotes.controller';

const router = express.Router();

// Create note
router.post(
  '/api/teachers/:teacherName/debates/:debateId/notes',
  authenticate,
  createNote
);

// Get all notes for a debate
router.get(
  '/api/teachers/:teacherName/debates/:debateId/notes',
  authenticate,
  getNotes
);

// Update note
router.put(
  '/api/teachers/:teacherName/notes/:noteId',
  authenticate,
  updateNote
);

// Delete note
router.delete(
  '/api/teachers/:teacherName/notes/:noteId',
  authenticate,
  deleteNote
);

export default router;
```

### 2.3 Register Routes in Main App

**Edit:** `src/index.ts` (or `src/app.ts`)

```typescript
import teacherPortalRoutes from './routes/teacherPortal.routes';
import feedbackDraftRoutes from './routes/feedbackDraft.routes';
import debateNotesRoutes from './routes/debateNotes.routes';

// ... existing code ...

// Register new routes
app.use(teacherPortalRoutes);
app.use(feedbackDraftRoutes);
app.use(debateNotesRoutes);

// ... rest of app setup ...
```

---

## Phase 3: Controllers (Day 6-7)

### 3.1 Dashboard Controller

**File:** `src/controllers/teacherPortal.controller.ts`

```typescript
import { Request, Response } from 'express';
import pool from '../config/database';

export const getDashboard = async (req: Request, res: Response) => {
  try {
    const { teacherName } = req.params;

    // Get teacher ID from name
    const teacherResult = await pool.query(
      'SELECT id FROM users WHERE name = $1',
      [teacherName]
    );

    if (teacherResult.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacherId = teacherResult.rows[0].id;

    // Get active debates
    const activeDebates = await pool.query(`
      SELECT
        d.id,
        d.motion,
        d.status,
        d.created_at as started_at,
        COUNT(s.id) as speeches_completed,
        COUNT(dp.id) as total_speeches
      FROM debates d
      LEFT JOIN speeches s ON d.id = s.debate_id AND s.status = 'complete'
      LEFT JOIN debate_participants dp ON d.id = dp.debate_id
      WHERE d.teacher_id = $1
        AND d.status IN ('in_progress', 'active')
      GROUP BY d.id
      ORDER BY d.created_at DESC
    `, [teacherId]);

    // Get pending reviews
    const pendingReviews = await pool.query(`
      SELECT
        f.id as feedback_id,
        s.id as speech_id,
        dp.student_name,
        dp.position,
        d.motion,
        f.created_at as generated_at,
        fd.version as edit_count,
        COALESCE(f.approval_status, 'pending_review') as status
      FROM feedback f
      JOIN speeches s ON f.speech_id = s.id
      JOIN debates d ON s.debate_id = d.id
      JOIN debate_participants dp ON d.id = dp.debate_id
        AND s.audio_file_path LIKE '%' || dp.student_name || '%'
      LEFT JOIN feedback_drafts fd ON f.id = fd.feedback_id
      WHERE d.teacher_id = $1
        AND f.approval_status IN ('pending_review', 'draft')
      ORDER BY f.created_at DESC
      LIMIT 10
    `, [teacherId]);

    // Get recent approved feedback
    const recentApproved = await pool.query(`
      SELECT
        d.id as debate_id,
        d.motion,
        d.created_at as debate_date,
        COUNT(DISTINCT f.id) as feedback_count,
        f.docx_url
      FROM debates d
      JOIN speeches s ON d.id = s.debate_id
      JOIN feedback f ON s.id = f.speech_id
      WHERE d.teacher_id = $1
        AND f.approval_status = 'approved'
      GROUP BY d.id, d.motion, d.created_at, f.docx_url
      ORDER BY d.created_at DESC
      LIMIT 5
    `, [teacherId]);

    res.json({
      active_debates: activeDebates.rows,
      pending_reviews: pendingReviews.rows,
      recent_approved: recentApproved.rows
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
};

export const getFeedbackReview = async (req: Request, res: Response) => {
  try {
    const { teacherName, feedbackId } = req.params;

    // Get original feedback
    const feedbackResult = await pool.query(`
      SELECT
        f.*,
        s.id as speech_id,
        dp.student_name,
        dp.position,
        d.motion
      FROM feedback f
      JOIN speeches s ON f.speech_id = s.id
      JOIN debates d ON s.debate_id = d.id
      JOIN debate_participants dp ON d.id = dp.debate_id
      WHERE f.id = $1
    `, [feedbackId]);

    if (feedbackResult.rows.length === 0) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    const original = feedbackResult.rows[0];

    // Get draft if exists
    const draftResult = await pool.query(`
      SELECT * FROM feedback_drafts WHERE feedback_id = $1
    `, [feedbackId]);

    const draft = draftResult.rows[0] || null;

    res.json({
      feedback_id: parseInt(feedbackId),
      student_name: original.student_name,
      position: original.position,
      motion: original.motion,
      original: {
        scores: original.scores,
        qualitative_feedback: original.qualitative_feedback,
        strategic_overview: original.strategic_overview
      },
      draft: draft ? {
        edited_scores: draft.edited_scores,
        edited_qualitative_feedback: draft.edited_qualitative_feedback,
        edited_strategic_overview: draft.edited_strategic_overview,
        teacher_notes: draft.teacher_notes,
        version: draft.version,
        updated_at: draft.updated_at
      } : null,
      approval_status: original.approval_status || 'pending_review'
    });

  } catch (error) {
    console.error('Feedback review error:', error);
    res.status(500).json({ error: 'Failed to load feedback' });
  }
};

export const getLiveDebate = async (req: Request, res: Response) => {
  try {
    const { debateId } = req.params;

    // Get debate details with participants
    const debateResult = await pool.query(`
      SELECT
        d.*,
        json_agg(
          json_build_object(
            'student_name', dp.student_name,
            'team', dp.team,
            'position', dp.position,
            'speaker_order', dp.speaker_order
          ) ORDER BY dp.speaker_order
        ) as participants
      FROM debates d
      LEFT JOIN debate_participants dp ON d.id = dp.debate_id
      WHERE d.id = $1
      GROUP BY d.id
    `, [debateId]);

    if (debateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Debate not found' });
    }

    // Get speeches status
    const speechesResult = await pool.query(`
      SELECT
        s.*,
        COUNT(dn.id) as notes_count
      FROM speeches s
      LEFT JOIN debate_notes dn ON s.id = dn.speech_id
      WHERE s.debate_id = $1
      GROUP BY s.id
      ORDER BY s.created_at
    `, [debateId]);

    res.json({
      debate: debateResult.rows[0],
      speeches: speechesResult.rows
    });

  } catch (error) {
    console.error('Live debate error:', error);
    res.status(500).json({ error: 'Failed to load debate' });
  }
};
```

### 3.2 Feedback Draft Controller

**File:** `src/controllers/feedbackDraft.controller.ts`

```typescript
import { Request, Response } from 'express';
import pool from '../config/database';

export const createOrUpdateDraft = async (req: Request, res: Response) => {
  try {
    const { feedbackId } = req.params;
    const {
      edited_scores,
      edited_qualitative_feedback,
      edited_strategic_overview,
      teacher_notes
    } = req.body;

    // Check if draft exists
    const existingDraft = await pool.query(
      'SELECT version FROM feedback_drafts WHERE feedback_id = $1',
      [feedbackId]
    );

    if (existingDraft.rows.length > 0) {
      // Update existing draft
      const newVersion = existingDraft.rows[0].version + 1;

      const result = await pool.query(`
        UPDATE feedback_drafts
        SET
          edited_scores = $1,
          edited_qualitative_feedback = $2,
          edited_strategic_overview = $3,
          teacher_notes = $4,
          version = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE feedback_id = $6
        RETURNING id, version, updated_at
      `, [
        edited_scores,
        edited_qualitative_feedback,
        edited_strategic_overview,
        teacher_notes,
        newVersion,
        feedbackId
      ]);

      res.json({
        draft_id: result.rows[0].id,
        version: result.rows[0].version,
        saved_at: result.rows[0].updated_at
      });
    } else {
      // Create new draft
      const result = await pool.query(`
        INSERT INTO feedback_drafts (
          feedback_id,
          teacher_id,
          edited_scores,
          edited_qualitative_feedback,
          edited_strategic_overview,
          teacher_notes,
          version
        )
        VALUES ($1, $2, $3, $4, $5, $6, 1)
        RETURNING id, version, updated_at
      `, [
        feedbackId,
        req.user.id, // From auth middleware
        edited_scores,
        edited_qualitative_feedback,
        edited_strategic_overview,
        teacher_notes
      ]);

      // Update feedback status to 'draft'
      await pool.query(
        'UPDATE feedback SET approval_status = $1 WHERE id = $2',
        ['draft', feedbackId]
      );

      res.json({
        draft_id: result.rows[0].id,
        version: result.rows[0].version,
        saved_at: result.rows[0].updated_at
      });
    }

  } catch (error) {
    console.error('Draft save error:', error);
    res.status(500).json({ error: 'Failed to save draft' });
  }
};

export const approveFeedback = async (req: Request, res: Response) => {
  try {
    const { feedbackId } = req.params;
    const teacherId = req.user.id;

    // Update approval status
    await pool.query(`
      UPDATE feedback
      SET
        approval_status = 'approved',
        approved_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [feedbackId]);

    // Create approval record
    const approvalResult = await pool.query(`
      INSERT INTO feedback_approvals (
        feedback_id,
        teacher_id,
        status,
        approved_at
      )
      VALUES ($1, $2, 'approved', CURRENT_TIMESTAMP)
      ON CONFLICT (feedback_id) DO UPDATE
      SET
        status = 'approved',
        approved_at = CURRENT_TIMESTAMP
      RETURNING id
    `, [feedbackId, teacherId]);

    // TODO: Trigger DOCX generation queue job
    // const jobId = await docxQueue.add('generate', { feedbackId });

    res.json({
      approval_id: approvalResult.rows[0].id,
      status: 'approved',
      // docx_generation_job_id: jobId,
      message: 'Feedback approved. DOCX generation will start shortly.'
    });

  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ error: 'Failed to approve feedback' });
  }
};

export const getApprovalStatus = async (req: Request, res: Response) => {
  try {
    const { feedbackId } = req.params;

    const result = await pool.query(`
      SELECT
        fa.status,
        fa.docx_url,
        fa.approved_at,
        f.approval_status
      FROM feedback f
      LEFT JOIN feedback_approvals fa ON f.id = fa.feedback_id
      WHERE f.id = $1
    `, [feedbackId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
};
```

### 3.3 Debate Notes Controller

**File:** `src/controllers/debateNotes.controller.ts`

```typescript
import { Request, Response } from 'express';
import pool from '../config/database';

export const createNote = async (req: Request, res: Response) => {
  try {
    const { debateId } = req.params;
    const { speech_id, speaker_name, note_text } = req.body;
    const teacherId = req.user.id;

    const result = await pool.query(`
      INSERT INTO debate_notes (
        debate_id,
        teacher_id,
        speech_id,
        speaker_name,
        note_text
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at
    `, [debateId, teacherId, speech_id, speaker_name, note_text]);

    // Update notes count on speech
    await pool.query(`
      UPDATE speeches
      SET teacher_notes_count = teacher_notes_count + 1
      WHERE id = $1
    `, [speech_id]);

    res.json({
      note_id: result.rows[0].id,
      created_at: result.rows[0].created_at
    });

  } catch (error) {
    console.error('Note creation error:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
};

export const getNotes = async (req: Request, res: Response) => {
  try {
    const { debateId } = req.params;
    const teacherId = req.user.id;

    const result = await pool.query(`
      SELECT
        id as note_id,
        speech_id,
        speaker_name,
        note_text,
        created_at,
        updated_at
      FROM debate_notes
      WHERE debate_id = $1 AND teacher_id = $2
      ORDER BY created_at ASC
    `, [debateId, teacherId]);

    res.json({
      notes: result.rows
    });

  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Failed to get notes' });
  }
};

export const updateNote = async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const { note_text } = req.body;
    const teacherId = req.user.id;

    const result = await pool.query(`
      UPDATE debate_notes
      SET
        note_text = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND teacher_id = $3
      RETURNING updated_at
    `, [note_text, noteId, teacherId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({
      updated_at: result.rows[0].updated_at
    });

  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
};

export const deleteNote = async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const teacherId = req.user.id;

    // Get speech_id before deleting
    const noteResult = await pool.query(
      'SELECT speech_id FROM debate_notes WHERE id = $1 AND teacher_id = $2',
      [noteId, teacherId]
    );

    if (noteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const speechId = noteResult.rows[0].speech_id;

    // Delete note
    await pool.query(
      'DELETE FROM debate_notes WHERE id = $1 AND teacher_id = $2',
      [noteId, teacherId]
    );

    // Update notes count
    await pool.query(`
      UPDATE speeches
      SET teacher_notes_count = GREATEST(teacher_notes_count - 1, 0)
      WHERE id = $1
    `, [speechId]);

    res.json({ message: 'Note deleted' });

  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
};
```

---

## Phase 4: Frontend Setup (Day 8-10)

### 4.1 Choose Frontend Framework

**Option A: React (Recommended)**

```bash
# Create frontend directory
cd /home/ubuntu/apps/feedback-backend
mkdir -p frontend/web
cd frontend/web

# Initialize React app
npx create-react-app . --template typescript

# Install dependencies
npm install axios socket.io-client react-router-dom
npm install @types/react-router-dom --save-dev
npm install tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Option B: Simple HTML/JS (Quick & Lightweight)**

```bash
# Create directory
mkdir -p frontend/web/public
cd frontend/web/public

# Create files
touch index.html app.js styles.css
```

### 4.2 Configure Proxy (React)

**Edit:** `frontend/web/package.json`

```json
{
  "proxy": "http://localhost:12000"
}
```

### 4.3 Create Basic Structure

```
frontend/web/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx
│   │   ├── FeedbackReview.tsx
│   │   └── LiveDebate.tsx
│   ├── services/
│   │   ├── api.ts
│   │   └── websocket.ts
│   ├── App.tsx
│   └── index.tsx
└── package.json
```

---

## Phase 5: Simple HTML/JS Implementation (Day 11-14)

If you want to skip React and build quickly:

### 5.1 Create Teacher Dashboard HTML

**File:** `frontend/web/public/srijan.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Teacher Portal - Srijan</title>
    <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #f9fafb;
            padding: 20px;
        }
        .header {
            background: white;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .section {
            background: white;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .section-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 15px;
            color: #111827;
        }
        .card {
            border: 1px solid #e5e7eb;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 6px;
        }
        .btn {
            padding: 8px 16px;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            font-size: 14px;
        }
        .btn-primary { background: #2563eb; color: white; }
        .btn-success { background: #10b981; color: white; }
        .status-draft { color: #f59e0b; }
        .status-approved { color: #10b981; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Teacher Portal - Srijan</h1>
        <p>Welcome back! Here's your overview.</p>
    </div>

    <div class="section">
        <div class="section-title">📝 Active Debates</div>
        <div id="active-debates">
            <p>Loading...</p>
        </div>
    </div>

    <div class="section">
        <div class="section-title">⏳ Pending Reviews</div>
        <div id="pending-reviews">
            <p>Loading...</p>
        </div>
    </div>

    <div class="section">
        <div class="section-title">✅ Feedback History</div>
        <div id="feedback-history">
            <p>Loading...</p>
        </div>
    </div>

    <script>
        const teacherName = 'srijan';
        const apiBase = 'http://localhost:12000';

        // Load dashboard data
        async function loadDashboard() {
            try {
                const token = localStorage.getItem('auth_token');
                const response = await fetch(`${apiBase}/api/teachers/${teacherName}/dashboard`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const data = await response.json();

                // Render active debates
                const activeDebatesEl = document.getElementById('active-debates');
                if (data.active_debates.length === 0) {
                    activeDebatesEl.innerHTML = '<p>No active debates</p>';
                } else {
                    activeDebatesEl.innerHTML = data.active_debates.map(debate => `
                        <div class="card">
                            <strong>${debate.motion}</strong>
                            <p>Progress: ${debate.speeches_completed}/${debate.total_speeches} speeches</p>
                            <button class="btn btn-primary" onclick="viewLiveDebate(${debate.id})">
                                View Live
                            </button>
                        </div>
                    `).join('');
                }

                // Render pending reviews
                const pendingReviewsEl = document.getElementById('pending-reviews');
                if (data.pending_reviews.length === 0) {
                    pendingReviewsEl.innerHTML = '<p>No pending reviews</p>';
                } else {
                    pendingReviewsEl.innerHTML = data.pending_reviews.map(review => `
                        <div class="card">
                            <strong>${review.student_name} (${review.position})</strong>
                            <p>${review.motion}</p>
                            <p class="status-${review.status}">${review.status.toUpperCase()}</p>
                            <button class="btn btn-primary" onclick="reviewFeedback(${review.feedback_id})">
                                Review & Edit
                            </button>
                            <button class="btn btn-success" onclick="approveFeedback(${review.feedback_id})">
                                ✓ Approve
                            </button>
                        </div>
                    `).join('');
                }

                // Render history
                const historyEl = document.getElementById('feedback-history');
                if (data.recent_approved.length === 0) {
                    historyEl.innerHTML = '<p>No approved feedback yet</p>';
                } else {
                    historyEl.innerHTML = data.recent_approved.map(item => `
                        <div class="card">
                            <strong>${item.motion}</strong>
                            <p>Date: ${new Date(item.debate_date).toLocaleDateString()}</p>
                            <p>${item.feedback_count} speeches</p>
                        </div>
                    `).join('');
                }

            } catch (error) {
                console.error('Failed to load dashboard:', error);
                alert('Failed to load dashboard. Please refresh.');
            }
        }

        function viewLiveDebate(debateId) {
            window.location.href = `/${teacherName}/debate/${debateId}/live.html`;
        }

        function reviewFeedback(feedbackId) {
            window.location.href = `/${teacherName}/feedback/${feedbackId}/review.html`;
        }

        async function approveFeedback(feedbackId) {
            if (!confirm('Are you sure you want to approve this feedback? This will generate a DOCX file.')) {
                return;
            }

            try {
                const token = localStorage.getItem('auth_token');
                const response = await fetch(
                    `${apiBase}/api/teachers/${teacherName}/feedback/${feedbackId}/approve`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    }
                );

                const result = await response.json();
                alert('Feedback approved! DOCX generation in progress...');
                loadDashboard(); // Refresh

            } catch (error) {
                console.error('Approval failed:', error);
                alert('Failed to approve feedback. Please try again.');
            }
        }

        // Load on page load
        loadDashboard();

        // Connect to WebSocket for real-time updates
        const socket = io(apiBase);
        socket.on('feedback:ready', (data) => {
            console.log('New feedback ready:', data);
            loadDashboard(); // Refresh dashboard
        });
    </script>
</body>
</html>
```

### 5.2 Serve HTML Files from Express

**Edit:** `src/index.ts`

```typescript
import path from 'path';

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend/web/public')));

// Teacher portal routes
app.get('/:teacherName', (req, res) => {
  const { teacherName } = req.params;
  const validTeachers = ['srijan', 'tamkeen', 'mai', 'saurav', 'jami', 'naveen'];

  if (validTeachers.includes(teacherName)) {
    res.sendFile(path.join(__dirname, '../frontend/web/public/dashboard.html'));
  } else {
    res.status(404).send('Teacher not found');
  }
});
```

---

## Phase 6: DOCX Generation (Day 15-16)

### 6.1 Create DOCX Service

**File:** `src/services/docxGenerator.service.ts`

```typescript
import { Document, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType } from 'docx';
import fs from 'fs';
import path from 'path';
import pool from '../config/database';

interface FeedbackData {
  student_name: string;
  position: string;
  motion: string;
  scores: Record<string, number | string>;
  qualitative_feedback: Record<string, string[]>;
  strategic_overview: Record<string, string>;
  teacher_notes?: string;
}

export async function generateFeedbackDocx(feedbackId: number): Promise<string> {
  try {
    // Get feedback data (merge original + draft)
    const feedbackData = await getFeedbackData(feedbackId);

    // Create document
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Title
          new Paragraph({
            text: 'DEBATE FEEDBACK REPORT',
            heading: 'Heading1',
            alignment: AlignmentType.CENTER
          }),

          // Metadata
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Student: ', bold: true }),
              new TextRun(feedbackData.student_name)
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Position: ', bold: true }),
              new TextRun(feedbackData.position)
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Motion: ', bold: true }),
              new TextRun(feedbackData.motion)
            ]
          }),
          new Paragraph({ text: '' }),

          // Rubric Scores Section
          new Paragraph({
            text: 'RUBRIC SCORES',
            heading: 'Heading2'
          }),
          new Paragraph({ text: '' }),

          // TODO: Add table with scores

          // Qualitative Feedback Section
          new Paragraph({
            text: 'DETAILED FEEDBACK',
            heading: 'Heading2'
          }),
          new Paragraph({ text: '' }),

          // TODO: Add feedback points

          // Teacher Notes
          ...(feedbackData.teacher_notes ? [
            new Paragraph({ text: '' }),
            new Paragraph({
              text: "TEACHER'S NOTES",
              heading: 'Heading2'
            }),
            new Paragraph({ text: feedbackData.teacher_notes })
          ] : [])
        ]
      }]
    });

    // Save to file
    const outputDir = path.join(__dirname, '../../uploads/docx');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filename = `feedback-${feedbackId}-${Date.now()}.docx`;
    const filepath = path.join(outputDir, filename);

    // Write file
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filepath, buffer);

    return filepath;

  } catch (error) {
    console.error('DOCX generation error:', error);
    throw error;
  }
}

async function getFeedbackData(feedbackId: number): Promise<FeedbackData> {
  // Query to merge original feedback with draft edits
  const result = await pool.query(`
    SELECT
      f.*,
      dp.student_name,
      dp.position,
      d.motion,
      fd.edited_scores,
      fd.edited_qualitative_feedback,
      fd.edited_strategic_overview,
      fd.teacher_notes
    FROM feedback f
    JOIN speeches s ON f.speech_id = s.id
    JOIN debates d ON s.debate_id = d.id
    JOIN debate_participants dp ON d.id = dp.debate_id
    LEFT JOIN feedback_drafts fd ON f.id = fd.feedback_id
    WHERE f.id = $1
  `, [feedbackId]);

  const row = result.rows[0];

  // Merge original with edits (edits take precedence)
  return {
    student_name: row.student_name,
    position: row.position,
    motion: row.motion,
    scores: row.edited_scores || row.scores,
    qualitative_feedback: row.edited_qualitative_feedback || row.qualitative_feedback,
    strategic_overview: row.edited_strategic_overview || row.strategic_overview,
    teacher_notes: row.teacher_notes
  };
}
```

### 6.2 Create DOCX Worker

**File:** `src/workers/docxWorker.ts`

```typescript
import Bull from 'bull';
import { generateFeedbackDocx } from '../services/docxGenerator.service';
import pool from '../config/database';
import { REDIS_CONFIG } from '../config/redis';

const docxQueue = new Bull('docx-generation', {
  redis: REDIS_CONFIG
});

// Process DOCX generation jobs
docxQueue.process(5, async (job) => {
  const { feedbackId } = job.data;

  console.log(`[DOCX Worker] Generating DOCX for feedback ${feedbackId}`);

  try {
    // Generate DOCX file
    const filepath = await generateFeedbackDocx(feedbackId);

    // Update database with DOCX path
    await pool.query(`
      UPDATE feedback
      SET docx_url = $1
      WHERE id = $2
    `, [`/uploads/docx/${path.basename(filepath)}`, feedbackId]);

    await pool.query(`
      UPDATE feedback_approvals
      SET docx_file_path = $1
      WHERE feedback_id = $2
    `, [filepath, feedbackId]);

    console.log(`[DOCX Worker] Generated DOCX: ${filepath}`);

    return { filepath, feedbackId };

  } catch (error) {
    console.error(`[DOCX Worker] Error:`, error);
    throw error;
  }
});

export default docxQueue;
```

### 6.3 Trigger DOCX Generation on Approval

**Update:** `src/controllers/feedbackDraft.controller.ts`

```typescript
import docxQueue from '../workers/docxWorker';

export const approveFeedback = async (req: Request, res: Response) => {
  try {
    // ... existing approval code ...

    // Trigger DOCX generation
    const job = await docxQueue.add('generate', {
      feedbackId: parseInt(feedbackId)
    });

    res.json({
      approval_id: approvalResult.rows[0].id,
      status: 'approved',
      docx_generation_job_id: job.id,
      message: 'Feedback approved. DOCX generation in progress.'
    });

  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ error: 'Failed to approve feedback' });
  }
};
```

---

## Testing Checklist

### API Testing (Use Postman or curl)

```bash
# 1. Test dashboard endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:12000/api/teachers/srijan/dashboard

# 2. Test feedback draft save
curl -X PUT \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"edited_scores": {"Time Management": 5}}' \
  http://localhost:12000/api/teachers/srijan/feedback/1/draft

# 3. Test approval
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:12000/api/teachers/srijan/feedback/1/approve

# 4. Test notes creation
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"speech_id": 1, "speaker_name": "Arjun", "note_text": "Great speech"}' \
  http://localhost:12000/api/teachers/srijan/debates/1/notes
```

---

## Deployment Steps

### 1. Update Environment Variables

```bash
# Add to .env
DOCX_STORAGE_PATH=/home/ubuntu/apps/feedback-backend/uploads/docx
WEB_FRONTEND_URL=https://yourdomain.com
```

### 2. Start DOCX Worker

```bash
npm run worker:docx
```

### 3. Restart Server

```bash
pm2 restart feedback-backend
```

---

## Next Steps

After completing this implementation:

1. **Phase 7:** Add WebSocket real-time updates
2. **Phase 8:** Build React components for better UX
3. **Phase 9:** Add analytics dashboard
4. **Phase 10:** Mobile responsive design
5. **Phase 11:** Student view portal

---

## Quick Commands Reference

```bash
# Run migrations
psql -U your_user -d debate_feedback -f src/migrations/003_web_portal_tables.sql

# Start backend
npm run dev

# Start frontend (if using React)
cd frontend/web && npm start

# Start DOCX worker
npm run worker:docx

# Test API
curl -H "Authorization: Bearer TOKEN" http://localhost:12000/api/teachers/srijan/dashboard
```

---

## Support

If you encounter issues:

1. Check database connection: `psql -U your_user -d debate_feedback`
2. Check server logs: `pm2 logs feedback-backend`
3. Verify migrations ran: `psql -c "\dt" debate_feedback`
4. Test API endpoints with curl

---

**Document Version:** 1.0
**Last Updated:** November 5, 2025
