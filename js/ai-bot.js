// ─────────────────────────────────────────────────────────────────────────────
//  js/ai-bot.js — Interactive Mira AI Controller
//  Supports both Landing Page Character Drawer & Dashboard Copilot Sidebar
// ─────────────────────────────────────────────────────────────────────────────

const MIRA_PROMPTS = {
  brainstorm: 'Help me brainstorm fresh ideas for my project.',
  plan: 'Plan and prioritize my day for maximum productivity.',
  chat: 'What can you help me with in Mira Workspace?'
};

const MIRA_RESPONSES = {
  brainstorm: `✨ **Here are 3 fresh ideas for your workspace:**\n1. **Focus Sprints:** Batch similar tasks into 45-min distraction-free blocks.\n2. **Unified Hub:** Auto-link your PDF notes directly into student project threads.\n3. **Knowledge Cards:** Convert meeting action items into shareable flash cards.`,
  plan: `📋 **Recommended Plan for Today:**\n• **Morning (9:30 - 11:30 AM):** Review & mark student attendance in Batch A.\n• **Afternoon (1:00 - 2:30 PM):** Upload course notes (PDF) & verify attachments.\n• **Late Afternoon (3:00 PM):** Live academic sync meeting with faculty.`,
  chat: `👋 **Hi, I'm Mira!** Your intelligent workspace companion.\n\nI can assist you with:\n• 📊 Organizing student attendance & generating exports\n• 📂 Summarizing, annotating, and indexing uploaded PDFs\n• 🎥 Scheduling live meetings and study syncs\n• 🔒 Routing questions to the KnowNext anonymous community\n\nWhat would you like to tackle right now?`,
  default: `I'm here to make your workspace effortless. Click any of the shortcut prompts above, or ask me anything!`
};

class MiraAiAssistant {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.init();
  }

  init() {
    // Dashboard copilot elements
    this.dockBtn = document.getElementById('dock-btn-mira-ai');
    this.sidebar = document.getElementById('mira-copilot-sidebar');
    this.closeBtn = document.getElementById('copilot-close-btn') || document.getElementById('ai-close-drawer');
    this.newChatBtn = document.getElementById('copilot-new-chat-btn');
    this.messagesContainer = document.getElementById('copilot-chat-messages') || document.getElementById('ai-chat-messages');
    this.inputField = document.getElementById('copilot-input-field') || document.getElementById('ai-chat-input');
    this.form = document.getElementById('copilot-form');

    // Landing page specific elements
    this.charBtn = document.getElementById('ai-character-button');
    this.askPill = document.getElementById('ai-ask-pill');
    this.drawer = document.getElementById('ai-chat-drawer');
    this.sendBtn = document.getElementById('ai-send-btn');

    // 1. Dashboard Dock Button Toggle
    this.dockBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleSidebar();
    });

    // 2. Landing Page Character & Ask Pill Toggle
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

    // 4. New Topic / Clear chat button (Dashboard)
    this.newChatBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearChat();
    });

    // 5. Form submit (Dashboard)
    this.form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit(e);
    });

    // 6. Send button & enter key (Landing Page)
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

    // 7. Preset prompt chips
    document.querySelectorAll('[data-mira-prompt]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.miraPrompt;
        this.openWithPrompt(key);
      });
    });

    // 8. Outside click dismiss
    document.addEventListener('click', (e) => {
      if (!this.isOpen) return;

      // For landing drawer
      if (this.drawer && !this.drawer.contains(e.target) && !e.target.closest('#ai-bot-dock') && !e.target.closest('[onclick*="openMiraWith"]')) {
        this.closeDrawer();
        return;
      }

      // For dashboard sidebar
      if (
        this.sidebar &&
        !this.sidebar.contains(e.target) &&
        (!this.dockBtn || !this.dockBtn.contains(e.target)) &&
        !e.target.closest('#dock-btn-mira-ai') &&
        !e.target.closest('[onclick*="openMiraWith"]')
      ) {
        this.closeSidebar();
      }
    });

    // Initial bot welcome message
    if (this.messages.length === 0 && this.messagesContainer) {
      this.addBotMessage(MIRA_RESPONSES.chat);
    }
  }

  // Dashboard Sidebar Controls
  toggleSidebar() {
    if (this.isOpen) {
      this.closeSidebar();
    } else {
      this.openSidebar();
    }
  }

  openSidebar() {
    this.isOpen = true;
    this.sidebar?.classList.add('open');
    this.dockBtn?.classList.add('active');

    if (this.messages.length === 0 && this.messagesContainer) {
      this.addBotMessage(MIRA_RESPONSES.chat);
    }
    setTimeout(() => this.inputField?.focus(), 150);
  }

  closeSidebar() {
    this.isOpen = false;
    this.sidebar?.classList.remove('open');
    this.dockBtn?.classList.remove('active');
  }

  // Landing Page Drawer Controls
  toggleDrawer() {
    if (this.isOpen) {
      this.closeDrawer();
    } else {
      this.openDrawer();
    }
  }

  openDrawer() {
    this.isOpen = true;
    this.drawer?.classList.add('open');
    if (this.messages.length === 0 && this.messagesContainer) {
      this.addBotMessage(MIRA_RESPONSES.chat);
    }
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
    this.addBotMessage(`✨ **New Topic Started.**\n\nHow can I help you in your workspace today?`);
    setTimeout(() => this.inputField?.focus(), 150);
  }

  openWithPrompt(keyOrText) {
    if (!this.isOpen) {
      if (this.drawer) {
        this.openDrawer();
      } else {
        this.openSidebar();
      }
    }

    const promptText = MIRA_PROMPTS[keyOrText] || keyOrText;
    this.addUserMessage(promptText);

    setTimeout(() => {
      let reply = MIRA_RESPONSES[keyOrText];
      if (!reply) {
        const lower = String(keyOrText).toLowerCase();
        if (lower.includes('plan') || lower.includes('prioritize') || lower.includes('day')) {
          reply = MIRA_RESPONSES.plan;
        } else if (lower.includes('brainstorm') || lower.includes('fresh') || lower.includes('idea')) {
          reply = MIRA_RESPONSES.brainstorm;
        } else if (lower.includes('help') || lower.includes('chat') || lower.includes('what can you')) {
          reply = MIRA_RESPONSES.chat;
        } else {
          reply = MIRA_RESPONSES.default;
        }
      }
      this.addBotMessage(reply);
    }, 400);
  }

  handleFormSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const text = this.inputField?.value.trim();
    if (!text) return;
    this.addUserMessage(text);
    if (this.inputField) this.inputField.value = '';

    setTimeout(() => {
      const lower = text.toLowerCase();
      let reply = MIRA_RESPONSES.default;
      if (lower.includes('plan') || lower.includes('day') || lower.includes('schedule')) {
        reply = MIRA_RESPONSES.plan;
      } else if (lower.includes('idea') || lower.includes('brainstorm') || lower.includes('fresh')) {
        reply = MIRA_RESPONSES.brainstorm;
      } else if (lower.includes('attendance') || lower.includes('student')) {
        reply = `📊 **Attendance Manager:**\nYou can track and toggle attendance directly in your Mira Workspace. 32 / 38 students are marked present today. Click 'Launch Workspace' to export CSV.`;
      } else if (lower.includes('pdf') || lower.includes('doc') || lower.includes('note')) {
        reply = `📂 **PDF Hub:**\nYou can drag and drop lecture notes and share them instantly with specific classes or batches.`;
      } else if (lower.includes('doubt') || lower.includes('question') || lower.includes('knownext')) {
        reply = `🔒 **KnowNext Q&A:**\nAll doubts on KnowNext are 100% anonymous, tagged by Roll Number so students ask freely without peer pressure.`;
      } else if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
        reply = `👋 Hello! How is your workflow going? Ask me to brainstorm ideas, plan your schedule, or organize your workspace!`;
      }
      this.addBotMessage(reply);
    }, 450);
  }

  addUserMessage(text) {
    this.messages.push({ sender: 'user', text });
    const msgDiv = document.createElement('div');
    // Supports both copilot and landing classes
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
    if (window.miraAi.drawer) {
      window.miraAi.toggleDrawer();
    } else {
      window.miraAi.toggleSidebar();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.miraAi = new MiraAiAssistant();
});
