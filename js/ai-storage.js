// ─────────────────────────────────────────────────────────────────────────────
//  js/ai-storage.js — Supabase & Local Fallback Persistence Layer for AI Chat
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase.js';

const LOCAL_CONVS_KEY = 'mira_ai_conversations_v2';
const LOCAL_MSGS_KEY = 'mira_ai_messages_v2';

class AiStorageService {
  constructor() {
    this.hasSupabaseSchema = null; // null = untested, true/false after check
  }

  getSafeLocalData(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  saveLocalData(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('[LocalStorage Save Error]', e);
    }
  }

  /**
   * Load all conversations for the user
   */
  async getConversations(userId) {
    // 1. Try Supabase if authenticated
    if (userId && this.hasSupabaseSchema !== false) {
      try {
        const { data, error } = await supabase
          .from('ai_conversations')
          .select('*')
          .order('updated_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          this.hasSupabaseSchema = true;
          return data;
        } else if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
          // Table doesn't exist yet in Supabase
          this.hasSupabaseSchema = false;
        }
      } catch (err) {
        console.warn('[Supabase Conversations Load]', err);
      }
    }

    // 2. Fallback to LocalStorage
    const all = this.getSafeLocalData(LOCAL_CONVS_KEY);
    return all.filter(c => !userId || !c.user_id || c.user_id === userId);
  }

  /**
   * Create a new conversation
   */
  async createConversation({ userId, title = 'New Conversation', provider = 'gemini', model = 'gemini-2.0-flash' }) {
    const newConv = {
      id: 'conv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      user_id: userId || 'anonymous',
      title,
      selected_provider: provider,
      selected_model: model,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (userId && this.hasSupabaseSchema === true) {
      try {
        const { data, error } = await supabase
          .from('ai_conversations')
          .insert({
            user_id: userId,
            title,
            selected_provider: provider,
            selected_model: model
          })
          .select()
          .single();

        if (!error && data) {
          return data;
        }
      } catch (err) {
        console.warn('[Supabase Create Conv Failed, using local]', err);
      }
    }

    // Local fallback
    const all = this.getSafeLocalData(LOCAL_CONVS_KEY);
    all.unshift(newConv);
    this.saveLocalData(LOCAL_CONVS_KEY, all);
    return newConv;
  }

  /**
   * Update conversation title or selected model
   */
  async updateConversation(convId, updates) {
    updates.updated_at = new Date().toISOString();

    if (this.hasSupabaseSchema === true) {
      try {
        await supabase
          .from('ai_conversations')
          .update(updates)
          .eq('id', convId);
      } catch (err) {
        console.warn('[Supabase Update Conv Error]', err);
      }
    }

    const all = this.getSafeLocalData(LOCAL_CONVS_KEY);
    const index = all.findIndex(c => c.id === convId);
    if (index !== -1) {
      all[index] = { ...all[index], ...updates };
      // Move to top
      const item = all.splice(index, 1)[0];
      all.unshift(item);
      this.saveLocalData(LOCAL_CONVS_KEY, all);
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(convId) {
    if (this.hasSupabaseSchema === true) {
      try {
        await supabase.from('ai_conversations').delete().eq('id', convId);
        await supabase.from('ai_messages').delete().eq('conversation_id', convId);
      } catch (err) {
        console.warn('[Supabase Delete Conv Error]', err);
      }
    }

    let allConvs = this.getSafeLocalData(LOCAL_CONVS_KEY);
    allConvs = allConvs.filter(c => c.id !== convId);
    this.saveLocalData(LOCAL_CONVS_KEY, allConvs);

    let allMsgs = this.getSafeLocalData(LOCAL_MSGS_KEY);
    allMsgs = allMsgs.filter(m => m.conversation_id !== convId);
    this.saveLocalData(LOCAL_MSGS_KEY, allMsgs);
  }

  /**
   * Load messages for a conversation
   */
  async getMessages(convId) {
    if (!convId) return [];

    if (this.hasSupabaseSchema === true) {
      try {
        const { data, error } = await supabase
          .from('ai_messages')
          .select('*')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true });

        if (!error && Array.isArray(data)) {
          return data;
        }
      } catch (err) {
        console.warn('[Supabase Messages Load]', err);
      }
    }

    const all = this.getSafeLocalData(LOCAL_MSGS_KEY);
    return all.filter(m => m.conversation_id === convId);
  }

  /**
   * Save a single message
   */
  async saveMessage({ conversationId, userId, role, content, provider, model, attachments = [], tokens = {} }) {
    const newMsg = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      conversation_id: conversationId,
      user_id: userId || 'anonymous',
      role,
      content,
      provider,
      model,
      status: 'completed',
      attachments,
      tokens_used: tokens,
      created_at: new Date().toISOString()
    };

    if (userId && this.hasSupabaseSchema === true) {
      try {
        const { data, error } = await supabase
          .from('ai_messages')
          .insert({
            conversation_id: conversationId,
            user_id: userId,
            role,
            content,
            provider,
            model,
            attachments,
            tokens_used: tokens
          })
          .select()
          .single();

        if (!error && data) {
          // Update conversation updated_at
          await this.updateConversation(conversationId, { updated_at: new Date().toISOString() });
          return data;
        }
      } catch (err) {
        console.warn('[Supabase Save Message Error]', err);
      }
    }

    // Local fallback
    const all = this.getSafeLocalData(LOCAL_MSGS_KEY);
    all.push(newMsg);
    this.saveLocalData(LOCAL_MSGS_KEY, all);

    await this.updateConversation(conversationId, { updated_at: new Date().toISOString() });
    return newMsg;
  }
}

export const aiStorage = new AiStorageService();
