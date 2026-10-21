// ─────────────────────────────────────────────────────────────────────────────
//  server/providers/deepseek.js — DeepSeek Provider Adapter
// ─────────────────────────────────────────────────────────────────────────────
import { BaseProvider } from './base.js';

export class DeepSeekProvider extends BaseProvider {
  constructor() {
    super({
      id: 'deepseek',
      name: 'DeepSeek',
      envKey: 'DEEPSEEK_API_KEY',
      brandColor: '#4D6BFE',
      icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="#4D6BFE"/></svg>`,
      models: [
        {
          id: 'deepseek-chat',
          name: 'DeepSeek V3 (Chat)',
          description: 'High performance general purpose chat model',
          contextWindow: '64k tokens',
          capabilities: ['streaming', 'fast', 'code'],
          recommended: true
        },
        {
          id: 'deepseek-reasoner',
          name: 'DeepSeek R1 (Reasoner)',
          description: 'Specialized deep chain-of-thought reasoning and math',
          contextWindow: '64k tokens',
          capabilities: ['streaming', 'reasoning', 'code']
        }
      ]
    });
  }

  getApiKey() {
    return (process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_KEY || '').trim();
  }

  async testConnection() {
    if (!this.isConfigured()) {
      return { success: false, message: 'DEEPSEEK_API_KEY is not configured in server environment.' };
    }
    try {
      const apiKey = this.getApiKey();
      const res = await fetch('https://api.deepseek.com/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, message: err.error?.message || `HTTP ${res.status} from DeepSeek` };
      }
      return { success: true, message: 'DeepSeek API connected and verified.' };
    } catch (err) {
      return { success: false, message: `Connection failed: ${err.message}` };
    }
  }

  async streamChat({ model, messages, temperature = 0.7, maxTokens = 4096 }, onChunk) {
    if (!this.isConfigured()) {
      throw new Error('DeepSeek provider is not configured. Please set DEEPSEEK_API_KEY in server environment.');
    }

    const apiKey = this.getApiKey();
    const targetModel = model || 'deepseek-chat';

    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content + (msg.attachments?.map(a => `\n[File: ${a.name}]\n${a.extractedText || ''}`).join('') || '')
    }));

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: targetModel,
        messages: formattedMessages,
        temperature,
        max_tokens: maxTokens,
        stream: true
      })
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const errorMsg = errorJson.error?.message || `DeepSeek API returned HTTP ${response.status}`;
      throw new Error(errorMsg);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulatedText = '';
    let usage = null;

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
          if (dataStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataStr);
            const delta = parsed.choices?.[0]?.delta;
            // Support DeepSeek R1 reasoning_content or standard content
            const textDelta = delta?.content || delta?.reasoning_content;
            if (textDelta) {
              accumulatedText += textDelta;
              onChunk(textDelta);
            }
            if (parsed.usage) {
              usage = parsed.usage;
            }
          } catch (e) {
            // Ignore incomplete chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      text: accumulatedText,
      usage: {
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0
      }
    };
  }
}
