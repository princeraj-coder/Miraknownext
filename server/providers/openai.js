// ─────────────────────────────────────────────────────────────────────────────
//  server/providers/openai.js — OpenAI GPT Provider Adapter
// ─────────────────────────────────────────────────────────────────────────────
import { BaseProvider } from './base.js';

export class OpenAIProvider extends BaseProvider {
  constructor() {
    super({
      id: 'openai',
      name: 'OpenAI GPT',
      envKey: 'OPENAI_API_KEY',
      brandColor: '#10A37F',
      icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.259 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7466-7.0729z" fill="#10A37F"/></svg>`,
      models: [
        {
          id: 'gpt-4o',
          name: 'GPT-4o (Omni)',
          description: 'High-intelligence flagship multimodal model',
          contextWindow: '128k tokens',
          capabilities: ['streaming', 'vision', 'fast', 'reasoning'],
          recommended: true
        },
        {
          id: 'gpt-4o-mini',
          name: 'GPT-4o mini',
          description: 'Fast, affordable model for focused daily tasks',
          contextWindow: '128k tokens',
          capabilities: ['streaming', 'vision', 'fast']
        },
        {
          id: 'o3-mini',
          name: 'o3-mini',
          description: 'Advanced reasoning, STEM, and deep coding',
          contextWindow: '200k tokens',
          capabilities: ['streaming', 'reasoning', 'code']
        },
        {
          id: 'gpt-4-turbo',
          name: 'GPT-4 Turbo',
          description: 'Broad general knowledge and complex instructions',
          contextWindow: '128k tokens',
          capabilities: ['streaming', 'vision']
        }
      ]
    });
  }

  getApiKey() {
    return (process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || '').trim();
  }

  async testConnection() {
    if (!this.isConfigured()) {
      return { success: false, message: 'OPENAI_API_KEY is not configured in server environment.' };
    }
    try {
      const apiKey = this.getApiKey();
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, message: err.error?.message || `HTTP ${res.status} from OpenAI` };
      }
      return { success: true, message: 'OpenAI API is connected and verified.' };
    } catch (err) {
      return { success: false, message: `Connection failed: ${err.message}` };
    }
  }

  async streamChat({ model, messages, temperature = 0.7, maxTokens = 4096 }, onChunk) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI provider is not configured. Please set OPENAI_API_KEY in server environment.');
    }

    const apiKey = this.getApiKey();
    const targetModel = model || 'gpt-4o';

    // Format OpenAI messages
    const formattedMessages = messages.map(msg => {
      // If there are image attachments, map to content array
      if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
        const contentParts = [];
        if (msg.content) {
          contentParts.push({ type: 'text', text: msg.content });
        }
        for (const att of msg.attachments) {
          if (att.dataUrl && att.dataUrl.startsWith('data:image/')) {
            contentParts.push({
              type: 'image_url',
              image_url: { url: att.dataUrl }
            });
          } else if (att.extractedText) {
            contentParts.push({
              type: 'text',
              text: `\n[Attached File: ${att.name || 'document'}]\n${att.extractedText}\n`
            });
          }
        }
        return { role: msg.role, content: contentParts };
      }

      return {
        role: msg.role,
        content: msg.content
      };
    });

    const isReasoning = targetModel.startsWith('o1') || targetModel.startsWith('o3');
    const requestBody = {
      model: targetModel,
      messages: formattedMessages,
      stream: true,
      stream_options: { include_usage: true }
    };

    if (!isReasoning) {
      requestBody.temperature = temperature;
      requestBody.max_tokens = maxTokens;
    } else {
      requestBody.max_completion_tokens = maxTokens;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const errorMsg = errorJson.error?.message || `OpenAI API returned HTTP ${response.status}`;
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
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulatedText += delta;
              onChunk(delta);
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
