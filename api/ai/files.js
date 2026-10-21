// ─────────────────────────────────────────────────────────────────────────────
//  api/ai/files.js — File Upload & Document Extraction API (Azure Blob Storage)
// ─────────────────────────────────────────────────────────────────────────────
import { azureStorage } from '../../server/azure-storage.js';
import { authenticateRequest } from '../../server/auth-helper.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '16mb'
    }
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // 1. Authenticate Request
  const { user, error: authError } = await authenticateRequest(req);
  if (authError || !user) {
    return res.status(401).json({
      error: authError || 'Unauthorized: Please sign in to upload files for AI analysis.'
    });
  }

  try {
    const { filename, mimeType, dataBase64, conversationId } = req.body || {};

    if (!filename || !dataBase64) {
      return res.status(400).json({ error: 'Missing required file data (filename, dataBase64).' });
    }

    const buffer = Buffer.from(dataBase64, 'base64');

    // 15 MB max limit
    if (buffer.length > 15 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds maximum allowed limit of 15 MB.' });
    }

    const uploadResult = await azureStorage.uploadFile({
      userId: user.id,
      conversationId: conversationId || 'general',
      filename,
      mimeType: mimeType || 'application/octet-stream',
      buffer
    });

    return res.status(200).json({
      success: true,
      file: uploadResult
    });
  } catch (err) {
    console.error('[API /api/ai/files error]', err);
    return res.status(500).json({ error: err.message || 'File upload failed' });
  }
}
