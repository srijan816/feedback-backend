-- Debate Recording & Feedback Platform - Database Schema
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

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
CREATE INDEX idx_users_role ON users(role);

-- ============================================
-- STUDENTS
-- ============================================

CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  level VARCHAR(50) NOT NULL CHECK (level IN ('primary', 'secondary')),
  institution VARCHAR(255) DEFAULT 'capstone',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_students_name ON students(name);
CREATE INDEX idx_students_level ON students(level);
CREATE INDEX idx_students_active ON students(is_active);

-- ============================================
-- SCHEDULES
-- ============================================

CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
  class_id VARCHAR(100) NOT NULL,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  suggested_motion TEXT,
  default_format VARCHAR(50) DEFAULT 'WSDC',
  default_speech_time INTEGER DEFAULT 480,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_schedules_teacher ON schedules(teacher_id);
CREATE INDEX idx_schedules_time ON schedules(day_of_week, start_time);
CREATE INDEX idx_schedules_active ON schedules(is_active);

-- ============================================
-- SCHEDULE_STUDENTS (Many-to-Many)
-- ============================================

CREATE TABLE schedule_students (
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  PRIMARY KEY (schedule_id, student_id)
);

CREATE INDEX idx_schedule_students_schedule ON schedule_students(schedule_id);
CREATE INDEX idx_schedule_students_student ON schedule_students(student_id);

-- ============================================
-- DEBATES
-- ============================================

CREATE TABLE debates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES users(id) ON DELETE SET NULL,
  motion TEXT NOT NULL,
  format VARCHAR(50) NOT NULL CHECK (format IN ('WSDC', 'Modified WSDC', 'BP', 'AP', 'Australs', 'LD', 'PF')),
  student_level VARCHAR(50) NOT NULL CHECK (student_level IN ('primary', 'secondary')),
  speech_time_seconds INTEGER NOT NULL,
  reply_time_seconds INTEGER,
  status VARCHAR(50) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  is_guest_session BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_debates_teacher ON debates(teacher_id);
CREATE INDEX idx_debates_created ON debates(created_at DESC);
CREATE INDEX idx_debates_status ON debates(status);
CREATE INDEX idx_debates_guest ON debates(is_guest_session);

-- ============================================
-- DEBATE_PARTICIPANTS
-- ============================================

CREATE TABLE debate_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID REFERENCES debates(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  student_name VARCHAR(255) NOT NULL,
  team VARCHAR(50) NOT NULL,
  position VARCHAR(50) NOT NULL,
  speaker_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_participants_debate ON debate_participants(debate_id);
CREATE INDEX idx_participants_student ON debate_participants(student_id);
CREATE INDEX idx_participants_order ON debate_participants(debate_id, speaker_order);

-- ============================================
-- SPEECHES
-- ============================================

CREATE TABLE speeches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID REFERENCES debates(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES debate_participants(id) ON DELETE SET NULL,
  speaker_name VARCHAR(255) NOT NULL,
  speaker_position VARCHAR(50) NOT NULL,
  audio_file_path VARCHAR(500),
  audio_file_url TEXT,
  audio_file_drive_id VARCHAR(255),
  duration_seconds INTEGER,
  file_size_bytes BIGINT,
  upload_status VARCHAR(50) DEFAULT 'pending' CHECK (upload_status IN ('pending', 'uploading', 'uploaded', 'failed')),
  transcription_status VARCHAR(50) DEFAULT 'pending' CHECK (transcription_status IN ('pending', 'processing', 'completed', 'failed')),
  feedback_status VARCHAR(50) DEFAULT 'pending' CHECK (feedback_status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  uploaded_at TIMESTAMP,
  transcription_started_at TIMESTAMP,
  transcription_completed_at TIMESTAMP,
  feedback_started_at TIMESTAMP,
  feedback_completed_at TIMESTAMP
);

CREATE INDEX idx_speeches_debate ON speeches(debate_id);
CREATE INDEX idx_speeches_participant ON speeches(participant_id);
CREATE INDEX idx_speeches_upload_status ON speeches(upload_status);
CREATE INDEX idx_speeches_transcription_status ON speeches(transcription_status);
CREATE INDEX idx_speeches_feedback_status ON speeches(feedback_status);
CREATE INDEX idx_speeches_created ON speeches(created_at DESC);

-- ============================================
-- TRANSCRIPTS
-- ============================================

CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speech_id UUID UNIQUE REFERENCES speeches(id) ON DELETE CASCADE,
  transcript_text TEXT NOT NULL,
  word_count INTEGER,
  speaking_rate DECIMAL(5,2),
  filler_word_count INTEGER,
  api_provider VARCHAR(50) DEFAULT 'openai',
  api_model VARCHAR(100),
  processing_time_ms INTEGER,
  api_cost_usd DECIMAL(10,6),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transcripts_speech ON transcripts(speech_id);

-- ============================================
-- TRANSCRIPT_WORDS (Word-level timestamps)
-- ============================================

CREATE TABLE transcript_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID REFERENCES transcripts(id) ON DELETE CASCADE,
  word_index INTEGER NOT NULL,
  text VARCHAR(255) NOT NULL,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  confidence DECIMAL(5,4),
  speaker VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transcript_words_transcript ON transcript_words(transcript_id);
CREATE INDEX idx_transcript_words_time ON transcript_words(transcript_id, start_ms);
CREATE INDEX idx_transcript_words_index ON transcript_words(transcript_id, word_index);

-- ============================================
-- FEEDBACK
-- ============================================

CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speech_id UUID UNIQUE REFERENCES speeches(id) ON DELETE CASCADE,
  google_doc_id VARCHAR(255),
  google_doc_url TEXT NOT NULL,
  scores JSONB,
  qualitative_feedback JSONB,
  llm_provider VARCHAR(50) NOT NULL,
  llm_model VARCHAR(100) NOT NULL,
  prompt_version INTEGER,
  processing_time_ms INTEGER,
  api_cost_usd DECIMAL(10,6),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_feedback_speech ON feedback(speech_id);
CREATE INDEX idx_feedback_doc ON feedback(google_doc_id);
CREATE INDEX idx_feedback_provider ON feedback(llm_provider);

-- ============================================
-- RUBRICS
-- ============================================

CREATE TABLE rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(255) NOT NULL,
  student_level VARCHAR(50) NOT NULL CHECK (student_level IN ('primary', 'secondary', 'both')),
  scoring_type VARCHAR(50) CHECK (scoring_type IN ('NA', '1-5', 'qualitative')),
  description TEXT,
  criteria JSONB,
  weight DECIMAL(3,2) DEFAULT 1.0,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rubrics_level ON rubrics(student_level, is_active);
CREATE INDEX idx_rubrics_category ON rubrics(category);
CREATE INDEX idx_rubrics_order ON rubrics(display_order);

-- ============================================
-- PROMPT_TEMPLATES
-- ============================================

CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  student_level VARCHAR(50) NOT NULL CHECK (student_level IN ('primary', 'secondary', 'both')),
  template_type VARCHAR(50) CHECK (template_type IN ('scoring', 'qualitative', 'full', 'context')),
  prompt_text TEXT NOT NULL,
  variables JSONB,
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_prompts_active ON prompt_templates(student_level, template_type, is_active);
CREATE INDEX idx_prompts_version ON prompt_templates(name, version DESC);

-- ============================================
-- STORAGE_CLEANUP_LOG
-- ============================================

CREATE TABLE storage_cleanup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID REFERENCES debates(id) ON DELETE SET NULL,
  action VARCHAR(50) CHECK (action IN ('uploaded_to_drive', 'deleted_local', 'failed')),
  files_count INTEGER,
  total_size_bytes BIGINT,
  google_drive_folder_id VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cleanup_debate ON storage_cleanup_log(debate_id);
CREATE INDEX idx_cleanup_created ON storage_cleanup_log(created_at DESC);

-- ============================================
-- API_USAGE_TRACKING
-- ============================================

CREATE TABLE api_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speech_id UUID REFERENCES speeches(id) ON DELETE SET NULL,
  api_provider VARCHAR(50) NOT NULL,
  api_endpoint VARCHAR(255),
  request_tokens INTEGER,
  response_tokens INTEGER,
  total_cost_usd DECIMAL(10,6),
  response_time_ms INTEGER,
  status VARCHAR(50),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_usage_speech ON api_usage_tracking(speech_id);
CREATE INDEX idx_api_usage_provider ON api_usage_tracking(api_provider);
CREATE INDEX idx_api_usage_created ON api_usage_tracking(created_at DESC);

-- ============================================
-- SYSTEM_SETTINGS
-- ============================================

CREATE TABLE system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO system_settings (key, value, description) VALUES
('llm_providers', '{"default": "gemini_flash", "available": ["gemini_flash", "gemini_pro", "claude", "openai", "grok"]}', 'Available LLM providers for feedback generation'),
('storage_cleanup_threshold', '2', 'Number of debates before triggering cleanup'),
('max_upload_size_mb', '100', 'Maximum audio file upload size in MB'),
('transcription_timeout_minutes', '5', 'Timeout for transcription jobs'),
('feedback_timeout_minutes', '10', 'Timeout for feedback generation jobs');

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_schedules_updated_at BEFORE UPDATE ON schedules
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rubrics_updated_at BEFORE UPDATE ON rubrics
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_templates_updated_at BEFORE UPDATE ON prompt_templates
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS
-- ============================================

-- View: Debate overview with speech counts
CREATE VIEW debate_overview AS
SELECT
  d.id,
  d.motion,
  d.format,
  d.student_level,
  d.status,
  d.created_at,
  u.name AS teacher_name,
  COUNT(s.id) AS total_speeches,
  COUNT(CASE WHEN s.transcription_status = 'completed' THEN 1 END) AS transcribed_speeches,
  COUNT(CASE WHEN s.feedback_status = 'completed' THEN 1 END) AS feedback_completed
FROM debates d
LEFT JOIN users u ON d.teacher_id = u.id
LEFT JOIN speeches s ON d.id = s.debate_id
GROUP BY d.id, u.name;

-- View: Speech processing status
CREATE VIEW speech_processing_status AS
SELECT
  s.id,
  s.speaker_name,
  s.speaker_position,
  d.motion,
  s.upload_status,
  s.transcription_status,
  s.feedback_status,
  f.google_doc_url,
  s.created_at,
  s.transcription_completed_at,
  s.feedback_completed_at,
  EXTRACT(EPOCH FROM (s.transcription_completed_at - s.transcription_started_at)) AS transcription_duration_seconds,
  EXTRACT(EPOCH FROM (s.feedback_completed_at - s.feedback_started_at)) AS feedback_duration_seconds
FROM speeches s
JOIN debates d ON s.debate_id = d.id
LEFT JOIN feedback f ON s.id = f.speech_id;

-- ============================================
-- SAMPLE DATA (for testing)
-- ============================================

-- Insert sample admin user
INSERT INTO users (email, name, role) VALUES
('admin@capstone.com', 'Admin User', 'admin');

-- Insert sample teachers
INSERT INTO users (email, name, role) VALUES
('teacher1@capstone.com', 'Teacher One', 'teacher'),
('teacher2@capstone.com', 'Teacher Two', 'teacher');

-- Insert sample students
INSERT INTO students (name, level) VALUES
('Alice Johnson', 'primary'),
('Bob Smith', 'primary'),
('Charlie Brown', 'secondary'),
('Diana Prince', 'secondary');

-- Insert sample rubrics for primary level
INSERT INTO rubrics (name, category, student_level, scoring_type, description, criteria, display_order) VALUES
('Argumentation', 'Content', 'primary', '1-5', 'Clarity of claims, use of reasoning and examples',
'{"5": "Clear claims with strong reasoning and relevant examples", "3": "Some clear claims but weak reasoning", "1": "Unclear claims with little reasoning"}', 1),
('Delivery & Clarity', 'Delivery', 'primary', '1-5', 'Speaking pace, volume, clarity, eye contact',
'{"5": "Excellent pace, clear voice, good eye contact", "3": "Adequate delivery with some issues", "1": "Poor delivery, hard to understand"}', 2),
('Structure', 'Content', 'primary', '1-5', 'Logical organization and signposting',
'{"5": "Clear structure with excellent signposting", "3": "Basic structure present", "1": "No clear structure"}', 3),
('Engagement', 'Delivery', 'primary', '1-5', 'Energy, enthusiasm, connection with audience',
'{"5": "Highly engaging and enthusiastic", "3": "Somewhat engaging", "1": "No engagement"}', 4);

-- Insert sample rubrics for secondary level
INSERT INTO rubrics (name, category, student_level, scoring_type, description, criteria, display_order) VALUES
('Argumentation', 'Content', 'secondary', '1-5', 'Depth of analysis, logical reasoning, and evidence',
'{"5": "Sophisticated analysis with strong evidence", "3": "Adequate arguments with some evidence", "1": "Weak arguments, no evidence"}', 1),
('Rebuttal Quality', 'Content', 'secondary', '1-5', 'Direct clash with opposing arguments',
'{"5": "Direct, specific refutation of key arguments", "3": "Some engagement with opposition", "1": "No meaningful rebuttal"}', 2),
('Evidence & Examples', 'Content', 'secondary', '1-5', 'Use of data, studies, real-world examples',
'{"5": "Multiple credible sources cited effectively", "3": "Some examples used", "1": "No evidence provided"}', 3),
('Speaking Rate & Clarity', 'Delivery', 'secondary', '1-5', 'Appropriate pace, minimal filler words',
'{"5": "Perfect pace, no fillers, crystal clear", "3": "Acceptable pace with some fillers", "1": "Too fast/slow, excessive fillers"}', 4),
('Role Fulfillment', 'Strategy', 'secondary', '1-5', 'Fulfillment of position-specific duties',
'{"5": "Perfectly executed role requirements", "3": "Basic role requirements met", "1": "Failed to fulfill role"}', 5);

-- Insert sample prompt template
INSERT INTO prompt_templates (name, student_level, template_type, prompt_text, version) VALUES
('Primary Feedback Template', 'primary', 'full',
'You are an expert debate coach providing feedback to a primary level student.

DEBATE MOTION: {motion}
SPEAKER POSITION: {position}
SPEECH DURATION: {duration} seconds

ROLE REQUIREMENTS FOR {position}:
{role_description}

PREVIOUS SPEECHES CONTEXT:
{prior_speeches}

CURRENT SPEECH TRANSCRIPT:
{transcript}

Please analyze this speech and provide:
1. Scores (1-5) for: Argumentation, Delivery & Clarity, Structure, Engagement
2. Qualitative feedback (3-4 bullet points per category)

Focus on being encouraging while identifying specific areas for improvement.
Format response as JSON with "scores" and "feedback" objects.', 1);

-- ============================================
-- GRANTS (adjust based on your user setup)
-- ============================================

-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO debate_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO debate_app_user;
