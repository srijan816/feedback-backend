-- ============================================
-- Migration: Add Web Teacher Portal Tables
-- Date: 2025-11-05
-- Description: Add tables for teacher portal: feedback drafts, debate notes, and approval workflow
-- ============================================

-- ============================================
-- FEEDBACK_DRAFTS - Store teacher edits before approval
-- ============================================

CREATE TABLE IF NOT EXISTS feedback_drafts (
    id SERIAL PRIMARY KEY,
    feedback_id INTEGER REFERENCES feedback(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Edited scores (JSONB allows flexible storage)
    edited_scores JSONB,
    -- Example: {"Time Management": 5, "POI Engagement": 4, ...}

    -- Edited qualitative feedback
    edited_qualitative_feedback JSONB,
    -- Example: {"Time Management": ["Point 1 edited", "New point 2"], ...}

    -- Edited strategic overview (if applicable)
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
CREATE INDEX idx_feedback_drafts_updated ON feedback_drafts(updated_at DESC);

-- ============================================
-- DEBATE_NOTES - Real-time notes during debate
-- ============================================

CREATE TABLE IF NOT EXISTS debate_notes (
    id SERIAL PRIMARY KEY,
    debate_id UUID REFERENCES debates(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,

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
CREATE INDEX idx_debate_notes_created ON debate_notes(created_at DESC);

-- ============================================
-- FEEDBACK_APPROVALS - Track approval workflow
-- ============================================

CREATE TABLE IF NOT EXISTS feedback_approvals (
    id SERIAL PRIMARY KEY,
    feedback_id INTEGER REFERENCES feedback(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Approval status
    status VARCHAR(20) DEFAULT 'draft',
    -- Values: 'draft', 'pending_review', 'approved', 'rejected'

    -- DOCX file path after approval
    docx_file_path VARCHAR(500),
    docx_url TEXT, -- Public URL if uploaded to cloud

    -- Rejection reason
    rejection_reason TEXT,

    -- Timestamps
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(feedback_id)
);

CREATE INDEX idx_feedback_approvals_status ON feedback_approvals(status);
CREATE INDEX idx_feedback_approvals_teacher ON feedback_approvals(teacher_id);
CREATE INDEX idx_feedback_approvals_approved ON feedback_approvals(approved_at DESC);

-- ============================================
-- MODIFY EXISTING TABLES
-- ============================================

-- Add approval status tracking to feedback table
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending_review';
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS docx_url TEXT;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS strategic_overview JSONB;

CREATE INDEX IF NOT EXISTS idx_feedback_approval_status ON feedback(approval_status);
CREATE INDEX IF NOT EXISTS idx_feedback_approved_at ON feedback(approved_at DESC);

-- Add notes count for UI display
ALTER TABLE speeches ADD COLUMN IF NOT EXISTS teacher_notes_count INTEGER DEFAULT 0;

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

CREATE TRIGGER update_feedback_drafts_updated_at BEFORE UPDATE ON feedback_drafts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_debate_notes_updated_at BEFORE UPDATE ON debate_notes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feedback_approvals_updated_at BEFORE UPDATE ON feedback_approvals
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS FOR TEACHER PORTAL
-- ============================================

-- View: Teacher Dashboard Summary
CREATE OR REPLACE VIEW teacher_dashboard_summary AS
SELECT
    u.id AS teacher_id,
    u.name AS teacher_name,
    COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'in_progress') AS active_debates,
    COUNT(DISTINCT f.id) FILTER (WHERE f.approval_status IN ('pending_review', 'draft')) AS pending_reviews,
    COUNT(DISTINCT f.id) FILTER (WHERE f.approval_status = 'approved') AS approved_feedbacks
FROM users u
LEFT JOIN debates d ON u.id = d.teacher_id
LEFT JOIN speeches s ON d.id = s.debate_id
LEFT JOIN feedback f ON s.id = f.speech_id
WHERE u.role = 'teacher'
GROUP BY u.id, u.name;

-- View: Feedback with Draft Status
CREATE OR REPLACE VIEW feedback_with_drafts AS
SELECT
    f.id AS feedback_id,
    f.speech_id,
    f.google_doc_url,
    f.scores AS original_scores,
    f.qualitative_feedback AS original_qualitative,
    f.strategic_overview AS original_strategic,
    f.approval_status,
    f.approved_at,
    f.docx_url,
    fd.id AS draft_id,
    fd.edited_scores,
    fd.edited_qualitative_feedback,
    fd.edited_strategic_overview,
    fd.teacher_notes,
    fd.version AS draft_version,
    fd.updated_at AS draft_updated_at,
    fa.status AS approval_record_status,
    fa.docx_file_path,
    s.speaker_name,
    s.speaker_position,
    d.motion,
    d.teacher_id,
    u.name AS teacher_name
FROM feedback f
JOIN speeches s ON f.speech_id = s.id
JOIN debates d ON s.debate_id = d.id
LEFT JOIN users u ON d.teacher_id = u.id
LEFT JOIN feedback_drafts fd ON f.id = fd.feedback_id
LEFT JOIN feedback_approvals fa ON f.id = fa.feedback_id;

-- ============================================
-- VERIFY MIGRATION
-- ============================================

DO $$
DECLARE
    table_count INTEGER;
BEGIN
    -- Check that all new tables exist
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('feedback_drafts', 'debate_notes', 'feedback_approvals');

    IF table_count <> 3 THEN
        RAISE EXCEPTION 'Migration failed: Expected 3 new tables, found %', table_count;
    END IF;

    -- Check that new columns were added to feedback table
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'feedback' AND column_name = 'approval_status'
    ) THEN
        RAISE EXCEPTION 'Migration failed: approval_status column not added to feedback table';
    END IF;

    RAISE NOTICE 'Migration successful: Web portal tables created';
    RAISE NOTICE '  - feedback_drafts table created';
    RAISE NOTICE '  - debate_notes table created';
    RAISE NOTICE '  - feedback_approvals table created';
    RAISE NOTICE '  - feedback table updated with approval columns';
    RAISE NOTICE '  - speeches table updated with notes count';
    RAISE NOTICE '  - 2 views created for teacher portal';
END $$;
