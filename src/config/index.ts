import dotenv from 'dotenv';
import { LLMProvider } from '../types/index.js';

dotenv.config();

interface Config {
  server: {
    port: number;
    env: string;
    apiBaseUrl: string;
    webhookBaseUrl?: string; // Base URL for webhooks (e.g., https://yourdomain.com)
  };
  database: {
    url: string;
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  redis: {
    url: string;
    host: string;
    port: number;
    password?: string;
  };
  jwt: {
    secret: string;
    expiry: string;
    refreshSecret: string;
    refreshExpiry: string;
  };
  storage: {
    path: string;
    maxUploadSizeMB: number;
    allowedFormats: string[];
  };
  googleDrive: {
    folderId: string;
    credentialsPath: string;
  };
  googleCloud: {
    clientEmail: string;
    privateKey: string;
    projectId: string;
  };
  apis: {
    assemblyai: {
      apiKey: string;
    };
    gemini: {
      apiKeys: string[];
      modelFlash: string;
      modelPro: string;
    };
    claude: {
      apiKey: string;
      model: string;
    };
    grok: {
      apiKey: string;
      model: string;
      apiUrl: string;
    };
  };
  llm: {
    defaultProvider: LLMProvider;
    temperature: number;
    maxTokens: number;
  };
  processing: {
    cleanupThreshold: number;
    transcriptionTimeoutMinutes: number;
    feedbackTimeoutMinutes: number;
    maxRetries: number;
  };
  rateLimiting: {
    windowMs: number;
    maxRequests: number;
    uploadMaxRequests: number;
  };
  cors: {
    allowedOrigins: string[];
  };
  logging: {
    level: string;
    filePath: string;
  };
  features: {
    enableOfflineMode: boolean;
    enableVideoRecording: boolean;
    enablePatternAnalysis: boolean;
  };
  institution: {
    default: string;
  };
}

const config: Config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    webhookBaseUrl: process.env.WEBHOOK_BASE_URL, // Set this to enable AssemblyAI webhooks (50-80% faster)
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/debate_feedback',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'debate_feedback',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiry: process.env.JWT_EXPIRY || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '30d',
  },
  storage: {
    path: process.env.STORAGE_PATH || './storage',
    maxUploadSizeMB: parseInt(process.env.MAX_UPLOAD_SIZE_MB || '100', 10),
    allowedFormats: (process.env.ALLOWED_AUDIO_FORMATS || 'm4a,aac,mp3,wav').split(','),
  },
  googleDrive: {
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
    credentialsPath: process.env.GOOGLE_DRIVE_CREDENTIALS_PATH || './config/google-credentials.json',
  },
  googleCloud: {
    clientEmail: process.env.GOOGLE_CLIENT_EMAIL || '',
    privateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    projectId: process.env.GOOGLE_PROJECT_ID || '',
  },
  apis: {
    assemblyai: {
      apiKey: process.env.ASSEMBLYAI_API_KEY || '',
    },
    gemini: {
      apiKeys: [
        process.env.GEMINI_API_KEY_1,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3,
        process.env.GEMINI_API_KEY_4,
      ].filter(Boolean) as string[],
      modelFlash: process.env.GEMINI_MODEL_FLASH || 'gemini-2.5-flash-latest',
      modelPro: process.env.GEMINI_MODEL_PRO || 'gemini-2.5-pro',
    },
    claude: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
    },
    grok: {
      apiKey: process.env.GROK_API_KEY || '',
      model: process.env.GROK_MODEL || 'grok-beta',
      apiUrl: process.env.GROK_API_URL || 'https://api.x.ai/v1',
    },
  },
  llm: {
    defaultProvider: (process.env.DEFAULT_LLM_PROVIDER || 'gemini_flash') as LLMProvider,
    temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.4'),
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '8192', 10),
  },
  processing: {
    cleanupThreshold: parseInt(process.env.STORAGE_CLEANUP_THRESHOLD || '2', 10),
    transcriptionTimeoutMinutes: parseInt(process.env.TRANSCRIPTION_TIMEOUT_MINUTES || '5', 10),
    feedbackTimeoutMinutes: parseInt(process.env.FEEDBACK_TIMEOUT_MINUTES || '10', 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
  },
  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    uploadMaxRequests: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX || '10', 10),
  },
  cors: {
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs/app.log',
  },
  features: {
    enableOfflineMode: process.env.ENABLE_OFFLINE_MODE === 'true',
    enableVideoRecording: process.env.ENABLE_VIDEO_RECORDING === 'true',
    enablePatternAnalysis: process.env.ENABLE_PATTERN_ANALYSIS === 'true',
  },
  institution: {
    default: process.env.DEFAULT_INSTITUTION || 'capstone',
  },
};

export default config;
