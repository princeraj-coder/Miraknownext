// ─────────────────────────────────────────────────────────────────────────────
//  server/providers/registry.js — Central AI Provider & Model Registry
//  Active Providers: Google Gemini, OpenAI, DeepSeek
// ─────────────────────────────────────────────────────────────────────────────
import { GeminiProvider } from './gemini.js';
import { OpenAIProvider } from './openai.js';
import { DeepSeekProvider } from './deepseek.js';

export class ModelRegistry {
  constructor() {
    this.providers = new Map();

    // Register active configured providers
    this.register(new GeminiProvider());
    this.register(new OpenAIProvider());
    this.register(new DeepSeekProvider());
  }

  register(provider) {
    this.providers.set(provider.id, provider);
  }

  getProvider(providerId) {
    return this.providers.get(providerId);
  }

  getAllProviders() {
    return Array.from(this.providers.values());
  }

  /**
   * Returns list of all providers with their configuration status and supported models
   * Only returns public metadata (NEVER exposes API keys!)
   */
  getModelsCatalog() {
    return this.getAllProviders().map(p => {
      const configured = p.isConfigured();
      return {
        id: p.id,
        name: p.name,
        envKey: p.envKey,
        brandColor: p.brandColor,
        icon: p.icon,
        isConfigured: configured,
        models: p.models.map(m => ({
          ...m,
          providerId: p.id,
          providerName: p.name,
          isAvailable: configured
        }))
      };
    });
  }

  /**
   * Returns only configured and available models
   */
  getAvailableModels() {
    const catalog = this.getModelsCatalog();
    const available = [];
    for (const p of catalog) {
      if (p.isConfigured) {
        for (const m of p.models) {
          available.push(m);
        }
      }
    }
    return available;
  }

  /**
   * Find a specific model and its provider by modelId
   */
  findModel(modelId, providerHint = null) {
    if (providerHint && this.providers.has(providerHint)) {
      const p = this.providers.get(providerHint);
      const model = p.models.find(m => m.id === modelId);
      if (model) return { provider: p, model };
    }

    for (const p of this.providers.values()) {
      const model = p.models.find(m => m.id === modelId);
      if (model) return { provider: p, model };
    }

    return null;
  }
}

// Global singleton instance
export const modelRegistry = new ModelRegistry();
