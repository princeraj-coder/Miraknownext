// ─────────────────────────────────────────────────────────────────────────────
//  api/ai/config.js — Provider Connection Status & Diagnostic Test API
// ─────────────────────────────────────────────────────────────────────────────
import { modelRegistry } from '../../server/providers/registry.js';
import { azureStorage } from '../../server/azure-storage.js';
import { rateLimiter } from '../../server/rate-limiter.js';
import { authenticateRequest } from '../../server/auth-helper.js';

export default async function handler(req, res) {
  // GET: Return public connection status overview
  if (req.method === 'GET') {
    const providers = modelRegistry.getAllProviders().map(p => ({
      id: p.id,
      name: p.name,
      envKey: p.envKey,
      brandColor: p.brandColor,
      isConfigured: p.isConfigured(),
      modelsCount: p.models.length
    }));

    const azureStatus = {
      isConfigured: azureStorage.isConfigured(),
      containerName: azureStorage.containerName
    };

    const stats = rateLimiter.getAdminStats();

    return res.status(200).json({
      providers,
      azureStorage: azureStatus,
      usageStats: stats,
      serverTime: new Date().toISOString()
    });
  }

  // POST: Run a diagnostic test connection for a specific provider (authenticated)
  if (req.method === 'POST') {
    const { user, error: authError } = await authenticateRequest(req);
    if (authError || !user) {
      return res.status(401).json({ error: authError || 'Unauthorized: Authentication required.' });
    }

    const { providerId, testAzure } = req.body || {};

    if (testAzure) {
      const result = await azureStorage.testConnection();
      return res.status(200).json(result);
    }

    if (!providerId) {
      return res.status(400).json({ error: 'Missing providerId.' });
    }

    const provider = modelRegistry.getProvider(providerId);
    if (!provider) {
      return res.status(404).json({ error: `Provider '${providerId}' not found.` });
    }

    try {
      const testResult = await provider.testConnection();
      return res.status(200).json({
        providerId,
        name: provider.name,
        envKey: provider.envKey,
        isConfigured: provider.isConfigured(),
        ...testResult
      });
    } catch (e) {
      return res.status(500).json({ success: false, message: e.message });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}
