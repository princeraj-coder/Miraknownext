// ─────────────────────────────────────────────────────────────────────────────
//  js/ai-bot.js — Interactive Mira AI Copilot Split Screen Controller
//  (Microsoft Copilot style split-screen sidebar on right)
// ─────────────────────────────────────────────────────────────────────────────

const MIRA_PROMPTS = {
  brainstorm: 'Help me brainstorm fresh ideas for my project.',
  plan: 'Plan and prioritize my day for maximum productivity.',
  chat: 'What can you help me with in Mira Workspace?'
};

const MIRA_RESPONSES = {
  brainstorm: `✨ **Here are 3 fresh ideas for your workspace:**\n1. **Focus Sprints:** Batch similar tasks into 45-min distraction-free blocks.\n2. **Unified Hub:** Auto-link your PDF notes directly into student project threads.\n3. **Knowledge Cards:** Convert meeting action items into shareable flash cards.`,
  plan: `📋 **Recommended Plan for Today:**\n• **Morning (9:30 - 11:30 AM):** Review & mark student attendance in Batch A.\n• **Afternoon (1:00 - 2:30 PM):** Upload course notes (PDF) & verify attachments.\n• **Late Afternoon (3:00 PM):** Live academic sync meeting with faculty.`,
  chat: `👋 **Hi, I'm Mira Copilot!** Your intelligent companion.\n\nI can assist you with:\n• 📊 Organizing student attendance & generating exports\n• 📂 Summarizing, annotating, and indexing uploaded PDFs\n• 🎥 Scheduling live meetings and study syncs\n• 🔒 Routing questions to the KnowNext anonymous community\n\nWhat would you like to tackle right now?`,
  default: `I'm here to make your workspace effortless. Click any of the shortcut prompts above, or ask me anything!`
};

class MiraAiAssistant {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.init();
  }

  init() {
    this.dockBtn = document.getElementById('dock-btn-mira-ai');
    this.sidebar = document.getElementById('mira-copilot-sidebar');
    this.closeBtn = document.getElementById('copilot-close-btn');
    this.newChatBtn = document.getElementById('copilot-new-chat-btn');
    this.messagesContainer = document.getElementById('copilot-chat-messages');
    this.inputField = document.getElementById('copilot-input-field');
    this.form = document.getElementById('copilot-form');

    // Toggle sidebar on dock button click
    this.dockBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleSidebar();
    });

    // Close button
    this.closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeSidebar();
    });

    // New Topic / Clear chat button
    this.newChatBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearChat();
    });

    // Handle form submit
    this.form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit(e);
    });

    // Preset action buttons inside copilot chips
    document.querySelectorAll('[data-mira-prompt]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.miraPrompt;
        this.openWithPrompt(key);
      });
    });

    // Close when clicking outside on desktop
    document.addEventListener('click', (e) => {
      if (!this.isOpen || !this.sidebar) return;
      if (
        !this.sidebar.contains(e.target) &&
        (!this.dockBtn || !this.dockBtn.contains(e.target)) &&
        !e.target.closest('#dock-btn-mira-ai') &&
        !e.target.closest('[onclick*="openMiraWith"]')
      ) {
        this.closeSidebar();
      }
    });

    // Initial message
    if (this.messages.length === 0 && this.messagesContainer) {
      this.addBotMessage(MIRA_RESPONSES.chat);
    }
  }

  toggleSidebar() {
    if (this.isOpen) {
      this.closeSidebar();
    } else {
      this.openSidebar();
    }
  }

  // Alias for backward compatibility
  toggleDrawer() {
    this.toggleSidebar();
  }

  openDrawer() {
    this.openSidebar();
  }

  closeDrawer() {
    this.closeSidebar();
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

  clearChat() {
    this.messages = [];
    if (this.messagesContainer) {
      this.messagesContainer.innerHTML = '';
    }
    this.addBotMessage(`✨ **New Topic Started.**\n\nHow can I help you in your workspace today?`);
    setTimeout(() => this.inputField?.focus(), 150);
  }

  openWithPrompt(keyOrText) {
    if (!this.isOpen) this.openSidebar();
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
    this.inputField.value = '';

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
    msgDiv.className = 'copilot-msg-bubble user-msg';
    msgDiv.textContent = text;
    this.messagesContainer?.appendChild(msgDiv);
    this.scrollToBottom();
  }

  addBotMessage(markdown) {
    this.messages.push({ sender: 'bot', text: markdown });
    const msgDiv = document.createElement('div');
    msgDiv.className = 'copilot-msg-bubble bot-msg';

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
    window.miraAi.toggleSidebar();
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.miraAi = new MiraAiAssistant();
});
