import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import logger from '../utils/logger.js';
import { query } from '../config/database.js';

let io: SocketIOServer | null = null;

/**
 * Initialize WebSocket server
 */
export function initializeWebSocket(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*', // Allow all origins (adjust for production security)
      methods: ['GET', 'POST'],
      credentials: false,
    },
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    allowEIO3: true, // Allow Engine.IO v3 clients
  });

  io.on('connection', (socket) => {
    logger.info(`[WebSocket] Client connected: ${socket.id}`);

    // Join teacher-specific room
    socket.on('join:teacher', async (data: { teacherId: string; teacherName: string }) => {
      const room = `teacher:${data.teacherId}`;
      await socket.join(room);
      logger.info(`[WebSocket] Client ${socket.id} joined room: ${room}`);

      socket.emit('joined', {
        room,
        message: `Connected to teacher ${data.teacherName}'s portal`,
      });
    });

    // Save note (real-time collaboration)
    socket.on('note:save', async (data) => {
      try {
        logger.info(`[WebSocket] Note save requested:`, data);
        // Broadcast to other clients in same room
        socket.to(`teacher:${data.teacherId}`).emit('note:saved', data);
      } catch (error) {
        logger.error('[WebSocket] Error saving note:', error);
        socket.emit('error', { message: 'Failed to save note' });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      logger.info(`[WebSocket] Client disconnected: ${socket.id}`);
    });

    // Error handling
    socket.on('error', (error) => {
      logger.error(`[WebSocket] Socket error for ${socket.id}:`, error);
    });
  });

  logger.info('[WebSocket] WebSocket server initialized');

  return io;
}

/**
 * Emit event to a specific teacher's room
 */
export function emitToTeacher(
  teacherId: string,
  event: string,
  data: any
): void {
  if (!io) {
    logger.warn('[WebSocket] Socket.io not initialized');
    return;
  }

  const room = `teacher:${teacherId}`;
  io.to(room).emit(event, data);
  logger.info(`[WebSocket] Emitted ${event} to room ${room}`);
}

/**
 * Emit feedback ready event
 */
export function emitFeedbackReady(
  teacherId: string,
  feedbackData: {
    feedback_id: number;
    speech_id: number;
    student_name: string;
    generated_at: string;
  }
): void {
  emitToTeacher(teacherId, 'feedback:ready', feedbackData);
}

/**
 * Emit DOCX ready event
 */
export function emitDocxReady(
  teacherId: string,
  docxData: {
    feedback_id: number;
    docx_url: string;
    generated_at: string;
  }
): void {
  emitToTeacher(teacherId, 'docx:ready', docxData);
}

/**
 * Emit speech completed event
 */
export function emitSpeechCompleted(
  teacherId: string,
  speechData: {
    speech_id: number;
    speaker_name: string;
    duration_seconds: number;
    completed_at: string;
  }
): void {
  emitToTeacher(teacherId, 'speech:completed', speechData);
}

/**
 * Emit transcription ready event
 */
export function emitTranscriptionReady(
  teacherId: string,
  transcriptionData: {
    speech_id: number;
    word_count: number;
    speaking_rate: number;
  }
): void {
  emitToTeacher(teacherId, 'transcription:ready', transcriptionData);
}

/**
 * Get Socket.IO instance
 */
export function getIO(): SocketIOServer | null {
  return io;
}

export default {
  initializeWebSocket,
  emitToTeacher,
  emitFeedbackReady,
  emitDocxReady,
  emitSpeechCompleted,
  emitTranscriptionReady,
  getIO,
};
