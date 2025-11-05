import { Router, Request, Response } from 'express';
import { handleAssemblyAIWebhook } from '../services/transcription.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * AssemblyAI Webhook Endpoint
 *
 * This endpoint receives callbacks from AssemblyAI when transcription jobs complete.
 * This is 50-80% faster than polling every 3 seconds.
 *
 * POST /webhooks/assemblyai
 */
router.post('/assemblyai', async (req: Request, res: Response): Promise<void> => {
  try {
    logger.info('Received AssemblyAI webhook', {
      body: req.body,
      headers: req.headers,
    });

    const { transcript_id, status } = req.body;

    if (!transcript_id) {
      res.status(400).json({
        error: 'Missing transcript_id in webhook payload',
      });
      return;
    }

    // Handle the webhook asynchronously (don't block response)
    handleAssemblyAIWebhook(transcript_id, status).catch((error) => {
      logger.error('Error handling AssemblyAI webhook', {
        error,
        transcript_id,
        status,
      });
    });

    // Respond immediately to AssemblyAI
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error('AssemblyAI webhook error', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
