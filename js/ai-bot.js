// ─────────────────────────────────────────────────────────────────────────────
//  js/ai-bot.js — Interactive Mira AI Floating Character & Chat Assistant
// ─────────────────────────────────────────────────────────────────────────────

const MIRA_PROMPTS = {
  brainstorm: 'Help me brainstorm fresh ideas for my project.',
  plan: 'Plan and prioritize my day for maximum productivity.',
  chat: 'What can you help me with in Mira Workspace?'
};

const MIRA_RESPONSES = {
  brainstorm: `✨ **Here are 3 fresh ideas for your workspace:**\n1. **Focus Sprints:** Batch similar tasks into 45-min distraction-free blocks.\n2. **Unified Hub:** Auto-link your PDF notes directly into student project threads.\n3. **Knowledge Cards:** Convert meeting action items into shareable flash cards.`,
  plan: `📋 **Recommended Plan for Today:**\n• **Morning (9:30 - 11:30 AM):** Review & mark student attendance in Batch A.\n• **Afternoon (1:00 - 2:30 PM):** Upload course notes (PDF) & verify attachments.\n• **Late Afternoon (3:00 PM):** Live academic sync meeting with faculty.`,
  chat: `👋 **Hi, I'm Mira!** I'm your workspace AI companion.\n\nI can help you with:\n• 📊 Organizing student attendance & generating exports\n• 📂 Summarizing and indexing uploaded PDFs\n• 🎥 Scheduling live meetings and study syncs\n• 🔒 Routing questions to the KnowNext anonymous community\n\nWhat would you like to tackle right now?`,
  default: `I'm here to make your workspace effortless. Click any of the shortcut prompts above, or ask me anything!`
};

class MiraAiAssistant {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.init();
  }

  init() {
    this.dock = document.getElementById('ai-bot-dock');
    this.charBtn = document.getElementById('ai-character-button');
    this.askPill = document.getElementById('ai-ask-pill');
    this.chatDrawer = document.getElementById('ai-chat-drawer');
    this.chatMessages = document.getElementById('ai-chat-messages');
    this.chatInput = document.getElementById('ai-chat-input');
    this.sendBtn = document.getElementById('ai-send-btn');
    this.closeBtn = document.getElementById('ai-close-drawer');

    if (!this.charBtn) return;

    // Toggle drawer on character click
    this.charBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDrawer();
    });

    // Close button inside chat drawer
    this.closeBtn?.addEventListener('click', () => this.closeDrawer());

    // Send button & enter key
    this.sendBtn?.addEventListener('click', () => this.handleSendMessage());
    this.chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    // Preset action buttons inside drawer
    document.querySelectorAll('[data-mira-prompt]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.miraPrompt;
        this.openWithPrompt(key);
      });
    });

    // Quick floating icon triggers
    document.querySelectorAll('.ai-float-icon').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        this.openWithPrompt(action);
      });
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.chatDrawer.contains(e.target) && !this.dock.contains(e.target)) {
        this.closeDrawer();
      }
    });
  }

  toggleDrawer() {
    if (this.isOpen) {
      this.closeDrawer();
    } else {
      this.openDrawer();
    }
  }

  openDrawer() {
    this.isOpen = true;
    this.dock?.classList.add('active');
    this.chatDrawer?.classList.add('open');
    if (this.askPill) this.askPill.style.display = 'none';

    if (this.messages.length === 0) {
      this.addBotMessage(MIRA_RESPONSES.chat);
    }

    setTimeout(() => this.chatInput?.focus(), 250);
  }

  closeDrawer() {
    this.isOpen = false;
    this.dock?.classList.remove('active');
    this.chatDrawer?.classList.remove('open');
    if (this.askPill) this.askPill.style.display = 'inline-flex';
  }

  openWithPrompt(keyOrText) {
    if (!this.isOpen) this.openDrawer();
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
    }, 450);
  }

  handleSendMessage() {
    const text = this.chatInput?.value.trim();
    if (!text) return;
    this.addUserMessage(text);
    this.chatInput.value = '';

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
      }
      this.addBotMessage(reply);
    }, 500);
  }

  addUserMessage(text) {
    this.messages.push({ sender: 'user', text });
    const msgDiv = document.createElement('div');
    msgDiv.className = 'ai-msg user-msg';
    msgDiv.textContent = text;
    this.chatMessages?.appendChild(msgDiv);
    this.scrollToBottom();
  }

  addBotMessage(markdown) {
    this.messages.push({ sender: 'bot', text: markdown });
    const msgDiv = document.createElement('div');
    msgDiv.className = 'ai-msg bot-msg';

    // Simple markdown conversion
    let formatted = markdown
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n• (.*?)(?=\n|$)/g, '<br/>• $1')
      .replace(/\n\d\. (.*?)(?=\n|$)/g, '<br/>$1')
      .replace(/\n\n/g, '<br/><br/>');

    msgDiv.innerHTML = formatted;
    this.chatMessages?.appendChild(msgDiv);
    this.scrollToBottom();
  }

  scrollToBottom() {
    if (this.chatMessages) {
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
  }
}

// Global hook
window.openMiraWith = (promptKey) => {
  if (window.miraAi) {
    window.miraAi.openWithPrompt(promptKey);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.miraAi = new MiraAiAssistant();
});
