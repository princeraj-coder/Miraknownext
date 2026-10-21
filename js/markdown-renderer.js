// ─────────────────────────────────────────────────────────────────────────────
//  js/markdown-renderer.js — Secure Markdown & Code Syntax Renderer
// ─────────────────────────────────────────────────────────────────────────────
import { marked } from 'marked';

// Configure marked options
marked.setOptions({
  gfm: true,
  breaks: true,
  pedantic: false
});

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Custom renderer for marked to produce styled code blocks with copy buttons
 */
const renderer = new marked.Renderer();

renderer.code = function({ text, lang }) {
  const language = (lang || 'code').toLowerCase().trim();
  const escaped = escapeHtml(text);
  const codeId = 'code-' + Math.random().toString(36).substring(2, 9);

  return `
    <div class="ai-code-block" id="${codeId}">
      <div class="ai-code-header">
        <span class="ai-code-lang">${language}</span>
        <button type="button" class="ai-code-copy-btn" onclick="window.miraAiChat?.copyCodeSnippet(this)" data-code="${encodeURIComponent(text)}" title="Copy code">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        </button>
      </div>
      <pre class="ai-code-content"><code class="language-${language}">${escaped}</code></pre>
    </div>
  `;
};

renderer.link = function({ href, title, text }) {
  const safeHref = href.startsWith('javascript:') ? '#' : href;
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer"${titleAttr} class="ai-link">${text}</a>`;
};

renderer.table = function({ header, rows }) {
  return `
    <div class="ai-table-wrapper">
      <table class="ai-table">
        <thead>${header}</thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
};

/**
 * Render Markdown string into safe, styled HTML
 */
export function renderMarkdown(markdownText) {
  if (!markdownText) return '';
  try {
    return marked.parse(markdownText, { renderer });
  } catch (err) {
    console.warn('[Markdown Render Fallback]', err);
    return `<p>${escapeHtml(markdownText).replace(/\n/g, '<br>')}</p>`;
  }
}
