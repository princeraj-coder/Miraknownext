// ─────────────────────────────────────────────────────────────────────────────
//  server/providers/base.js — Base Provider Abstraction
// ─────────────────────────────────────────────────────────────────────────────

export class BaseProvider {
  /**
   * @param {Object} options
   * @param {string} options.id - e.g. 'gemini', 'openai', 'deepseek'
   * @param {string} options.name - e.g. 'Google Gemini'
   * @param {string} options.envKey - e.g. 'GEMINI_API_KEY'
   * @param {string} options.icon - SVG path or markup
   * @param {string} options.brandColor - Hex color code
   * @param {Array<Object>} options.models - Array of supported models
   */
  constructor({ id, name, envKey, icon, brandColor, models = [] }) {
    this.id = id;
    this.name = name;
    this.envKey = envKey;
    this.icon = icon;
    this.brandColor = brandColor;
    this.models = models;
  }

  /**
   * Returns whether the provider has a valid API key configured on the server
   * @returns {boolean}
   */
  isConfigured() {
    const key = this.getApiKey();
    return Boolean(key && key.trim().length > 5 && !key.includes('your-') && !key.includes('placeholder'));
  }

  /**
   * Safe getter for API key from process.env
   * @returns {string}
   */
  getApiKey() {
    return (process.env[this.envKey] || '').trim();
  }

  /**
   * Test whether the configured credentials can connect to the provider API
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async testConnection() {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: `Missing ${this.envKey} environment variable on server.`
      };
    }
    return { success: true, message: 'Provider configured and ready.' };
  }

  /**
   * Stream a chat completion. Subclasses must implement this.
   * @param {Object} params
   * @param {string} params.model
   * @param {Array} params.messages
   * @param {number} [params.temperature]
   * @param {number} [params.maxTokens]
   * @param {Function} onChunk - Callback for delta text: (text: string, meta?: Object) => void
   * @returns {Promise<{text: string, usage?: Object}>}
   */
  async streamChat({ model, messages, temperature = 0.7, maxTokens = 4096 }, onChunk) {
    throw new Error(`streamChat() not implemented for provider ${this.id}`);
  }

  /**
   * Non-streaming chat completion fallback.
   * @param {Object} params
   * @returns {Promise<{text: string, usage?: Object}>}
   */
  async chat(params) {
    let fullText = '';
    const result = await this.streamChat(params, (chunk) => {
      fullText += chunk;
    });
    return { text: fullText, usage: result?.usage };
  }
}
