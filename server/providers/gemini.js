// ─────────────────────────────────────────────────────────────────────────────
//  server/providers/gemini.js — Google Gemini Provider Adapter
// ─────────────────────────────────────────────────────────────────────────────
import { BaseProvider } from './base.js';

export class GeminiProvider extends BaseProvider {
  constructor() {
    super({
      id: 'gemini',
      name: 'Google Gemini',
      envKey: 'GEMINI_API_KEY',
      brandColor: '#4285F4',
      icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 24c0-6.627-5.373-12-12-12 6.627 0 12-5.373 12-12 0 6.627 5.373 12 12 12-6.627 0-12 5.373-12 12z" fill="url(#gemini-grad)"/><defs><linearGradient id="gemini-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop stop-color="#4285F4"/><stop offset="0.5" stop-color="#9B72CB"/><stop offset="1" stop-color="#D96570"/></linearGradient></defs></svg>`,
      models: [
        {
          id: 'gemini-2.0-flash',
          name: 'Gemini 2.0 Flash',
          description: 'Next-gen flagship speed and multimodal reasoning (Default)',
          contextWindow: '1M tokens',
          capabilities: ['streaming', 'vision', 'fast', 'reasoning'],
          recommended: true
        },
        {
          id: 'gemini-1.5-pro',
          name: 'Gemini 1.5 Pro',
          description: 'Complex reasoning, extensive coding and analysis',
          contextWindow: '2M tokens',
          capabilities: ['streaming', 'vision', 'reasoning']
        },
        {
          id: 'gemini-1.5-flash',
          name: 'Gemini 1.5 Flash',
          description: 'Lightweight, ultra-fast responses for quick tasks',
          contextWindow: '1M tokens',
          capabilities: ['streaming', 'vision', 'fast']
        }
      ]
    });
  }

  getApiKey() {
    return (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY ||
      ''
    ).trim();
  }

  async testConnection() {
    if (!this.isConfigured()) {
      return { success: false, message: 'GEMINI_API_KEY is not configured in server environment.' };
    }
    try {
      const apiKey = this.getApiKey();
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, message: err.error?.message || `HTTP ${res.status} from Gemini API` };
      }
      return { success: true, message: 'Google Gemini API is connected and verified.' };
    } catch (err) {
      return { success: false, message: `Connection failed: ${err.message}` };
    }
  }

  async streamChat({ model, messages, temperature = 0.7, maxTokens = 4096 }, onChunk) {
    if (!this.isConfigured()) {
      throw new Error('Google Gemini provider is not configured. Please set GEMINI_API_KEY in server environment.');
    }

    const apiKey = this.getApiKey();
    const targetModel = model || 'gemini-2.0-flash';

    // Format Gemini contents and system instruction
    let systemInstruction = null;
    const contents = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = { parts: [{ text: msg.content }] };
        continue;
      }

      const role = msg.role === 'assistant' ? 'model' : 'user';
      const parts = [];

      // Append text content
      if (msg.content) {
        parts.push({ text: msg.content });
      }

      // Append attachments (images / text files)
      if (Array.isArray(msg.attachments)) {
        for (const att of msg.attachments) {
          if (att.dataUrl && att.dataUrl.startsWith('data:image/')) {
            const match = att.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              parts.push({
                inlineData: {
                  mimeType: match[1],
                  data: match[2]
                }
              });
            }
          } else if (att.extractedText) {
            parts.push({
              text: `\n[Attached File: ${att.name || 'document'}]\n${att.extractedText}\n`
            });
          }
        }
      }

      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }

    const requestBody = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens
      }
    };

    if (systemInstruction) {
      requestBody.systemInstruction = systemInstruction;
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:streamGenerateContent?key=${apiKey}&alt=sse`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const errorMsg = errorJson.error?.message || `Gemini API returned HTTP ${response.status}`;
      throw new Error(errorMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulatedText = '';
    let usageMetadata = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.slice(5).trim();
          if (!dataStr) continue;

          try {
            const parsed = JSON.parse(dataStr);
            const candidate = parsed.candidates?.[0];
            const part = candidate?.content?.parts?.[0];
            if (part?.text) {
              accumulatedText += part.text;
              onChunk(part.text);
            }
            if (parsed.usageMetadata) {
              usageMetadata = parsed.usageMetadata;
            }
          } catch (e) {
            // Ignore incomplete JSON chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      text: accumulatedText,
      usage: {
        promptTokens: usageMetadata?.promptTokenCount || 0,
        completionTokens: usageMetadata?.candidatesTokenCount || 0,
        totalTokens: usageMetadata?.totalTokenCount || 0
      }
    };
  }
}
