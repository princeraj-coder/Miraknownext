// ─────────────────────────────────────────────────────────────────────────────
//  api/ai/chat.js — Unified Multi-Model Chat & Real-Time Streaming API
// ─────────────────────────────────────────────────────────────────────────────
import { modelRegistry } from '../../server/providers/registry.js';
import { rateLimiter } from '../../server/rate-limiter.js';
import { authenticateRequest } from '../../server/auth-helper.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // 1. Authenticate Request
  const { user, error: authError } = await authenticateRequest(req);
  if (authError || !user) {
    return res.status(401).json({
      error: authError || 'Unauthorized: You must be signed in to Mira Workspace to access AI models.'
    });
  }

  // 2. Validate Payload
  const { provider: providerId, model: modelId, messages, stream = true, temperature = 0.7, maxTokens = 4096 } = req.body || {};

  if (!providerId || !modelId) {
    return res.status(400).json({ error: 'Missing required fields: provider and model are required.' });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid messages: At least one message is required.' });
  }

  // 3. Validate Provider & Model Allowlist
  const provider = modelRegistry.getProvider(providerId);
  if (!provider) {
    return res.status(400).json({
      error: `Unsupported provider '${providerId}'. Supported providers are: ${modelRegistry.getAllProviders().map(p => p.id).join(', ')}`
    });
  }

  const modelDef = provider.models.find(m => m.id === modelId);
  if (!modelDef) {
    return res.status(400).json({
      error: `Model '${modelId}' is not supported by provider '${provider.name}'.`
    });
  }

  if (!provider.isConfigured()) {
    return res.status(503).json({
      error: `Provider '${provider.name}' is not configured. An administrator must set the ${provider.envKey} environment variable.`,
      code: 'PROVIDER_NOT_CONFIGURED',
      provider: providerId,
      envKey: provider.envKey
    });
  }

  // 4. Rate Limiting Check
  const rateLimitCheck = rateLimiter.checkLimit(user.id);
  if (!rateLimitCheck.allowed) {
    return res.status(429).json({ error: rateLimitCheck.message, code: 'RATE_LIMIT_EXCEEDED' });
  }

  // 5. Concurrency Lock
  if (!rateLimiter.acquireLock(user.id)) {
    return res.status(429).json({
      error: 'A generation is already in progress. Please wait for the current response to finish or cancel it.',
      code: 'CONCURRENT_GENERATION'
    });
  }

  // 6. Handle Execution (Streaming or Standard)
  try {
    if (stream) {
      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });

      // Send initial metadata
      res.write(`data: ${JSON.stringify({ type: 'start', provider: provider.id, model: modelId })}\n\n`);

      const result = await provider.streamChat(
        { model: modelId, messages, temperature, maxTokens },
        (delta) => {
          res.write(`data: ${JSON.stringify({ type: 'chunk', delta })}\n\n`);
        }
      );

      // Record rate limit & usage
      rateLimiter.recordRequest(user.id);

      // Send completion & usage event
      res.write(`data: ${JSON.stringify({ type: 'done', text: result.text, usage: result.usage })}\n\n`);
      return res.end();
    } else {
      const result = await provider.chat({ model: modelId, messages, temperature, maxTokens });
      rateLimiter.recordRequest(user.id);
      return res.status(200).json({
        provider: provider.id,
        model: modelId,
        text: result.text,
        usage: result.usage
      });
    }
  } catch (err) {
    console.error(`[AI Chat Error - ${provider.name}/${modelId}]`, err.message);
    const safeError = err.message || 'An error occurred during AI generation.';

    if (stream) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: safeError })}\n\n`);
      return res.end();
    } else {
      return res.status(500).json({ error: safeError });
    }
  } finally {
    rateLimiter.releaseLock(user.id);
  }
}
