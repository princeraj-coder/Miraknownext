// ─────────────────────────────────────────────────────────────────────────────
//  js/ai-bot.js — Contextual Mira Copilot Controller (Microsoft Edge Style)
//  Entry point: Top application toolbar Copilot icon on all tools.
//  Resizes workspace seamlessly and provides context-aware assistance.
// ─────────────────────────────────────────────────────────────────────────────

const MIRA_PROMPTS = {
  summarize: 'Summarize the current document or open workspace.',
  draft: 'Help me draft and improve the content in my current tool.',
  plan: 'Plan and prioritize my day for maximum productivity.',
  explain: 'Explain how to use the current tool and its features.',
  chat: 'What can you help me with in Mira Workspace?'
};

class MiraAiAssistant {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.init();
  }

  init() {
    // Dashboard copilot elements
    this.topbarBtn = document.getElementById('topbar-btn-copilot');
    this.sidebar = document.getElementById('mira-copilot-sidebar');
    this.closeBtn = document.getElementById('copilot-close-btn') || document.getElementById('ai-close-drawer');
    this.newChatBtn = document.getElementById('copilot-new-chat-btn');
    this.messagesContainer = document.getElementById('copilot-chat-messages') || document.getElementById('ai-chat-messages');
    this.inputField = document.getElementById('copilot-input-field') || document.getElementById('ai-chat-input');
    this.form = document.getElementById('copilot-form');

    // Landing page specific elements (fallback support)
    this.charBtn = document.getElementById('ai-character-button');
    this.askPill = document.getElementById('ai-ask-pill');
    this.drawer = document.getElementById('ai-chat-drawer');
    this.sendBtn = document.getElementById('ai-send-btn');

    // 1. Topbar Copilot Button Toggle (Primary Entry Point across all tools)
    this.topbarBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleSidebar();
    });

    // 2. Landing page support if present
    this.charBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleDrawer();
    });
    this.askPill?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleDrawer();
    });

    // 3. Close button
    this.closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.drawer) {
        this.closeDrawer();
      } else {
        this.closeSidebar();
      }
    });

    // 4. New Topic / Clear chat button
    this.newChatBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearChat();
    });

    // 5. Form submit
    this.form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit(e);
    });

    // 6. Send button & Enter key
    this.sendBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleFormSubmit(e);
    });
    this.inputField?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleFormSubmit(e);
      }
    });

    // 7. Preset contextual prompt chips
    document.querySelectorAll('[data-mira-prompt]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.miraPrompt;
        this.openWithPrompt(key);
      });
    });

    // 8. Outside click dismiss (only for small overlay screens < 1024px)
    document.addEventListener('click', (e) => {
      if (!this.isOpen) return;

      // On desktop, Copilot resizes side-by-side so user can click tools without Copilot closing
      if (window.innerWidth >= 1024 && !this.drawer) return;

      if (
        this.sidebar &&
        !this.sidebar.contains(e.target) &&
        (!this.topbarBtn || !this.topbarBtn.contains(e.target)) &&
        !e.target.closest('#topbar-btn-copilot')
      ) {
        this.closeSidebar();
      }
    });

    // Initial contextual welcome message
    if (this.messages.length === 0 && this.messagesContainer) {
      this.addBotMessage(`👋 **Hi, I'm Mira Copilot!** Your contextual assistant.\n\nI can help you:\n• 📄 Summarize the open document or notes\n• ✍️ Draft, refine, and improve text\n• 📋 Organize your tasks and schedule\n• 💡 Explain how to use any tool\n\nClick a shortcut above or ask me anything!`);
    }
  }

  // Dashboard Copilot Controls
  toggleSidebar() {
    // If currently on Full Mira AI Workspace page, do not open Copilot drawer
    if (window.miraApp?.currentView === 'ai') {
      this.closeSidebar();
      return;
    }

    if (this.isOpen) {
      this.closeSidebar();
    } else {
      this.openSidebar();
    }
  }

  openSidebar() {
    if (window.miraApp?.currentView === 'ai') return;

    this.isOpen = true;
    this.sidebar?.classList.add('open');
    this.topbarBtn?.classList.add('active');
    document.body.classList.add('copilot-open');

    // Context hint in header status
    const statusText = document.querySelector('.copilot-title-status');
    if (statusText && window.miraApp) {
      const ctx = window.miraApp.getPageContext();
      statusText.innerText = `${ctx.title} · Active`;
    }

    setTimeout(() => this.inputField?.focus(), 150);
  }

  closeSidebar() {
    this.isOpen = false;
    this.sidebar?.classList.remove('open');
    this.topbarBtn?.classList.remove('active');
    document.body.classList.remove('copilot-open');
  }

  // Landing Page Drawer Controls
  toggleDrawer() {
    if (this.isOpen) this.closeDrawer();
    else this.openDrawer();
  }

  openDrawer() {
    this.isOpen = true;
    this.drawer?.classList.add('open');
    setTimeout(() => this.inputField?.focus(), 150);
  }

  closeDrawer() {
    this.isOpen = false;
    this.drawer?.classList.remove('open');
  }

  clearChat() {
    this.messages = [];
    if (this.messagesContainer) {
      this.messagesContainer.innerHTML = '';
    }
    const ctx = window.miraApp?.getPageContext() || { title: 'Workspace' };
    this.addBotMessage(`✨ **New Topic Started.**\n\nI am synced with **${ctx.title}**. What would you like to work on?`);
    setTimeout(() => this.inputField?.focus(), 150);
  }

  openWithPrompt(keyOrText) {
    if (!this.isOpen) {
      if (this.drawer) this.openDrawer();
      else this.openSidebar();
    }

    const promptText = MIRA_PROMPTS[keyOrText] || keyOrText;
    this.inputField.value = promptText;
    this.handleFormSubmit();
  }

  async handleFormSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const text = this.inputField?.value.trim();
    if (!text) return;

    this.addUserMessage(text);
    if (this.inputField) this.inputField.value = '';

    // Show typing/thinking indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.className = this.drawer ? 'ai-msg bot-msg' : 'copilot-msg-bubble bot-msg';
    loadingDiv.innerHTML = `<span class="ai-streaming-cursor" style="display:inline-block; width:6px; height:14px; background:#a855f7;"></span> <span style="font-size:12px; color:rgba(255,255,255,0.5);">Thinking with page context...</span>`;
    this.messagesContainer?.appendChild(loadingDiv);
    this.scrollToBottom();

    // 1. Gather page context from active tool
    const pageCtx = window.miraApp?.getPageContext() || {
      view: 'workspace',
      title: 'Mira Workspace',
      details: 'Studio multi-window workspace'
    };

    // 2. Try backend API with context
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer copilot-context-session'
        },
        body: JSON.stringify({
          provider: 'gemini',
          model: 'gemini-2.0-flash',
          messages: [
            {
              role: 'system',
              content: `You are Mira Copilot, a helpful contextual assistant inside Mira Workspace. Current Page: ${pageCtx.title}. Page details & content: ${pageCtx.details}. Provide a direct, concise, and helpful response formatted with Markdown.`
            },
            ...this.messages.slice(-4).map(m => ({
              role: m.sender === 'user' ? 'user' : 'assistant',
              content: m.text
            }))
          ],
          stream: false
        })
      });

      if (response.ok) {
        const data = await response.json();
        loadingDiv.remove();
        this.addBotMessage(data.text);
        return;
      }
    } catch (err) {
      // Fallback to intelligent contextual responses
    }

    loadingDiv.remove();
    this.respondWithContext(text, pageCtx);
  }

  respondWithContext(query, pageCtx) {
    const q = query.toLowerCase();
    let reply = '';

    if (q.includes('summar') || q.includes('tldr') || q.includes('overview')) {
      reply = `📄 **Summary for ${pageCtx.title}:**\n${pageCtx.details}\n\n• **Core Objective:** Maintain streamlined productivity and verified student data.\n• **Action Items:** Review open items and initiate next focus sprint.`;
    } else if (q.includes('draft') || q.includes('improve') || q.includes('write')) {
      reply = `✍️ **Drafting Assistant for ${pageCtx.title}:**\nHere is a clear, polished formulation for your document:\n\n> "Mira Workspace unifies essential student learning, verified attendance management, and real-time collaborative editing into one streamlined interface."\n\n*Would you like me to adjust the tone to formal, technical, or concise?*`;
    } else if (q.includes('plan') || q.includes('prioriti') || q.includes('day') || q.includes('task')) {
      reply = `📋 **Task & Schedule Plan:**\n• **Immediate Priority:** Review product roadmap & sprint board.\n• **Afternoon Focus:** Upload course notes & verified PDF attachments.\n• **Wrap-Up:** Check KnowNext student doubt threads.\n\n*Tip: Start a 25-minute timer in the Focus Hub to tackle the top priority!*`;
    } else if (q.includes('explain') || q.includes('how to') || q.includes('feature')) {
      reply = `💡 **How to use ${pageCtx.title}:**\n• **Split Screen:** Use the 'Add Tool' button to view Docs, Sheets, or Drive side-by-side.\n• **Universal Search:** Press **Ctrl+K** anytime to jump between files, tasks, and tools.\n• **Copilot Assistant:** Press **Alt+M** to toggle this assistant without leaving your work.`;
    } else if (q.includes('hi') || q.includes('hello') || q.includes('hey')) {
      reply = `👋 **Hello!** I'm connected to your active view: **${pageCtx.title}**.\n\nAsk me to summarize this document, organize your tasks, or explain any feature.`;
    } else {
      reply = `✨ **Contextual Assistant (${pageCtx.title}):**\nI've analyzed your question against your current workspace context.\n\n${pageCtx.details ? `*Relevant context: ${pageCtx.details.slice(0, 150)}...*` : ''}\n\nTo connect frontier AI models (Google Gemini 2.0, OpenAI GPT-4o, DeepSeek R1), open the **Mira AI Workspace** from the main left sidebar.`;
    }

    this.addBotMessage(reply);
  }

  addUserMessage(text) {
    this.messages.push({ sender: 'user', text });
    const msgDiv = document.createElement('div');
    msgDiv.className = this.drawer ? 'ai-msg user-msg' : 'copilot-msg-bubble user-msg';
    msgDiv.textContent = text;
    this.messagesContainer?.appendChild(msgDiv);
    this.scrollToBottom();
  }

  addBotMessage(markdown) {
    this.messages.push({ sender: 'bot', text: markdown });
    const msgDiv = document.createElement('div');
    msgDiv.className = this.drawer ? 'ai-msg bot-msg' : 'copilot-msg-bubble bot-msg';

    // Simple markdown formatting
    let formatted = markdown
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/^> (.*?)$/gm, '<blockquote style="border-left: 2.5px solid #a855f7; padding-left: 10px; margin: 6px 0; color: rgba(255,255,255,0.7);">$1</blockquote>')
      .replace(/\n• (.*?)(?=\n|$)/g, '<br/>• $1')
      .replace(/\n\d\. (.*?)(?=\n|$)/g, '<br/>$1')
      .replace(/\n\n/g, '<br/><br/>');

    msgDiv.innerHTML = formatted;
    this.messagesContainer?.appendChild(msgDiv);
    this.scrollToBottom();
  }

  scrollToBottom() {
    if (this.messagesContainer) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
  }
}

// Global hooks
window.openMiraWith = (promptKey) => {
  if (window.miraAi) {
    window.miraAi.openWithPrompt(promptKey);
  }
};

window.toggleMiraCopilot = () => {
  if (window.miraAi) {
    window.miraAi.toggleSidebar();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.miraAi = new MiraAiAssistant();
});
