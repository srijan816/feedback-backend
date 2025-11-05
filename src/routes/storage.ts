/**
 * Storage Route - Serve Audio Files
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

/**
 * GET /storage/*
 * Serve audio files from storage directory
 */
router.get('/storage/*', (req: Request, res: Response) => {
  try {
    // Extract the file path after /storage/
    const filePath = req.path.replace('/storage/', '');
    const fullPath = path.join(process.cwd(), 'storage', filePath);

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      res.status(404).send('Audio file not found');
      return;
    }

    // Determine content type based on file extension
    const ext = path.extname(fullPath).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');

    // Get file stats for content-length
    const stat = fs.statSync(fullPath);
    res.setHeader('Content-Length', stat.size);

    // Stream the file
    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);

  } catch (error) {
    console.error('Error serving audio file:', error);
    res.status(500).send('Error serving audio file');
  }
});

export default router;
