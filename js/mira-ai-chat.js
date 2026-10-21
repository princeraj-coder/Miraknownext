// ─────────────────────────────────────────────────────────────────────────────
//  js/mira-ai-chat.js — Mira AI Multi-Model Platform Controller
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase.js';
import { aiStorage } from './ai-storage.js';
import { renderMarkdown } from './markdown-renderer.js';

class MiraAiChat {
  constructor() {
    this.providers = [];
    this.currentProvider = 'gemini';
    this.currentModel = 'gemini-2.0-flash';
    this.conversations = [];
    this.activeConversation = null;
    this.messages = [];
    this.isGenerating = false;
    this.abortController = null;
    this.currentUser = null;
    this.pendingAttachments = [];
    this.searchQuery = '';
    this.historyCollapsed = false;

    this.init();
  }

  async init() {
    // 1. Get active auth session
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        this.currentUser = session.user;
      }
    } catch (e) {
      console.warn('[Mira AI Auth]', e);
    }

    supabase.auth.onAuthStateChange((event, session) => {
      this.currentUser = session?.user || null;
      this.loadConversations();
    });

    // 2. Fetch configured models and providers from backend
    await this.fetchModelsCatalog();

    // 3. Load conversations
    await this.loadConversations();

    // 4. Setup DOM event listeners
    this.bindEvents();

    // 5. Update UI components
    this.updateModelSelectorButton();
  }

  /**
   * Fetch model catalog from server
   */
  async fetchModelsCatalog() {
    try {
      const res = await fetch('/api/ai/models');
      if (res.ok) {
        const data = await res.json();
        this.providers = data.providers || [];
        this.renderModelDropdown();
        this.updateProviderBadge();

        // If current provider is not configured, pick the first configured one if available
        const currentP = this.providers.find(p => p.id === this.currentProvider);
        if (!currentP?.isConfigured) {
          const firstConfigured = this.providers.find(p => p.isConfigured);
          if (firstConfigured && firstConfigured.models.length > 0) {
            this.currentProvider = firstConfigured.id;
            this.currentModel = firstConfigured.models[0].id;
          }
        }
      }
    } catch (err) {
      console.warn('[Fetch Models Error]', err);
    }
  }

  /**
   * Load conversations from storage
   */
  async loadConversations() {
    const userId = this.currentUser?.id || null;
    this.conversations = await aiStorage.getConversations(userId);
    this.renderHistoryList();
  }

  /**
   * Bind DOM events
   */
  bindEvents() {
    // History collapse toggle
    const toggleBtn = document.getElementById('ai-btn-toggle-history');
    toggleBtn?.addEventListener('click', () => this.toggleHistorySidebar());

    // New chat buttons
    document.querySelectorAll('[data-ai-action="new-chat"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.newConversation();
      });
    });

    // Model selector trigger button
    const modelBtn = document.getElementById('ai-model-selector-btn');
    const dropdown = document.getElementById('ai-model-dropdown');
    modelBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown?.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (dropdown && !dropdown.contains(e.target) && !modelBtn?.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });

    // History search input
    const searchInput = document.getElementById('ai-history-search');
    searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderHistoryList();
    });

    // Hero prompt cards
    document.querySelectorAll('[data-ai-suggested]').forEach(card => {
      card.addEventListener('click', () => {
        const prompt = card.dataset.aiSuggested;
        this.sendMessage(prompt);
      });
    });

    // Composer inputs: Hero & Bottom
    this.bindComposer(document.getElementById('ai-hero-textarea'), document.getElementById('ai-hero-btn-send'));
    this.bindComposer(document.getElementById('ai-bottom-textarea'), document.getElementById('ai-bottom-btn-send'));

    // File attachments input
    const fileInputs = document.querySelectorAll('.ai-file-input-hidden');
    fileInputs.forEach(input => {
      input.addEventListener('change', (e) => this.handleFileInputChange(e));
    });

    // Stop generation buttons
    document.querySelectorAll('[data-ai-action="stop"]').forEach(btn => {
      btn.addEventListener('click', () => this.stopGeneration());
    });

    // Provider status modal open/close
    document.querySelectorAll('[data-ai-action="open-config"]').forEach(btn => {
      btn.addEventListener('click', () => this.openConfigModal());
    });
    document.getElementById('ai-config-modal-close')?.addEventListener('click', () => {
      document.getElementById('ai-config-modal')?.classList.remove('open');
    });
  }

  bindComposer(textarea, sendBtn) {
    if (!textarea) return;

    // Auto-expand height
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
      if (sendBtn) {
        sendBtn.disabled = !textarea.value.trim() && this.pendingAttachments.length === 0;
      }
    });

    // Enter to send, Shift+Enter for newline
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    sendBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.sendMessage();
    });
  }

  /**
   * Switch to a new blank conversation
   */
  newConversation() {
    this.activeConversation = null;
    this.messages = [];
    this.pendingAttachments = [];
    this.renderAttachmentChips();

    // Show Hero landing, hide thread
    const landing = document.getElementById('ai-landing-hero');
    const thread = document.getElementById('ai-conversation-thread');
    if (landing) landing.style.display = 'flex';
    if (thread) thread.classList.remove('active');

    // Deselect sidebar items
    document.querySelectorAll('.ai-history-item').forEach(el => el.classList.remove('active'));

    const heroTextarea = document.getElementById('ai-hero-textarea');
    if (heroTextarea) {
      heroTextarea.value = '';
      heroTextarea.focus();
    }
  }

  /**
   * Load and open an existing conversation
   */
  async loadConversation(convId) {
    const conv = this.conversations.find(c => c.id === convId);
    if (!conv) return;

    this.activeConversation = conv;
    this.currentProvider = conv.selected_provider || this.currentProvider;
    this.currentModel = conv.selected_model || this.currentModel;
    this.updateModelSelectorButton();

    // Load messages
    this.messages = await aiStorage.getMessages(convId);

    // Switch view to conversation thread
    const landing = document.getElementById('ai-landing-hero');
    const thread = document.getElementById('ai-conversation-thread');
    if (landing) landing.style.display = 'none';
    if (thread) thread.classList.add('active');

    // Highlight sidebar item
    document.querySelectorAll('.ai-history-item').forEach(el => {
      el.classList.toggle('active', el.dataset.convId === convId);
    });

    this.renderMessages();
    this.scrollToBottom();

    // Focus bottom composer
    const bottomTextarea = document.getElementById('ai-bottom-textarea');
    bottomTextarea?.focus();
  }

  /**
   * Send a chat message
   */
  async sendMessage(textOverride = null) {
    if (this.isGenerating) return;

    const heroTextarea = document.getElementById('ai-hero-textarea');
    const bottomTextarea = document.getElementById('ai-bottom-textarea');
    const content = (textOverride || heroTextarea?.value || bottomTextarea?.value || '').trim();

    if (!content && this.pendingAttachments.length === 0) return;

    // Clear input fields
    if (heroTextarea) { heroTextarea.value = ''; heroTextarea.style.height = 'auto'; }
    if (bottomTextarea) { bottomTextarea.value = ''; bottomTextarea.style.height = 'auto'; }

    // 1. Create conversation in storage if not exists
    if (!this.activeConversation) {
      const title = content.slice(0, 32) || 'File Analysis';
      this.activeConversation = await aiStorage.createConversation({
        userId: this.currentUser?.id,
        title,
        provider: this.currentProvider,
        model: this.currentModel
      });
      await this.loadConversations();
    }

    // 2. Prepare user message object
    const attachments = [...this.pendingAttachments];
    this.pendingAttachments = [];
    this.renderAttachmentChips();

    const userMsg = await aiStorage.saveMessage({
      conversationId: this.activeConversation.id,
      userId: this.currentUser?.id,
      role: 'user',
      content,
      provider: this.currentProvider,
      model: this.currentModel,
      attachments
    });

    this.messages.push(userMsg);

    // Transition view from landing to thread if needed
    const landing = document.getElementById('ai-landing-hero');
    const thread = document.getElementById('ai-conversation-thread');
    if (landing) landing.style.display = 'none';
    if (thread) thread.classList.add('active');

    this.renderMessages();
    this.scrollToBottom();

    // 3. Initiate AI Assistant Streaming Request
    await this.executeAssistantStream();
  }

  async executeAssistantStream() {
    this.isGenerating = true;
    this.updateComposerGenerationState(true);
    this.abortController = new AbortController();

    // Temporary assistant message placeholder in UI
    const assistantMsgId = 'temp_assist_' + Date.now();
    const assistantMsg = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      provider: this.currentProvider,
      model: this.currentModel,
      isStreaming: true
    };
    this.messages.push(assistantMsg);
    this.renderMessages();
    this.scrollToBottom();

    let fullText = '';

    try {
      // Get auth token if user is signed in
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      } else {
        // Allow trial session token for guest preview
        headers['Authorization'] = `Bearer guest-mira-preview-token`;
      }

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers,
        signal: this.abortController.signal,
        body: JSON.stringify({
          provider: this.currentProvider,
          model: this.currentModel,
          messages: this.messages
            .filter(m => m.id !== assistantMsgId)
            .map(m => ({
              role: m.role,
              content: m.content,
              attachments: m.attachments
            })),
          stream: true
        })
      });

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(errorJson.error || `HTTP ${response.status} from AI service`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

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
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.type === 'chunk' && parsed.delta) {
              fullText += parsed.delta;
              assistantMsg.content = fullText;
              this.updateStreamingMessageBubble(assistantMsgId, fullText);
              this.scrollToBottom();
            } else if (parsed.type === 'error') {
              throw new Error(parsed.error);
            }
          } catch (e) {
            if (e.message !== 'Unexpected end of JSON input') {
              // Ignore partial JSON
            }
          }
        }
      }

      // Generation finished successfully: save to storage
      assistantMsg.isStreaming = false;
      const saved = await aiStorage.saveMessage({
        conversationId: this.activeConversation.id,
        userId: this.currentUser?.id,
        role: 'assistant',
        content: fullText,
        provider: this.currentProvider,
        model: this.currentModel
      });

      // Replace temp ID with saved message ID
      assistantMsg.id = saved.id;
      this.renderMessages();
      await this.loadConversations();
    } catch (err) {
      if (err.name === 'AbortError') {
        assistantMsg.content = fullText + ' *(Generation stopped by user)*';
        assistantMsg.isStreaming = false;
        await aiStorage.saveMessage({
          conversationId: this.activeConversation.id,
          userId: this.currentUser?.id,
          role: 'assistant',
          content: assistantMsg.content,
          provider: this.currentProvider,
          model: this.currentModel
        });
        this.renderMessages();
      } else {
        console.error('[AI Stream Error]', err);
        assistantMsg.isStreaming = false;
        assistantMsg.isError = true;
        assistantMsg.content = `⚠️ **Generation Error:** ${err.message}\n\n*Click "Retry" or select another configured provider from the top model selector.*`;
        this.renderMessages();
      }
    } finally {
      this.isGenerating = false;
      this.abortController = null;
      this.updateComposerGenerationState(false);
    }
  }

  stopGeneration() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  retryLast() {
    // Remove last error message and re-run
    const last = this.messages[this.messages.length - 1];
    if (last && last.role === 'assistant') {
      this.messages.pop();
    }
    this.executeAssistantStream();
  }

  regenerateResponse(messageIndex) {
    if (this.isGenerating) return;
    // Keep messages up to the user message before this assistant response
    this.messages = this.messages.slice(0, messageIndex);
    this.executeAssistantStream();
  }

  /**
   * File upload handler
   */
  async handleFileInputChange(e) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (file.size > 15 * 1024 * 1024) {
        alert(`File "${file.name}" exceeds the 15 MB limit.`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result;
        const base64 = dataUrl.split(',')[1];

        // Upload to server/Azure Blob Storage
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const headers = { 'Content-Type': 'application/json' };
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }

          const res = await fetch('/api/ai/files', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              filename: file.name,
              mimeType: file.type,
              dataBase64: base64,
              conversationId: this.activeConversation?.id || 'general'
            })
          });

          if (res.ok) {
            const data = await res.json();
            this.pendingAttachments.push({
              name: file.name,
              size: file.size,
              mimeType: file.type,
              dataUrl: file.type.startsWith('image/') ? dataUrl : null,
              extractedText: data.file?.extractedText || null,
              storagePath: data.file?.storagePath
            });
          } else {
            // Local fallback
            this.pendingAttachments.push({
              name: file.name,
              size: file.size,
              mimeType: file.type,
              dataUrl: file.type.startsWith('image/') ? dataUrl : null
            });
          }
        } catch (uploadErr) {
          this.pendingAttachments.push({
            name: file.name,
            size: file.size,
            mimeType: file.type,
            dataUrl: file.type.startsWith('image/') ? dataUrl : null
          });
        }

        this.renderAttachmentChips();
      };

      reader.readAsDataURL(file);
    }

    e.target.value = '';
  }

  renderAttachmentChips() {
    const containers = [
      document.getElementById('ai-hero-attachments'),
      document.getElementById('ai-bottom-attachments')
    ];

    containers.forEach(box => {
      if (!box) return;
      if (this.pendingAttachments.length === 0) {
        box.innerHTML = '';
        return;
      }

      box.innerHTML = this.pendingAttachments.map((att, i) => `
        <div class="ai-attachment-chip">
          <span>📎</span>
          <span style="max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${this.escapeHtml(att.name)}</span>
          <button type="button" class="ai-attachment-remove" onclick="window.miraAiChat?.removeAttachment(${i})">✕</button>
        </div>
      `).join('');
    });
  }

  removeAttachment(index) {
    this.pendingAttachments.splice(index, 1);
    this.renderAttachmentChips();
  }

  /**
   * UI Rendering Helpers
   */
  renderMessages() {
    const container = document.getElementById('ai-messages-container');
    if (!container) return;

    container.innerHTML = this.messages.map((msg, idx) => {
      if (msg.role === 'user') {
        return `
          <div class="ai-msg-row user" id="msg-${msg.id}">
            <div class="ai-user-bubble">
              ${this.escapeHtml(msg.content)}
              ${Array.isArray(msg.attachments) && msg.attachments.length > 0 ? `
                <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px;">
                  ${msg.attachments.map(a => `
                    <div class="ai-attachment-chip" style="background: rgba(0,0,0,0.25);">
                      <span>📎</span>
                      <span>${this.escapeHtml(a.name)}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
              <div class="ai-user-actions">
                <button type="button" class="ai-msg-action-btn" onclick="window.miraAiChat?.copyText('${encodeURIComponent(msg.content)}', this)">Copy</button>
              </div>
            </div>
          </div>
        `;
      } else {
        const p = this.providers.find(prov => prov.id === msg.provider);
        return `
          <div class="ai-msg-row assistant" id="msg-${msg.id}">
            <div class="ai-assistant-meta">
              <div class="ai-assistant-badge">
                <span class="ai-model-icon-box" style="width: 16px; height: 16px;">${p?.icon || '✨'}</span>
                <span>${p?.name || 'Mira AI'} (${msg.model || 'Assistant'})</span>
              </div>
            </div>
            <div class="ai-assistant-bubble">
              <div class="ai-rendered-content">${renderMarkdown(msg.content)}</div>
              ${msg.isStreaming ? `<span class="ai-streaming-cursor"></span>` : ''}
            </div>
            ${!msg.isStreaming ? `
              <div class="ai-msg-actions">
                <button type="button" class="ai-msg-action-btn" onclick="window.miraAiChat?.copyText('${encodeURIComponent(msg.content)}', this)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  <span>Copy</span>
                </button>
                <button type="button" class="ai-msg-action-btn" onclick="window.miraAiChat?.regenerateResponse(${idx})">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
                  <span>Regenerate</span>
                </button>
                ${msg.isError ? `
                  <button type="button" class="ai-msg-action-btn" style="color: #f87171;" onclick="window.miraAiChat?.retryLast()">
                    <span>Retry</span>
                  </button>
                ` : ''}
              </div>
            ` : ''}
          </div>
        `;
      }
    }).join('');
  }

  updateStreamingMessageBubble(msgId, text) {
    const row = document.getElementById(`msg-${msgId}`);
    if (!row) return;
    const contentBox = row.querySelector('.ai-rendered-content');
    if (contentBox) {
      contentBox.innerHTML = renderMarkdown(text);
    }
  }

  renderHistoryList() {
    const list = document.getElementById('ai-history-list');
    if (!list) return;

    let filtered = this.conversations;
    if (this.searchQuery) {
      filtered = filtered.filter(c => c.title.toLowerCase().includes(this.searchQuery));
    }

    if (filtered.length === 0) {
      list.innerHTML = `
        <div style="text-align: center; padding: 20px 10px; color: rgba(255,255,255,0.4); font-size: 12px;">
          ${this.searchQuery ? 'No matching conversations' : 'No previous conversations'}
        </div>
      `;
      return;
    }

    list.innerHTML = filtered.map(c => {
      const isActive = this.activeConversation?.id === c.id;
      const p = this.providers.find(prov => prov.id === c.selected_provider);
      return `
        <div class="ai-history-item ${isActive ? 'active' : ''}" data-conv-id="${c.id}" onclick="window.miraAiChat?.loadConversation('${c.id}')">
          <div class="ai-history-item-left">
            <span style="font-size: 14px; opacity: 0.8;">💬</span>
            <span class="ai-history-item-title">${this.escapeHtml(c.title)}</span>
          </div>
          <div class="ai-history-item-actions">
            <button type="button" class="ai-history-action-btn" title="Rename" onclick="window.miraAiChat?.renameConversation('${c.id}', event)">✎</button>
            <button type="button" class="ai-history-action-btn btn-delete" title="Delete" onclick="window.miraAiChat?.deleteConversation('${c.id}', event)">✕</button>
          </div>
        </div>
      `;
    }).join('');
  }

  renderModelDropdown() {
    const list = document.getElementById('ai-model-dropdown-list');
    if (!list) return;

    list.innerHTML = this.providers.map(p => {
      return `
        <div class="ai-provider-group">
          <div class="ai-provider-group-title">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span class="ai-model-icon-box" style="width: 14px; height: 14px;">${p.icon}</span>
              <span>${p.name}</span>
            </div>
            <span class="ai-provider-status-pill ${p.isConfigured ? 'configured' : 'unconfigured'}">
              ${p.isConfigured ? 'Connected' : 'Not Configured'}
            </span>
          </div>
          ${p.models.map(m => {
            const isSelected = this.currentProvider === p.id && this.currentModel === m.id;
            const disabled = !p.isConfigured;
            return `
              <div class="ai-model-card ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}" 
                   onclick="window.miraAiChat?.selectModel('${p.id}', '${m.id}', ${disabled})">
                <div class="ai-model-card-top">
                  <span class="ai-model-card-name">${m.name}</span>
                  ${m.recommended ? `<span class="ai-model-badge" style="font-size:9px;">Recommended</span>` : ''}
                </div>
                <div class="ai-model-card-desc">${m.description}</div>
                <div class="ai-model-card-tags">
                  <span class="ai-tag-mini">${m.contextWindow}</span>
                  ${m.capabilities.map(cap => `<span class="ai-tag-mini">${cap}</span>`).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }).join('');
  }

  selectModel(providerId, modelId, disabled = false) {
    if (disabled) {
      alert(`This provider is not yet configured. Please click "Configure Providers" to connect an API key.`);
      return;
    }

    this.currentProvider = providerId;
    this.currentModel = modelId;
    this.updateModelSelectorButton();
    this.renderModelDropdown();

    // If active conversation exists, update its model setting
    if (this.activeConversation) {
      this.activeConversation.selected_provider = providerId;
      this.activeConversation.selected_model = modelId;
      aiStorage.updateConversation(this.activeConversation.id, {
        selected_provider: providerId,
        selected_model: modelId
      });
    }

    document.getElementById('ai-model-dropdown')?.classList.remove('open');
  }

  updateModelSelectorButton() {
    const p = this.providers.find(prov => prov.id === this.currentProvider);
    const m = p?.models.find(mod => mod.id === this.currentModel);

    const btn = document.getElementById('ai-model-selector-btn');
    if (!btn) return;

    btn.innerHTML = `
      <div class="ai-model-icon-box">${p?.icon || '✨'}</div>
      <span>${m?.name || 'Select Model'}</span>
      <span class="ai-model-badge">${p?.name || 'Frontier'}</span>
      <span style="opacity:0.5; font-size:10px;">▼</span>
    `;

    // Also update subtitle in hero
    const activeModelName = document.getElementById('ai-hero-active-model-name');
    if (activeModelName && m) {
      activeModelName.innerText = `${p?.name || ''} · ${m.name}`;
    }
  }

  updateProviderBadge() {
    const badge = document.getElementById('ai-provider-badge-btn');
    if (!badge) return;
    const configuredCount = this.providers.filter(p => p.isConfigured).length;
    badge.innerHTML = `
      <span class="status-dot-pulse ${configuredCount > 0 ? '' : 'warning'}"></span>
      <span>${configuredCount} of ${this.providers.length} Providers Connected</span>
    `;
  }

  updateComposerGenerationState(isGen) {
    const stopBtns = document.querySelectorAll('[data-ai-action="stop"]');
    const sendBtns = document.querySelectorAll('.ai-btn-send');

    stopBtns.forEach(b => b.style.display = isGen ? 'flex' : 'none');
    sendBtns.forEach(b => b.style.display = isGen ? 'none' : 'flex');
  }

  toggleHistorySidebar() {
    const sidebar = document.getElementById('ai-history-sidebar');
    if (sidebar) {
      this.historyCollapsed = sidebar.classList.toggle('collapsed');
    }
  }

  async renameConversation(convId, e) {
    e.stopPropagation();
    const conv = this.conversations.find(c => c.id === convId);
    if (!conv) return;
    const newTitle = prompt('Enter new conversation title:', conv.title);
    if (newTitle && newTitle.trim()) {
      await aiStorage.updateConversation(convId, { title: newTitle.trim() });
      await this.loadConversations();
    }
  }

  async deleteConversation(convId, e) {
    e.stopPropagation();
    if (confirm('Delete this conversation? This action cannot be undone.')) {
      await aiStorage.deleteConversation(convId);
      if (this.activeConversation?.id === convId) {
        this.newConversation();
      }
      await this.loadConversations();
    }
  }

  copyCodeSnippet(btn) {
    const code = decodeURIComponent(btn.dataset.code || '');
    navigator.clipboard.writeText(code).then(() => {
      const span = btn.querySelector('span');
      if (span) {
        const orig = span.innerText;
        span.innerText = 'Copied! ✓';
        setTimeout(() => { span.innerText = orig; }, 1800);
      }
    });
  }

  copyText(encoded, btn) {
    const text = decodeURIComponent(encoded);
    navigator.clipboard.writeText(text).then(() => {
      const span = btn.querySelector('span') || btn;
      const orig = span.innerText;
      span.innerText = 'Copied! ✓';
      setTimeout(() => { span.innerText = orig; }, 1800);
    });
  }

  scrollToBottom() {
    const viewport = document.getElementById('ai-messages-viewport');
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }

  /**
   * Diagnostic Modal
   */
  async openConfigModal() {
    const modal = document.getElementById('ai-config-modal');
    if (!modal) return;
    modal.classList.add('open');

    const body = document.getElementById('ai-config-modal-body');
    if (body) {
      body.innerHTML = `
        <div style="text-align:center; padding: 20px; color: rgba(255,255,255,0.6);">
          <div class="status-dot-pulse" style="margin:0 auto 10px auto;"></div>
          Checking provider connection status...
        </div>
      `;

      try {
        const res = await fetch('/api/ai/config');
        if (res.ok) {
          const data = await res.json();
          body.innerHTML = `
            <div style="font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.5; margin-bottom: 8px;">
              Active server-side AI provider configuration. Keys are securely read from server environment variables (Vercel Project Settings in production or <code>.env.local</code> locally) and are never exposed to the browser.
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${data.providers.map(p => `
                <div class="ai-provider-diag-card" style="flex-direction: column; align-items: stretch; gap: 8px;">
                  <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div class="ai-provider-diag-left">
                      <span class="status-dot-pulse ${p.isConfigured ? '' : 'warning'}"></span>
                      <div>
                        <div class="ai-provider-diag-name">${p.name}</div>
                        <div class="ai-provider-diag-key">Required Variable: <code>${p.envKey}</code></div>
                      </div>
                    </div>
                    <span class="ai-provider-status-pill ${p.isConfigured ? 'configured' : 'unconfigured'}">
                      ${p.isConfigured ? 'Configured on Server' : 'Missing Variable'}
                    </span>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; font-size: 11px; color: rgba(255,255,255,0.5);">
                    <span>${p.isConfigured ? 'Ready to accept student chat queries.' : 'Add ' + p.envKey + ' to Vercel or .env.local to activate.'}</span>
                    <button type="button" class="btn-ai-new-chat" style="flex: 0 0 auto; padding: 4px 12px; font-size: 11px;" onclick="window.miraAiChat?.testProviderConnection('${p.id}', this)">
                      Verify Status
                    </button>
                  </div>
                </div>
              `).join('')}

              <div class="ai-provider-diag-card">
                <div class="ai-provider-diag-left">
                  <span class="status-dot-pulse ${data.azureStorage?.isConfigured ? '' : 'warning'}"></span>
                  <div>
                    <div class="ai-provider-diag-name">Azure Blob Storage</div>
                    <div class="ai-provider-diag-key">Container: <code>${data.azureStorage?.containerName || 'mira-student-files'}</code></div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="ai-provider-status-pill ${data.azureStorage?.isConfigured ? 'configured' : 'unconfigured'}">
                    ${data.azureStorage?.isConfigured ? 'Connected' : 'Memory Buffer Active'}
                  </span>
                </div>
              </div>
            </div>

            <div style="margin-top: 16px; padding: 12px 14px; background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.25); border-radius: 12px; font-size: 12px; color: rgba(255,255,255,0.85); line-height: 1.5;">
              <div style="font-weight: 700; color: #d8b4fe; margin-bottom: 4px;">⚡ Supabase AI Schema Setup</div>
              Run <code>supabase-ai-schema.sql</code> in your Supabase SQL Editor to enable cloud RLS tables for conversations, messages, usage, and file metadata.
            </div>
          `;
        }
      } catch (err) {
        body.innerHTML = `<div style="color: #f87171; padding: 20px;">Failed to load configuration status: ${err.message}</div>`;
      }
    }
  }

  async testProviderConnection(providerId, btn) {
    const orig = btn.innerText;
    btn.innerText = 'Checking...';

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers,
        body: JSON.stringify({ providerId })
      });

      const data = await res.json();
      if (data.success) {
        alert(`🎉 Success: ${data.name} is configured on the server and verified!`);
        await this.fetchModelsCatalog();
        this.updateModelSelectorButton();
        this.openConfigModal(); // refresh view
      } else {
        alert(`ℹ️ Status for ${data.name || providerId}: ${data.message || data.error || 'Provider key not detected on server.'}`);
      }
    } catch (err) {
      alert(`Error during status check: ${err.message}`);
    } finally {
      btn.innerText = orig;
    }
  }

  escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Global initialization
window.miraAiChat = new MiraAiChat();
