import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';

import config from './config/index.js';
import logger from './utils/logger.js';
import { testConnection } from './config/database.js';
import { connectRedis } from './config/redis.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Import routes (will be created)
import authRoutes from './routes/auth.js';
import debateRoutes from './routes/debates.js';
import speechRoutes from './routes/speeches.js';
import scheduleRoutes from './routes/schedules.js';
import promptRoutes from './routes/prompts.js';
import promptsWebRoutes from './routes/promptsWeb.js';
import healthRoutes from './routes/health.js';
import uploadRoutes from './routes/upload.js';
import uploadWebRoutes from './routes/uploadWeb.js';
import feedbackViewerRoutes from './routes/feedbackViewer.js';
import testFeedbackRoutes from './routes/testFeedback.js';
import testFeedbackV2Routes from './routes/testFeedbackV2.js';
import storageRoutes from './routes/storage.js';
import webhookRoutes from './routes/webhooks.js';
import teacherPortalRoutes from './routes/teacherPortal.js';
import motionRoutes from './routes/motions.js';
import adminAuthRoutes from './routes/adminAuth.js';

const app: Application = express();

// Trust proxy - required for Nginx reverse proxy
app.set('trust proxy', true);

// Debug: Log that upload routes were imported
logger.info('Upload routes module loaded successfully');

// Create storage directories if they don't exist
if (!fs.existsSync(config.storage.path)) {
  fs.mkdirSync(config.storage.path, { recursive: true });
  logger.info(`Created storage directory at ${config.storage.path}`);
}

const uploadsDir = path.join(config.storage.path, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  logger.info(`Created uploads directory at ${uploadsDir}`);
}

// Security middleware
// Configure helmet with relaxed CSP for upload routes
app.use((req, res, next) => {
  // For upload UI routes, feedback viewer, and teacher portal, allow inline scripts and don't upgrade to HTTPS
  const teacherPortalPaths = ['srijan', 'tamkeen', 'mai', 'saurav', 'jami', 'naveen'];
  const isTeacherPortal = teacherPortalPaths.some(name => req.path.startsWith(`/${name}`));

  if (req.path === '/upload' || req.path === '/upload-debate' || req.path.startsWith('/prompts') || req.path.startsWith('/feedback') || req.path === '/feedbacktest1' || req.path === '/feedbacktest2' || req.path.startsWith('/admin') || isTeacherPortal) {
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io"],
          scriptSrcAttr: ["'unsafe-inline'"],  // Allow inline event handlers (onclick, etc)
          styleSrc: ["'self'", "'unsafe-inline'", "https:"],
          imgSrc: ["'self'", "data:"],
          fontSrc: ["'self'", "https:", "data:"],
          mediaSrc: ["'self'"],  // Allow audio/video from same origin
          connectSrc: ["'self'", "ws:", "wss:"],  // Allow WebSocket connections
          formAction: ["'self'"],
          upgradeInsecureRequests: null, // Don't force HTTPS upgrade
        },
      },
      hsts: false, // Disable HSTS for development
    })(req, res, next);
  } else {
    // Strict CSP for API routes
    helmet()(req, res, next);
  }
});

app.use(
  cors({
    origin: config.cors.allowedOrigins[0] === '*' ? '*' : config.cors.allowedOrigins,
    credentials: config.cors.allowedOrigins[0] === '*' ? false : true,
  })
);

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (config.server.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(
    morgan('combined', {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    })
  );
}

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimiting.windowMs,
  max: config.rateLimiting.maxRequests,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    trustProxy: false, // Disable trust proxy validation since we're behind nginx
  },
});
app.use('/api/', limiter);

// Upload rate limiting (stricter)
const uploadLimiter = rateLimit({
  windowMs: config.rateLimiting.windowMs,
  max: config.rateLimiting.uploadMaxRequests,
  message: 'Too many uploads, please try again later',
  validate: {
    trustProxy: false, // Disable trust proxy validation since we're behind nginx
  },
});

// Serve static files for teacher portal
app.use('/uploads/docx', express.static(path.join(process.cwd(), 'uploads', 'docx')));

// Serve admin pages
app.get('/admin/motions', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'admin', 'motions.html'));
});

app.get('/admin/get-token', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'admin', 'get-token.html'));
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', adminAuthRoutes); // Admin token helper
app.use('/api/debates', debateRoutes);
app.use('/api/speeches', speechRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/prompts', promptRoutes);
app.use('/api/motions', motionRoutes);
app.use('/prompts', promptsWebRoutes); // Web UI for prompt management
app.use('/upload-debate', uploadWebRoutes); // Web UI for debate upload
app.use('/upload', uploadLimiter, uploadRoutes); // Upload endpoint with stricter rate limiting
logger.info('Upload route registered at /upload');
app.use('/api/health', healthRoutes);
app.use('/webhooks', webhookRoutes); // Webhook endpoints for external services
logger.info('Webhook route registered at /webhooks');
app.use('/feedback', feedbackViewerRoutes); // Feedback HTML viewer
logger.info('Feedback viewer route registered at /feedback');
app.use('/', testFeedbackRoutes); // Test feedback V1 viewer
logger.info('Test feedback route registered at /feedbacktest1');
app.use('/', testFeedbackV2Routes); // Test feedback V2 viewer with playable moments
logger.info('Test feedback V2 route registered at /feedbacktest2');
app.use('/', storageRoutes); // Serve audio files from storage
logger.info('Storage route registered at /storage');

// Teacher Portal API routes
app.use('/', teacherPortalRoutes);
logger.info('Teacher portal API routes registered');

// Teacher Portal HTML routes
const validTeachers = ['srijan', 'tamkeen', 'mai', 'saurav', 'jami', 'naveen'];
validTeachers.forEach(teacherName => {
  app.get(`/${teacherName}`, (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'teacher-portal', 'dashboard.html'));
  });
  logger.info(`Teacher portal route registered at /${teacherName}`);
});

// Apply upload rate limiter to speech upload endpoint
app.use('/api/debates/:debateId/speeches', uploadLimiter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Debate Feedback API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Graceful shutdown handler
let server: any;

async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, starting graceful shutdown...`);

  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }

  // Close database and Redis connections
  const { closePool } = await import('./config/database.js');
  const { disconnectRedis } = await import('./config/redis.js');
  const { closeQueues } = await import('./config/queue.js');

  await Promise.all([closePool(), disconnectRedis(), closeQueues()]);

  logger.info('Graceful shutdown completed');
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

// Start server
async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      throw new Error('Failed to connect to database');
    }

    // Connect to Redis
    await connectRedis();

    // Start HTTP server
    const http = await import('http');
    const httpServer = http.createServer(app);
    server = httpServer;

    // Initialize WebSocket
    const { initializeWebSocket } = await import('./services/websocket.js');
    initializeWebSocket(httpServer);
    logger.info('WebSocket server initialized');

    // Start listening
    httpServer.listen(config.server.port, () => {
      logger.info(`Server running on port ${config.server.port}`, {
        env: config.server.env,
        nodeVersion: process.version,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

// Start the server
startServer();

export default app;
