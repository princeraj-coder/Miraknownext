// ─────────────────────────────────────────────────────────────────────────────
//  api/ai/models.js — Model Catalog & Provider Status API
// ─────────────────────────────────────────────────────────────────────────────
import { modelRegistry } from '../../server/providers/registry.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const catalog = modelRegistry.getModelsCatalog();
    const availableModels = modelRegistry.getAvailableModels();

    return res.status(200).json({
      providers: catalog,
      availableCount: availableModels.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[API /api/ai/models error]', err);
    return res.status(500).json({ error: 'Failed to retrieve AI model catalog' });
  }
}
