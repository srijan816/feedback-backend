// Core Types for Debate Feedback Platform

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'teacher' | 'admin';
  institution: string;
  device_id?: string;
  created_at: Date;
  last_login?: Date;
}

export interface Student {
  id: string;
  name: string;
  level: 'primary' | 'secondary';
  institution: string;
  is_active: boolean;
  created_at: Date;
}

export interface Schedule {
  id: string;
  teacher_id: string;
  class_id: string;
  day_of_week: number; // 0-6
  start_time: string; // HH:MM:SS
  end_time: string;
  suggested_motion?: string;
  default_format: DebateFormat;
  default_speech_time: number;
  is_active: boolean;
}

export type DebateFormat =
  | 'WSDC'
  | 'Modified WSDC'
  | 'BP'
  | 'AP'
  | 'Australs'
  | 'LD'
  | 'PF';

export type StudentLevel = 'primary' | 'secondary';

export interface Debate {
  id: string;
  teacher_id?: string;
  motion: string;
  format: DebateFormat;
  student_level: StudentLevel;
  speech_time_seconds: number;
  reply_time_seconds?: number;
  status: 'in_progress' | 'completed' | 'cancelled';
  is_guest_session: boolean;
  created_at: Date;
  completed_at?: Date;
}

export interface DebateParticipant {
  id: string;
  debate_id: string;
  student_id?: string;
  student_name: string;
  team: string; // 'prop', 'opp', 'og', 'oo', 'cg', 'co'
  position: string; // 'Prop 1', 'Opp 2', etc.
  speaker_order: number;
}

export interface Speech {
  id: string;
  debate_id: string;
  participant_id?: string;
  speaker_name: string;
  speaker_position: string;
  audio_file_path?: string;
  audio_file_url?: string;
  audio_file_drive_id?: string;
  duration_seconds?: number;
  file_size_bytes?: number;
  upload_status: 'pending' | 'uploading' | 'uploaded' | 'failed';
  transcription_status: 'pending' | 'processing' | 'completed' | 'failed';
  feedback_status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: Date;
  uploaded_at?: Date;
  transcription_started_at?: Date;
  transcription_completed_at?: Date;
  feedback_started_at?: Date;
  feedback_completed_at?: Date;
}

export interface Transcript {
  id: string;
  speech_id: string;
  transcript_text: string;
  word_count?: number;
  speaking_rate?: number; // words per minute
  filler_word_count?: number;
  api_provider: string;
  api_model?: string;
  processing_time_ms?: number;
  api_cost_usd?: number;
  created_at: Date;
}

export interface Feedback {
  id: string;
  speech_id: string;
  google_doc_id?: string;
  google_doc_url: string;
  scores: Record<string, number | 'NA'>;
  qualitative_feedback: Record<string, string[]>;
  llm_provider: string;
  llm_model: string;
  prompt_version?: number;
  processing_time_ms?: number;
  api_cost_usd?: number;
  created_at: Date;
}

export interface Rubric {
  id: string;
  name: string;
  category: string;
  student_level: StudentLevel | 'both';
  scoring_type: 'NA' | '1-5' | 'qualitative';
  description?: string;
  criteria?: Record<string, string>;
  weight: number;
  display_order: number;
  is_active: boolean;
}

export interface PromptTemplate {
  id: string;
  name: string;
  student_level: StudentLevel | 'both';
  template_type: 'scoring' | 'qualitative' | 'full' | 'context';
  prompt_text: string;
  variables?: Record<string, any>;
  version: number;
  is_active: boolean;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

// API Request/Response Types

/**
 * Login request - accepts either email OR teacher_id
 * iOS app sends: { teacher_id, device_id }
 * Web/other clients can send: { email, device_id }
 */
export interface LoginRequest {
  email?: string;
  teacher_id?: string;
  device_id: string;
}

/**
 * Login response - iOS-compatible format
 * Sends both 'teacher' (iOS format) and legacy 'user' field for backward compatibility
 */
export interface LoginResponse {
  token: string;
  teacher: {
    id: string;
    name: string;
    isAdmin: boolean;
  };
}

export interface CreateDebateRequest {
  teacher_id?: string;
  motion: string;
  format: DebateFormat;
  student_level: StudentLevel;
  teams: {
    prop?: Array<{ student_id?: string; name: string; position: string }>;
    opp?: Array<{ student_id?: string; name: string; position: string }>;
    og?: Array<{ student_id?: string; name: string; position: string }>;
    oo?: Array<{ student_id?: string; name: string; position: string }>;
    cg?: Array<{ student_id?: string; name: string; position: string }>;
    co?: Array<{ student_id?: string; name: string; position: string }>;
  };
  speech_time_seconds: number;
  reply_time_seconds?: number;
}

/**
 * Create debate response - iOS-compatible format
 * Sends both 'debateId' (iOS camelCase) and legacy 'debate_id' for backward compatibility
 */
export interface CreateDebateResponse {
  debate_id: string;
  created_at: Date;
}

export interface UploadSpeechRequest {
  audio_file: Express.Multer.File;
  speaker_name: string;
  speaker_position: string;
  duration_seconds: number;
  student_level: StudentLevel;
}

/**
 * Upload speech response - iOS-compatible format
 * Sends both camelCase (iOS) and snake_case (legacy) fields
 */
export interface UploadSpeechResponse {
  speechId: string; // iOS expects camelCase
  status: string;
  processingStarted: boolean; // iOS expects camelCase
  // Legacy fields for backward compatibility
  speech_id?: string;
  processing_started?: boolean;
  estimated_completion_seconds?: number;
}

/**
 * Speech status response - iOS-compatible format
 * iOS expects: { status, googleDocUrl, errorMessage }
 * Also includes legacy fields for backward compatibility
 */
export interface SpeechStatusResponse {
  status: 'pending' | 'processing' | 'complete' | 'failed';
  googleDocUrl: string | null;
  errorMessage: string | null;
  // Legacy fields for backward compatibility
  speech_id?: string;
  transcription_status?: string;
  feedback_status?: string;
  google_doc_url?: string;
  updated_at?: Date;
}

export interface FeedbackResponse {
  speech_id: string;
  google_doc_url: string;
  scores: Record<string, number | 'NA'>;
  qualitative_feedback: Record<string, string[]>;
  created_at: Date;
}

// Worker Job Types

export interface TranscriptionJobData {
  speech_id: string;
  audio_file_path: string;
  speaker_name: string;
  speaker_position: string;
}

export interface FeedbackJobData {
  speech_id: string;
  transcript_id: string;
  debate_id: string;
  motion: string;
  speaker_position: string;
  student_level: StudentLevel;
  llm_provider?: string;
}

export interface GoogleDocsJobData {
  speech_id: string;
  feedback_id: string;
  teacher_email?: string;
  student_name: string;
  student_level: StudentLevel;
}

export interface StorageCleanupJobData {
  teacher_id: string;
  debates_to_cleanup: string[];
}

// LLM Provider Types

export type LLMProvider = 'gemini_flash' | 'gemini_pro' | 'claude' | 'openai' | 'grok';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature: number;
  max_tokens: number;
  api_key: string;
}

export interface LLMResponse {
  text: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  cost?: number;
}

// Utility Types

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}
