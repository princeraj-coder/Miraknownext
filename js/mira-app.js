import { supabase } from './supabase.js';
// ─────────────────────────────────────────────────────────────────────────────
//  js/mira-app.js — Core Controller for Mira Workspace & KnowNext Platform
// ─────────────────────────────────────────────────────────────────────────────

class MiraApp {
  constructor() {
    this.currentView = 'home';
    this.tasks = [
      { id: 't1', title: 'Review product roadmap & sprint board', priority: 'high', priorityLabel: 'High priority', tag: 'Academic', time: '10:00 AM', done: false, date: 'Today' },
      { id: 't2', title: 'Upload lecture notes and PDF handouts', priority: 'medium', priorityLabel: 'Medium priority', tag: 'Docs', time: '1:30 PM', done: false, date: 'Today' },
      { id: 't3', title: 'Prepare live faculty sync presentation', priority: 'low', priorityLabel: 'Low priority', tag: 'Meet', time: '3:00 PM', done: true, date: 'Today' },
      { id: 't4', title: 'Answer student doubts on KnowNext forum', priority: 'medium', priorityLabel: 'Medium priority', tag: 'KnowNext', time: '5:00 PM', done: false, date: 'Today' }
    ];
    this.activeStudioTools = ['docs', 'sheets', 'mail'];
    this.minimizedTools = new Set();
    this.maximizedTool = null;
    this.currentTaskFilter = 'all';
    this.currentProject = 'Product launch';
    this.userRollNo = '#23CS048';
    this.focusMinutes = 25;
    this.sessionWorkDone = new Set(['docs', 'sheets', 'mail']);

    // Focus Sessions State (Windows 11 Clock inspired)
    this.focusDurationMinutes = 25;
    this.focusRemainingSeconds = 25 * 60;
    this.focusTimerInterval = null;
    this.focusIsRunning = false;
    this.focusDailyCompleted = 1;
    this.focusDailyTarget = 4;
    this.focusLinkedTaskId = null;
    this.focusAmbientAudio = 'Silence';

    this.init();
  }

  init() {
    this.bindNavigation();
    this.bindProjectDropdown();
    this.bindTasksInteractions();
    this.bindStudioInteractions();
    this.bindKnowNextInteractions();
    this.bindModals();
    this.bindKeyboardShortcuts();
    this.renderTasks();
    this.updateDayFlow();
    this.renderSplitWorkspace();
    this.renderSidebarOpenToolsTray();
    this.updateSessionStats();
    this.initFocusTimer();
    this.populateFocusTasks();
    this.bindDockFlyoutPanels();
    this.initSidebarCollapse();
    this.initGlobalTopBar();
    this.initUniversalSearch();
    this.initAuthAndProfile();
    this.initSyncStatus();
  }

  // ── 1. SIDEBAR & VIEW SWITCHING ──
  bindNavigation() {
    const navButtons = document.querySelectorAll('[data-nav-view]');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetView = btn.dataset.navView;
        this.switchView(targetView);
      });
    });

    // Special quick links
    document.querySelectorAll('[data-switch-view]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const target = el.dataset.switchView;
        this.switchView(target);
      });
    });
  }

  switchView(viewName) {
    // If Knownext is requested, open it natively inside the workspace studio
    if (viewName === 'knownext') {
      this.addToolToSplitWorkspace('knownext');
      return;
    }
    if (viewName === 'drive') {
      this.addToolToSplitWorkspace('drive');
      return;
    }
    if (viewName === 'docs') {
      this.addToolToSplitWorkspace('docs');
      return;
    }
    if (viewName === 'sheets') {
      this.addToolToSplitWorkspace('sheets');
      return;
    }
    if (viewName === 'slides') {
      this.addToolToSplitWorkspace('slides');
      return;
    }

    this.currentView = viewName;

    // Update dock buttons
    document.querySelectorAll('.dock-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.navView === viewName) {
        btn.classList.add('active');
      }
    });

    // Update view sections
    document.querySelectorAll('.view-section').forEach(sec => {
      sec.classList.remove('active');
    });

    const activeSection = document.getElementById(`view-${viewName}`);
    if (activeSection) {
      activeSection.classList.add('active');
    }

    // Toggle workspace center tabs in top bar
    const centerTabs = document.getElementById('workspace-tabs-center');
    if (centerTabs) {
      if (viewName === 'workspace') {
        centerTabs.classList.add('active');
      } else {
        centerTabs.classList.remove('active');
      }
    }

    // Scroll to top of viewport
    const viewport = document.getElementById('views-viewport');
    if (viewport) viewport.scrollTop = 0;

    // Close Copilot if navigating to Full Mira AI Workspace page
    if (viewName === 'ai') {
      window.miraAi?.closeSidebar();
    }

    if (viewName === 'home') {
      this.updateSessionStats();
    } else if (viewName === 'workspace') {
      this.renderSplitWorkspace();
      this.renderSidebarOpenToolsTray();
      this.updateSessionStats();
    }
  }

  // ── 1B. CONTEXT-AWARE EXTRACTION FOR COPILOT ──
  getPageContext() {
    const view = this.currentView;
    const ctx = {
      view: view,
      title: 'Mira Workspace',
      details: '',
      tools: []
    };

    if (view === 'ai') {
      ctx.title = 'Full Mira AI Platform';
      ctx.details = 'Full multi-model AI workspace';
    } else if (view === 'home') {
      ctx.title = 'Home Dashboard';
      const pendingCount = this.tasks.filter(t => !t.done).length;
      ctx.details = `Home workspace. Pending tasks: ${pendingCount}. Focus streak: 3 days. Focus completed: ${this.focusDailyCompleted}/${this.focusDailyTarget}.`;
    } else if (view === 'workspace') {
      ctx.title = 'Studio Multi-Window Workspace';
      ctx.tools = Array.from(this.activeStudioTools);
      let docSnippet = '';
      const docPane = document.getElementById('split-pane-docs');
      if (docPane && docPane.style.display !== 'none') {
        const text = docPane.innerText.slice(0, 1500).replace(/\s+/g, ' ').trim();
        docSnippet = ` Open Document Snippet: "${text.slice(0, 400)}..."`;
      }
      ctx.details = `Active studio tools: ${ctx.tools.join(', ')}.${docSnippet}`;
    } else if (view === 'tasks') {
      ctx.title = 'Tasks & Calendar Board';
      const taskList = this.tasks.map(t => `${t.title} [${t.priority} priority, ${t.done ? 'Done' : 'Pending'}]`).join('; ');
      ctx.details = `Tasks on board: ${taskList}`;
    } else if (view === 'focus') {
      ctx.title = 'Focus Session Hub';
      const mins = Math.floor(this.focusRemainingSeconds / 60);
      ctx.details = `Focus timer: ${mins} minutes remaining. Daily target: ${this.focusDailyCompleted}/${this.focusDailyTarget}.`;
    } else if (view === 'tools') {
      ctx.title = 'Tools & Plugins Showcase';
      ctx.details = 'Overview of integrated tools: Docs, Sheets, Drive, Mail, Slides, Focus, Meet, and KnowNext.';
    }

    return ctx;
  }

  // ── 2. PROJECT / WORKSPACE SELECTOR DROPDOWN ──
  bindProjectDropdown() {
    const trigger = document.getElementById('btn-project-selector');
    const dropdown = document.getElementById('project-dropdown');
    const titleEl = document.getElementById('current-project-name');

    if (!trigger || !dropdown) return;

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });

    document.querySelectorAll('.dropdown-item[data-project]').forEach(item => {
      item.addEventListener('click', () => {
        const projectName = item.dataset.project;
        this.currentProject = projectName;
        if (titleEl) titleEl.textContent = projectName;

        document.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        dropdown.classList.remove('open');

        this.triggerSavedNotification(`Switched to "${projectName}"`);
      });
    });

    document.addEventListener('click', (e) => {
      if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
  }

  triggerSavedNotification(msg = 'All changes saved') {
    const statusText = document.getElementById('status-save-text');
    const dot = document.querySelector('.status-dot-emerald');
    if (!statusText) return;

    statusText.textContent = 'Saving...';
    if (dot) dot.style.background = '#eab308';

    setTimeout(() => {
      statusText.textContent = msg;
      if (dot) dot.style.background = '#10b981';
      setTimeout(() => {
        statusText.textContent = 'All changes saved';
      }, 2500);
    }, 400);
  }

  // ── 3. PLAN YOUR DAY & TASKS MANAGEMENT (Notion & Google Tasks inspired) ──
  bindTasksInteractions() {
    // Add to plan trigger buttons (Modals)
    document.querySelectorAll('[data-open-add-task]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openModal('modal-add-task');
      });
    });

    // Form submit from Modal
    const addTaskForm = document.getElementById('form-add-task');
    if (addTaskForm) {
      addTaskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('task-input-title');
        const prioSelect = document.getElementById('task-input-priority');
        const title = input?.value.trim();
        const prio = prioSelect?.value || 'medium';

        if (!title) return;

        const prioLabels = {
          high: 'High priority',
          medium: 'Medium priority',
          low: 'Low priority'
        };

        const newTask = {
          id: 't_' + Date.now(),
          title: title,
          priority: prio,
          priorityLabel: prioLabels[prio] || 'Medium priority',
          tag: 'Daily Plan',
          time: 'Today',
          done: false,
          date: 'Today'
        };

        this.tasks.unshift(newTask);
        this.renderTasks();
        this.updateDayFlow();
        this.closeModal('modal-add-task');
        if (input) input.value = '';
        this.triggerSavedNotification('Added to plan');
      });
    }

    // Inline quick-add form on Home Plan Card (Notion / Google Tasks style)
    const quickForm = document.getElementById('form-home-quick-task');
    if (quickForm) {
      quickForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleHomeQuickTaskSubmit(e);
      });
    }

    // Filter tabs in big tasks page
    document.querySelectorAll('.task-filter-pill[data-filter]').forEach(pill => {
      pill.addEventListener('click', () => {
        const filter = pill.dataset.filter;
        this.currentTaskFilter = filter;
        document.querySelectorAll('.task-filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        // Toggle calendar view vs tasks list
        const tasksCard = document.getElementById('tasks-card-canvas');
        const calCanvas = document.getElementById('calendar-view-canvas');

        if (filter === 'calendar') {
          if (tasksCard) tasksCard.style.display = 'none';
          if (calCanvas) calCanvas.classList.add('active');
        } else {
          if (tasksCard) tasksCard.style.display = 'block';
          if (calCanvas) calCanvas.classList.remove('active');
          this.renderTasks();
        }
      });
    });
  }

  handleHomeQuickTaskSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('home-quick-task-input');
    const title = input?.value?.trim();
    if (!title) return;

    const newTask = {
      id: 't_' + Date.now(),
      title: title,
      priority: 'medium',
      priorityLabel: 'Medium priority',
      tag: 'Daily Plan',
      time: 'Today',
      done: false,
      date: 'Today'
    };

    this.tasks.unshift(newTask);
    if (input) input.value = '';
    this.renderTasks();
    this.updateDayFlow();
    this.triggerSavedNotification('Added to plan');
  }

  toggleTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.done = !task.done;
      this.renderTasks();
      this.updateDayFlow();
      this.triggerSavedNotification(task.done ? 'Plan item completed' : 'Plan item reopened');
    }
  }

  deleteTask(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.renderTasks();
    this.updateDayFlow();
    this.triggerSavedNotification('Removed from plan');
  }

  updateDayFlow() {
    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.done).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const remaining = total - completed;

    // 1. Update Home "Plan your day" Card (Notion & Google Tasks Progress)
    const planProgressText = document.getElementById('plan-progress-status-text');
    const planProgressPct = document.getElementById('plan-progress-pct-text');
    const planProgressFill = document.getElementById('plan-progress-fill-bar');
    const planDateSub = document.getElementById('plan-day-date-text');

    if (planProgressText) {
      planProgressText.textContent = `${completed} of ${total} completed`;
    }
    if (planProgressPct) {
      planProgressPct.textContent = `${percentage}%`;
    }
    if (planProgressFill) {
      planProgressFill.style.width = `${percentage}%`;
    }
    if (planDateSub) {
      const now = new Date();
      const options = { weekday: 'short', month: 'short', day: 'numeric' };
      const formatted = now.toLocaleDateString('en-US', options);
      planDateSub.textContent = `Focus Schedule · ${formatted}`;
    }

    // 2. Update Home Work OS row count
    const homeSubCount = document.getElementById('home-tasks-sub-count');
    if (homeSubCount) homeSubCount.textContent = `${remaining} open · Synced`;

    // 3. Update Home hero Day flow number & progress bar
    const flowNum = document.getElementById('dayflow-percentage-text');
    const flowBar = document.getElementById('dayflow-bar-fill');
    const badgeText = document.getElementById('home-tasks-done-badge');
    const heroIntent = document.getElementById('hero-priorities-left');

    if (flowNum) flowNum.textContent = `${percentage}%`;
    if (flowBar) flowBar.style.width = `${percentage}%`;
    if (badgeText) badgeText.textContent = `${completed}/${total} done`;

    if (heroIntent) {
      if (remaining === 0) {
        heroIntent.textContent = 'All clear! Every priority finished for today.';
      } else {
        heroIntent.textContent = `${remaining} priorit${remaining === 1 ? 'y' : 'ies'} left. Keep today clear and intentional.`;
      }
    }

    // 4. Update filter counts
    const filterAll = document.getElementById('badge-count-all');
    const filterTodo = document.getElementById('badge-count-todo');
    const filterDone = document.getElementById('badge-count-done');

    if (filterAll) filterAll.textContent = total;
    if (filterTodo) filterTodo.textContent = remaining;
    if (filterDone) filterDone.textContent = completed;

    const countHeader = document.getElementById('big-tasks-counter');
    if (countHeader) countHeader.textContent = `${total} plans`;
  }

  renderTasks() {
    // 1. Render Home "Plan your day" Checklist (Google Tasks & Notion style)
    const homeList = document.getElementById('home-checklist-container');
    if (homeList) {
      homeList.innerHTML = '';
      if (this.tasks.length === 0) {
        homeList.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 13.5px;">✨ All clear! Type below to plan your next task.</div>`;
      } else {
        this.tasks.forEach(t => {
          const item = document.createElement('div');
          item.className = `check-item ${t.done ? 'done' : ''}`;
          item.innerHTML = `
            <div class="check-item-left" onclick="window.miraApp.toggleTask('${t.id}')">
              <div class="custom-checkbox" title="${t.done ? 'Mark pending' : 'Mark completed'}">
                <svg viewBox="0 0 24 24" fill="none">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <div class="task-info-block">
                <div class="task-title">${this.escapeHtml(t.title)}</div>
                <div class="task-meta-line">
                  <span class="priority-dot-${t.priority === 'high' ? 'red' : t.priority === 'medium' ? 'yellow' : 'green'}"></span>
                  <span>${t.time || 'Today'} · ${t.priorityLabel}</span>
                  ${t.tag ? `<span class="task-tag-badge">${this.escapeHtml(t.tag)}</span>` : ''}
                </div>
              </div>
            </div>
            <button type="button" class="item-action-menu" onclick="window.miraApp.deleteTask('${t.id}')" title="Delete from plan">✕</button>
          `;
          homeList.appendChild(item);
        });
      }
    }

    // 2. Render Big Tasks / Plan Page List
    const bigList = document.getElementById('big-tasks-list-container');
    if (bigList) {
      bigList.innerHTML = '';
      let filtered = this.tasks;
      if (this.currentTaskFilter === 'todo') {
        filtered = this.tasks.filter(t => !t.done);
      } else if (this.currentTaskFilter === 'done') {
        filtered = this.tasks.filter(t => t.done);
      }

      if (filtered.length === 0) {
        bigList.innerHTML = `<div style="padding: 2.5rem; text-align: center; color: var(--text-muted); font-size: 14px;">No items in this view. Click '+ Add to plan' above to create one.</div>`;
        return;
      }

      filtered.forEach(t => {
        const item = document.createElement('div');
        item.className = `check-item ${t.done ? 'done' : ''}`;
        item.innerHTML = `
          <div class="check-item-left" onclick="window.miraApp.toggleTask('${t.id}')">
            <div class="custom-checkbox" title="${t.done ? 'Mark pending' : 'Mark completed'}">
              <svg viewBox="0 0 24 24" fill="none">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div class="task-info-block">
              <div class="task-title">${this.escapeHtml(t.title)}</div>
              <div class="task-meta-line">
                <span class="priority-dot-${t.priority === 'high' ? 'red' : t.priority === 'medium' ? 'yellow' : 'green'}"></span>
                <span>${t.time || 'Today'} · ${t.priorityLabel}</span>
                ${t.tag ? `<span class="task-tag-badge">${this.escapeHtml(t.tag)}</span>` : ''}
              </div>
            </div>
          </div>
          <button type="button" class="item-action-menu" onclick="window.miraApp.deleteTask('${t.id}')" title="Delete from plan">✕</button>
        `;
        bigList.appendChild(item);
      });
    }

    this.populateFocusTasks();
  }

  // ── 4. MULTI-TOOL SPLIT WORKSPACE STUDIO (Image 1 & Image 2) ──
  bindStudioInteractions() {
    // 1. Clicking Workspace button in sidebar toggles Tool Library flyout (Image 1)
    const wsBtn = document.getElementById('dock-btn-workspace');
    wsBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleToolLibrary();
    });

    // Close Tool Library popup when clicking anywhere outside
    document.addEventListener('click', (e) => {
      const popup = document.getElementById('workspace-tool-library-popup');
      if (
        popup &&
        popup.classList.contains('open') &&
        !popup.contains(e.target) &&
        !wsBtn?.contains(e.target)
      ) {
        this.closeToolLibrary();
      }
    });

    // Ticking focus timer for live workspace sessions
    setInterval(() => {
      if (this.currentView === 'workspace') {
        this.focusMinutes += 1;
        this.updateSessionStats();
      }
    }, 60000);
  }

  toggleToolLibrary() {
    const popup = document.getElementById('workspace-tool-library-popup');
    if (!popup) return;
    if (popup.classList.contains('open')) {
      this.closeToolLibrary();
    } else {
      this.openToolLibrary();
    }
  }

  openToolLibrary() {
    const popup = document.getElementById('workspace-tool-library-popup');
    if (!popup) return;
    popup.classList.add('open');

    // Update active badges in popup
    document.querySelectorAll('.tool-lib-item[data-lib-tool]').forEach(item => {
      const tool = item.dataset.libTool;
      const statusSpan = document.getElementById(`lib-status-${tool}`);
      if (this.activeStudioTools.includes(tool)) {
        item.classList.add('active-in-split');
        if (statusSpan) statusSpan.className = 'tool-lib-status open';
      } else {
        item.classList.remove('active-in-split');
        if (statusSpan) statusSpan.className = 'tool-lib-status';
      }
    });
  }

  closeToolLibrary() {
    const popup = document.getElementById('workspace-tool-library-popup');
    popup?.classList.remove('open');
  }

  addToolToSplitWorkspace(tool) {
    if (!this.activeStudioTools.includes(tool)) {
      this.activeStudioTools.push(tool);
    }
    this.minimizedTools.delete(tool);
    this.sessionWorkDone.add(tool);
    this.renderSplitWorkspace();
    this.renderSidebarOpenToolsTray();
    this.updateSessionStats();
    this.closeToolLibrary();
    this.switchView('workspace');
    this.triggerSavedNotification(`Opened ${this.getToolDisplayName(tool)} in Split Screen`);

    setTimeout(() => {
      this.focusToolPane(tool);
    }, 150);
  }

  removeToolFromSplitWorkspace(tool) {
    this.activeStudioTools = this.activeStudioTools.filter(t => t !== tool);
    this.minimizedTools.delete(tool);
    if (this.maximizedTool === tool) {
      this.maximizedTool = null;
    }
    this.sessionWorkDone.add(tool);
    this.renderSplitWorkspace();
    this.renderSidebarOpenToolsTray();
    this.updateSessionStats();

    // When the work of user is done and they close all windows one by one, return to home screen
    if (this.activeStudioTools.length === 0) {
      this.switchView('home');
      this.triggerSavedNotification('All workspace windows closed · Returned to Home');
    } else {
      this.triggerSavedNotification(`Closed ${this.getToolDisplayName(tool)} window`);
    }
  }

  minimizeToolPane(tool) {
    if (this.maximizedTool === tool) {
      this.maximizedTool = null;
    }
    this.minimizedTools.add(tool);
    this.renderSplitWorkspace();
    this.triggerSavedNotification(`Minimized ${this.getToolDisplayName(tool)} window`);
  }

  restoreToolPane(tool) {
    this.minimizedTools.delete(tool);
    this.renderSplitWorkspace();
    this.focusToolPane(tool);
    this.triggerSavedNotification(`Restored ${this.getToolDisplayName(tool)} window`);
  }

  maximizeToolPane(tool) {
    if (this.maximizedTool === tool) {
      this.maximizedTool = null;
      this.triggerSavedNotification(`Restored split view for ${this.getToolDisplayName(tool)}`);
    } else {
      this.minimizedTools.delete(tool);
      this.maximizedTool = tool;
      this.triggerSavedNotification(`Maximized ${this.getToolDisplayName(tool)} to full window`);
    }
    this.renderSplitWorkspace();
    this.focusToolPane(tool);
  }

  focusToolPane(tool) {
    const pane = document.getElementById(`split-pane-${tool}`);
    if (pane) {
      pane.scrollIntoView({ behavior: 'smooth', inline: 'center' });
      pane.style.boxShadow = '0 0 0 3px #743eed, 0 25px 50px rgba(0,0,0,0.5)';
      setTimeout(() => {
        pane.style.boxShadow = '';
      }, 1200);
    }
  }

  renderSplitWorkspace() {
    const container = document.getElementById('split-workspace-canvas');
    if (!container) return;

    if (this.maximizedTool) {
      container.classList.add('has-maximized');
    } else {
      container.classList.remove('has-maximized');
    }

    const panes = container.querySelectorAll('.split-window-pane');
    let visibleCount = 0;

    panes.forEach(pane => {
      const tool = pane.dataset.paneTool;
      const isMax = this.maximizedTool === tool;
      const isMin = this.minimizedTools.has(tool);
      const isActive = this.activeStudioTools.includes(tool);

      // Maximize state
      if (isMax) {
        pane.classList.add('maximized');
      } else {
        pane.classList.remove('maximized');
      }

      // Maximize button text
      const maxBtn = pane.querySelector('.win-btn-max');
      if (maxBtn) {
        maxBtn.textContent = isMax ? '🗗' : '⛶';
        maxBtn.title = isMax ? 'Restore Split View' : 'Full Window / Maximize';
      }

      // Visibility state
      if (isActive && !isMin) {
        pane.classList.remove('minimized');
        pane.style.display = 'flex';
        visibleCount++;
      } else if (isActive && isMin) {
        pane.classList.add('minimized');
        pane.style.display = 'none';
      } else {
        pane.classList.remove('minimized');
        pane.style.display = 'none';
      }
    });

    const activePill = document.getElementById('workspace-active-count-pill');
    if (activePill) {
      activePill.textContent = `${visibleCount} of ${this.activeStudioTools.length} Windows Visible`;
    }

    this.renderMinimizedTray();
  }

  renderMinimizedTray() {
    const tray = document.getElementById('minimized-windows-tray');
    if (!tray) return;

    tray.innerHTML = '';
    if (this.minimizedTools.size === 0) {
      tray.classList.remove('visible');
      return;
    }

    tray.classList.add('visible');
    const label = document.createElement('span');
    label.className = 'minimized-tray-label';
    label.textContent = 'Minimized:';
    tray.appendChild(label);

    this.minimizedTools.forEach(tool => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'minimized-tool-pill';
      pill.innerHTML = `<span>🪟</span> <span>${this.getToolDisplayName(tool)}</span> <span class="restore-hint">Restore ↗</span>`;
      pill.title = `Click to restore ${this.getToolDisplayName(tool)}`;
      pill.addEventListener('click', () => {
        this.restoreToolPane(tool);
      });
      tray.appendChild(pill);
    });
  }

  getToolDisplayName(tool) {
    const names = {
      docs: 'Docs',
      sheets: 'Sheets',
      mail: 'Mail',
      slides: 'Slides',
      knownext: 'KnowNext',
      host: 'Host',
      meet: 'Meeting',
      drive: 'Drive',
      calendar: 'Calendar',
      plugins: 'Plugins'
    };
    return names[tool] || tool.toUpperCase();
  }

  renderSidebarOpenToolsTray() {
    const tray = document.getElementById('sidebar-open-tools-tray');
    if (!tray) return;

    tray.innerHTML = '';
    if (this.activeStudioTools.length === 0) {
      tray.style.display = 'none';
      return;
    }
    tray.style.display = 'flex';

    const toolIcons = {
      docs: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
      sheets: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
      mail: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
      slides: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
      knownext: `<span style="font-size:10px; font-weight:800; border:1px solid currentColor; border-radius:50%; width:16px; height:16px; display:inline-flex; align-items:center; justify-content:center;">KN</span>`,
      host: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
      meet: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
      drive: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
      calendar: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
      plugins: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 11.5L12.5 7"/><path d="M13 3.5l2.5-2.5"/><path d="M19.5 10l2.5-2.5"/><path d="M14 14l-1.5 1.5a4.24 4.24 0 0 1-6 0l-2-2a4.24 4.24 0 0 1 0-6L6 6"/><path d="M6.5 17.5L2 22"/><line x1="15" y1="18.5" x2="21" y2="18.5" stroke-width="2.5"/><line x1="18" y1="15.5" x2="18" y2="21.5" stroke-width="2.5"/></svg>`
    };

    const toolNames = {
      docs: 'Mira Docs',
      sheets: 'Sheets',
      mail: 'Mail',
      slides: 'Slides',
      knownext: 'Knownext',
      host: 'Host',
      meet: 'Meeting',
      drive: 'Drive',
      calendar: 'Calendar',
      plugins: 'Plugins & Add-ins'
    };

    this.activeStudioTools.forEach(tool => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'open-tool-dock-btn';
      btn.dataset.tooltip = `${toolNames[tool] || tool} (Live Window)`;
      btn.setAttribute('aria-label', toolNames[tool] || tool);
      btn.innerHTML = toolIcons[tool] || '🪟';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.switchView('workspace');
        if (this.minimizedTools.has(tool)) {
          this.restoreToolPane(tool);
        } else {
          this.focusToolPane(tool);
        }
      });
      tray.appendChild(btn);
    });
  }

  updateSessionStats() {
    const remainingTasks = this.tasks.filter(t => !t.done).length;

    // Focus Time
    const focusVal = document.getElementById('session-stat-focus');
    const timerText = document.getElementById('workspace-focus-timer-text');
    if (focusVal) focusVal.textContent = `${this.focusMinutes}m`;
    if (timerText) timerText.textContent = `Focus: ${this.focusMinutes}m`;

    // Tools Used
    const toolsCount = document.getElementById('session-stat-tools-count');
    const toolsList = document.getElementById('session-stat-tools-list');
    if (toolsCount) {
      toolsCount.textContent = `${this.sessionWorkDone.size} apps`;
    }
    if (toolsList) {
      const names = Array.from(this.sessionWorkDone).map(t => this.getToolDisplayName(t));
      toolsList.textContent = names.join(' · ') || 'Docs · Sheets · Mail';
    }

    // Remaining Tasks
    const tasksVal = document.getElementById('session-stat-tasks');
    if (tasksVal) {
      tasksVal.textContent = `${remainingTasks} task${remainingTasks === 1 ? '' : 's'}`;
    }
  }

  // ── FOCUS SESSIONS ENGINE (Windows 11 Clock Inspired) ──
  initFocusTimer() {
    this.updateFocusDisplay();
  }

  selectFocusDuration(minutes) {
    if (this.focusIsRunning) {
      if (!confirm(`A focus session is currently running. Switch to ${minutes} mins?`)) {
        return;
      }
      this.pauseFocusTimer();
    }
    this.focusDurationMinutes = minutes;
    this.focusRemainingSeconds = minutes * 60;

    // Highlight active preset chip
    document.querySelectorAll('.focus-preset-chip').forEach(chip => {
      if (parseInt(chip.dataset.focusMins, 10) === minutes) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });

    const stepperLabel = document.getElementById('focus-stepper-label');
    if (stepperLabel) stepperLabel.textContent = `${minutes} minutes`;

    this.updateFocusDisplay();
    this.triggerSavedNotification(`Focus duration set to ${minutes} mins`);
  }

  adjustFocusDuration(delta) {
    const next = Math.max(5, Math.min(180, this.focusDurationMinutes + delta));
    this.selectFocusDuration(next);
  }

  toggleFocusTimer() {
    if (this.focusIsRunning) {
      this.pauseFocusTimer();
    } else {
      this.startFocusTimer();
    }
  }

  startFocusTimer() {
    if (this.focusIsRunning) return;
    this.focusIsRunning = true;

    const toggleBtn = document.getElementById('btn-focus-toggle');
    const iconSpan = document.getElementById('btn-focus-icon');
    const labelSpan = document.getElementById('btn-focus-label');
    const statusText = document.getElementById('focus-timer-status');

    if (toggleBtn) toggleBtn.classList.add('running');
    if (iconSpan) iconSpan.textContent = '⏸';
    if (labelSpan) labelSpan.textContent = 'Pause session';
    if (statusText) statusText.textContent = 'Focusing... Stay in flow';

    this.focusTimerInterval = setInterval(() => {
      if (this.focusRemainingSeconds > 0) {
        this.focusRemainingSeconds--;
        this.focusMinutes = Math.max(1, Math.round(this.focusRemainingSeconds / 60));
        this.updateFocusDisplay();
        this.updateSessionStats();
      } else {
        this.onFocusSessionComplete();
      }
    }, 1000);

    this.triggerSavedNotification('Focus session started');
  }

  pauseFocusTimer() {
    if (!this.focusIsRunning) return;
    this.focusIsRunning = false;
    clearInterval(this.focusTimerInterval);
    this.focusTimerInterval = null;

    const toggleBtn = document.getElementById('btn-focus-toggle');
    const iconSpan = document.getElementById('btn-focus-icon');
    const labelSpan = document.getElementById('btn-focus-label');
    const statusText = document.getElementById('focus-timer-status');

    if (toggleBtn) toggleBtn.classList.remove('running');
    if (iconSpan) iconSpan.textContent = '▶';
    if (labelSpan) labelSpan.textContent = 'Resume session';
    if (statusText) statusText.textContent = 'Session paused';

    this.triggerSavedNotification('Focus session paused');
  }

  resetFocusTimer() {
    this.pauseFocusTimer();
    this.focusRemainingSeconds = this.focusDurationMinutes * 60;

    const labelSpan = document.getElementById('btn-focus-label');
    const statusText = document.getElementById('focus-timer-status');
    if (labelSpan) labelSpan.textContent = 'Start focus session';
    if (statusText) statusText.textContent = 'Ready to focus';

    this.updateFocusDisplay();
    this.triggerSavedNotification('Focus timer reset');
  }

  updateFocusDisplay() {
    const mins = Math.floor(this.focusRemainingSeconds / 60);
    const secs = this.focusRemainingSeconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const digits = document.getElementById('focus-timer-digits');
    if (digits) digits.textContent = formatted;

    // SVG Circular Progress (circumference 2 * PI * 100 = ~628.318)
    const totalSecs = Math.max(1, this.focusDurationMinutes * 60);
    const fraction = (totalSecs - this.focusRemainingSeconds) / totalSecs;
    const circle = document.getElementById('focus-dial-fill-circle');
    if (circle) {
      const circ = 2 * Math.PI * 100;
      const offset = circ * (1 - fraction);
      circle.style.strokeDashoffset = offset;
    }

    // Top bar badge
    const badgeText = document.getElementById('workspace-focus-timer-text');
    if (badgeText) {
      badgeText.textContent = `Focus: ${formatted}`;
    }
  }

  onFocusSessionComplete() {
    this.pauseFocusTimer();
    this.playFocusChime();

    this.focusDailyCompleted++;
    const totalMins = this.focusDailyCompleted * 25;
    const countText = document.getElementById('focus-target-count-text');
    const minsText = document.getElementById('focus-target-mins-text');
    const fillBar = document.getElementById('focus-target-bar-fill');
    const statusText = document.getElementById('focus-timer-status');

    if (countText) countText.textContent = `${this.focusDailyCompleted} of ${this.focusDailyTarget} sessions completed`;
    if (minsText) minsText.textContent = `${totalMins}m / 100m`;
    if (fillBar) fillBar.style.width = `${Math.min(100, (this.focusDailyCompleted / this.focusDailyTarget) * 100)}%`;
    if (statusText) statusText.textContent = '🎉 Well done! Focus session finished.';

    // If a task was linked and auto-complete enabled, mark it done
    const check = document.getElementById('focus-task-checkbox');
    if (check && check.checked && this.focusLinkedTaskId) {
      this.toggleTask(this.focusLinkedTaskId);
      this.triggerSavedNotification('Linked task marked complete!');
    }

    this.triggerSavedNotification('Focus session complete! 🎉 Great work.');
  }

  playFocusChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const now = ctx.currentTime;
      // Note 1: E5
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.5);

      // Note 2: B5 (higher melodic chime)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.frequency.setValueAtTime(987.77, now + 0.2);
      gain2.gain.setValueAtTime(0.35, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.2);
      osc2.stop(now + 0.9);
    } catch (e) {
      console.log('Audio chime not permitted without user gesture', e);
    }
  }

  populateFocusTasks() {
    const select = document.getElementById('focus-task-select');
    if (!select) return;

    select.innerHTML = '<option value="">Select a task from your plan...</option>';
    this.tasks.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.done ? '✓ ' : '○ '}${t.title}`;
      if (this.focusLinkedTaskId === t.id) opt.selected = true;
      select.appendChild(opt);
    });
  }

  onFocusTaskChanged(taskId) {
    this.focusLinkedTaskId = taskId || null;
    const label = document.getElementById('focus-task-checkbox-label');
    if (label) {
      label.style.display = taskId ? 'inline-flex' : 'none';
    }
    if (taskId) {
      const task = this.tasks.find(t => t.id === taskId);
      if (task) this.triggerSavedNotification(`Focus linked to "${task.title}"`);
    }
  }

  completeLinkedFocusTask(checked) {
    if (checked && this.focusLinkedTaskId) {
      this.triggerSavedNotification('Task will be marked complete when session finishes');
    }
  }

  setAmbientAudio(btn, name) {
    this.focusAmbientAudio = name;
    btn.parentElement.querySelectorAll('.focus-audio-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    this.triggerSavedNotification(`Ambient audio: ${name}`);
  }

  toggleSheetTableView() {
    const table = document.getElementById('sheets-full-table-container');
    if (table) {
      table.style.display = table.style.display === 'none' ? 'block' : 'none';
    }
  }

  // ── 5. KNOWNEXT COMMUNITY INTERACTIONS (Image 4) ──
  bindKnowNextInteractions() {
    // Ask a doubt modal
    document.querySelectorAll('[data-open-ask-doubt]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.openModal('modal-ask-doubt');
      });
    });

    const formDoubt = document.getElementById('form-ask-doubt');
    if (formDoubt) {
      formDoubt.addEventListener('submit', (e) => {
        e.preventDefault();
        const subject = document.getElementById('doubt-subject')?.value || 'General';
        const text = document.getElementById('doubt-text')?.value;
        if (!text) return;

        this.closeModal('modal-ask-doubt');
        this.triggerSavedNotification(`Anonymous question posted in #${subject}`);
        formDoubt.reset();

        // Also notify Mira AI companion
        setTimeout(() => {
          if (window.miraAi) {
            window.miraAi.addBotMessage(`🔒 **KnowNext Notice:** Your doubt in **${subject}** was successfully broadcasted anonymously under **${this.userRollNo}**. Faculty and peer tutors have been notified!`);
          }
        }, 1000);
      });
    }

    // Tutor connect modal
    document.getElementById('card-kn-tutor')?.addEventListener('click', () => {
      this.openModal('modal-kn-tutors');
    });

    // Study together modal
    document.getElementById('card-kn-study')?.addEventListener('click', () => {
      this.openModal('modal-kn-study');
    });

    // Video lectures modal
    document.getElementById('card-kn-videos')?.addEventListener('click', () => {
      this.openModal('modal-kn-videos');
    });

    // Live classes modal
    document.getElementById('card-kn-classes')?.addEventListener('click', () => {
      this.openModal('modal-kn-live');
    });

    // Join upcoming session button
    document.getElementById('btn-join-upcoming-session')?.addEventListener('click', () => {
      this.openModal('modal-live-room');
    });
  }

  // ── 6. MODAL & SPOTLIGHT CONTROLS ──
  bindModals() {
    // Generic modal close
    document.querySelectorAll('.modal-close-btn, [data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const overlay = btn.closest('.mira-modal-overlay');
        if (overlay) overlay.classList.remove('open');
      });
    });

    // Click outside dialog to close
    document.querySelectorAll('.mira-modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('open');
        }
      });
    });

  }

  // ── DOCK FLYOUT PANELS: NOTIFICATIONS & SEARCH (Reference Images 1 & 2) ──
  bindDockFlyoutPanels() {
    const searchBtn = document.getElementById('dock-btn-search');
    const notifBtn = document.getElementById('dock-btn-notif');

    searchBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDockPanel('search');
    });

    notifBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleDockPanel('notifications');
    });

    // Close flyout panels when clicking outside on the workspace
    document.addEventListener('click', (e) => {
      const searchPanel = document.getElementById('panel-dock-search');
      const notifPanel = document.getElementById('panel-dock-notifications');

      if (
        searchPanel?.classList.contains('open') &&
        !searchPanel.contains(e.target) &&
        !searchBtn?.contains(e.target)
      ) {
        this.closeDockPanels();
      }

      if (
        notifPanel?.classList.contains('open') &&
        !notifPanel.contains(e.target) &&
        !notifBtn?.contains(e.target)
      ) {
        this.closeDockPanels();
      }
    });

    // Keyboard support inside search input
    const input = document.getElementById('dock-search-input-field');
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeDockPanels();
      }
    });
  }

  toggleDockPanel(type) {
    const searchPanel = document.getElementById('panel-dock-search');
    const notifPanel = document.getElementById('panel-dock-notifications');
    const searchBtn = document.getElementById('dock-btn-search');
    const notifBtn = document.getElementById('dock-btn-notif');

    if (type === 'search') {
      const isAlreadyOpen = searchPanel?.classList.contains('open');
      this.closeDockPanels();
      if (!isAlreadyOpen && searchPanel) {
        searchPanel.classList.add('open');
        searchBtn?.classList.add('active');
        this.currentSearchCategory = 'all';
        this.renderSearchResults('');
        setTimeout(() => document.getElementById('dock-search-input-field')?.focus(), 120);
      }
    } else if (type === 'notifications') {
      const isAlreadyOpen = notifPanel?.classList.contains('open');
      this.closeDockPanels();
      if (!isAlreadyOpen && notifPanel) {
        notifPanel.classList.add('open');
        notifBtn?.classList.add('active');
      }
    }
  }

  closeDockPanels() {
    document.getElementById('panel-dock-search')?.classList.remove('open');
    document.getElementById('panel-dock-notifications')?.classList.remove('open');
    document.getElementById('dock-btn-search')?.classList.remove('active');
    document.getElementById('dock-btn-notif')?.classList.remove('active');
  }

  handleDockSearch(query) {
    this.renderSearchResults(query);
  }

  clearDockSearch() {
    const input = document.getElementById('dock-search-input-field');
    if (input && input.value.trim().length > 0) {
      input.value = '';
      this.renderSearchResults('');
      input.focus();
    } else {
      this.closeDockPanels();
    }
  }

  setSearchCategory(cat, btn) {
    this.currentSearchCategory = cat;
    btn?.parentElement?.querySelectorAll('.dock-chip-btn').forEach(c => c.classList.remove('active'));
    btn?.classList.add('active');
    const query = document.getElementById('dock-search-input-field')?.value || '';
    this.renderSearchResults(query);
  }

  renderSearchResults(rawQuery) {
    const container = document.getElementById('dock-search-results-list');
    if (!container) return;

    const q = (rawQuery || '').trim().toLowerCase();
    const cat = this.currentSearchCategory || 'all';

    const items = [
      { id: 'docs', cat: 'tools', type: 'tool', icon: '📄', title: 'Mira Docs', sub: 'Rich text workspace editor & launch briefs', action: () => { this.addToolToSplitWorkspace('docs'); this.closeDockPanels(); } },
      { id: 'sheets', cat: 'tools', type: 'tool', icon: '📊', title: 'Sheets Studio', sub: 'Tabular computation & student attendance', action: () => { this.addToolToSplitWorkspace('sheets'); this.closeDockPanels(); } },
      { id: 'slides', cat: 'tools', type: 'tool', icon: '📽️', title: 'Slides Presentations', sub: 'Lecture decks and project presentations', action: () => { this.addToolToSplitWorkspace('slides'); this.closeDockPanels(); } },
      { id: 'plugins', cat: 'tools', type: 'tool', icon: '🔌', title: 'Plugins & Add-ins', sub: 'Notion Sync, GitHub, Google Drive integrations', action: () => { this.addToolToSplitWorkspace('plugins'); this.closeDockPanels(); } },
      { id: 'calendar', cat: 'tools', type: 'tool', icon: '📅', title: 'Calendar Schedule', sub: 'Weekly sprints and live milestones', action: () => { this.addToolToSplitWorkspace('calendar'); this.closeDockPanels(); } },
      { id: 'mail', cat: 'tools', type: 'tool', icon: '✉️', title: 'Mail & Distribute', sub: 'Feedback handoffs and student notes', action: () => { this.addToolToSplitWorkspace('mail'); this.closeDockPanels(); } },
      { id: 'meet', cat: 'tools', type: 'tool', icon: '🎥', title: 'Meet Video Calls', sub: 'Encrypted group calls & study pods', action: () => { this.addToolToSplitWorkspace('meet'); this.closeDockPanels(); } },
      { id: 'drive', cat: 'tools', type: 'tool', icon: '📁', title: 'Drive Files', sub: 'Product briefs, PDFs, and spreadsheets', action: () => { this.addToolToSplitWorkspace('drive'); this.closeDockPanels(); } },
      { id: 'knownext', cat: 'community', type: 'community', icon: '🔒', title: 'KnowNext Student Space', sub: 'Anonymous peer doubts and tutor matching', action: () => { this.addToolToSplitWorkspace('knownext'); this.closeDockPanels(); } },
      { id: 'focus', cat: 'tools', type: 'tool', icon: '⏱️', title: 'Focus Sessions Timer', sub: 'Windows Clock-style distraction-free timer', action: () => { this.switchView('focus'); this.closeDockPanels(); } },
      { id: 'tasks', cat: 'tasks', type: 'task', icon: '📋', title: 'Plan your day', sub: 'Notion & Google Tasks checklist', action: () => { this.switchView('tasks'); this.closeDockPanels(); } },
      { id: 'doc1', cat: 'docs', type: 'doc', icon: '📑', title: 'Launch brief document', sub: 'Product strategy & priorities in Docs', action: () => { this.addToolToSplitWorkspace('docs'); this.closeDockPanels(); } }
    ];

    // Filter
    const filtered = items.filter(it => {
      if (cat !== 'all' && it.cat !== cat) return false;
      if (!q) return true;
      return it.title.toLowerCase().includes(q) || it.sub.toLowerCase().includes(q);
    });

    container.innerHTML = '';
    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:1.5rem; color:#94a3b8; font-size:12px;">No results found for "${this.escapeHtml(q)}". Try searching "Docs", "Sheets", or "Tasks".</div>`;
      return;
    }

    filtered.forEach(it => {
      const card = document.createElement('div');
      card.className = 'search-result-item';
      card.innerHTML = `
        <div class="search-result-icon">${it.icon}</div>
        <div class="search-result-text">
          <div class="search-result-title">${this.escapeHtml(it.title)}</div>
          <div class="search-result-sub">${this.escapeHtml(it.sub)}</div>
        </div>
        <span style="color:#64748b; font-size:11px;">&rarr;</span>
      `;
      card.addEventListener('click', () => it.action());
      container.appendChild(card);
    });
  }

  markAllNotificationsRead() {
    document.querySelectorAll('.notif-card-item').forEach(c => {
      c.classList.remove('unread');
      c.dataset.notifCat = 'read';
    });
    const chipUnread = document.getElementById('chip-notif-unread');
    if (chipUnread) chipUnread.textContent = 'Unread (0)';

    // Remove badge on dock bell icon
    document.querySelector('#dock-btn-notif .badge-dot-pink')?.remove();
    this.triggerSavedNotification('All notifications marked as read');
  }

  filterNotifications(tab) {
    document.querySelectorAll('.dock-flyout-filter-bar .dock-chip-btn').forEach(btn => btn.classList.remove('active'));
    const activeChip = document.getElementById(`chip-notif-${tab}`);
    if (activeChip) activeChip.classList.add('active');

    document.querySelectorAll('.notif-card-item').forEach(item => {
      const cat = item.dataset.notifCat || '';
      if (tab === 'all') {
        item.style.display = 'block';
      } else if (tab === 'unread') {
        item.style.display = cat.includes('unread') ? 'block' : 'none';
      } else if (tab === 'mentions') {
        item.style.display = cat.includes('mentions') ? 'block' : 'none';
      }
    });
  }

  handleNotificationClick(targetTool, el) {
    if (el) {
      el.classList.remove('unread');
      el.dataset.notifCat = 'read';
    }
    this.closeDockPanels();
    if (targetTool === 'knownext') {
      this.addToolToSplitWorkspace('knownext');
    } else if (['docs', 'sheets', 'mail', 'calendar', 'plugins'].includes(targetTool)) {
      this.addToolToSplitWorkspace(targetTool);
    } else {
      this.switchView('workspace');
    }
  }

  togglePluginStatus(btn, name) {
    if (btn.classList.contains('active')) {
      btn.classList.remove('active');
      btn.textContent = 'Connect';
      this.triggerSavedNotification(`${name} disconnected`);
    } else {
      btn.classList.add('active');
      btn.textContent = 'Enabled';
      this.triggerSavedNotification(`${name} connected & active!`);
    }
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('open');
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('open');
    }
  }

  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+K / Cmd+K for Universal Spotlight Search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.openUniversalSearch();
      }
      // Ctrl+B for Sidebar toggle
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        this.toggleSidebar();
      }
      // Alt+M for Mira AI Assistant
      if (e.altKey && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        window.miraAi?.toggleSidebar();
      }
      // Escape closes any open modal, account menu or dock panel
      if (e.key === 'Escape') {
        document.querySelectorAll('.mira-modal-overlay.open').forEach(m => m.classList.remove('open'));
        this.closeAccountMenu();
        this.closeDockPanels();
      }
    });
  }

  handleHomeMiraPrompt(promptText) {
    if (window.openMiraWith) {
      window.openMiraWith(promptText);
    }
  }

  submitHomeMiraQuery(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('home-mira-input');
    const query = input?.value.trim();
    if (!query) return;
    if (window.openMiraWith) {
      window.openMiraWith(query);
    }
  }

  executeHomeMiraQuery(query) {
    const respBox = document.getElementById('home-mira-inline-response');
    if (!respBox) return;

    respBox.classList.add('visible');
    respBox.innerHTML = `<span style="color:#a855f7; font-weight:700;">✨ Mira is thinking...</span>`;

    setTimeout(() => {
      let reply = `Here are actionable next steps for <strong>${this.escapeHtml(query)}</strong>:<br/>• Review pending tasks in Work OS.<br/>• Sync attachments with student notes in Docs.<br/>• All changes are saved automatically across your team.`;
      const lower = query.toLowerCase();
      if (lower.includes('plan') || lower.includes('schedule')) {
        reply = `📋 <strong>Recommended Plan for Today:</strong><br/>• <strong>Morning:</strong> Review &amp; mark attendance in Batch A.<br/>• <strong>1:30 PM:</strong> Deep focus work sprint on roadmap deliverables.<br/>• <strong>6:30 PM:</strong> Upcoming Physics Doubt Session on KnowNext.`;
      } else if (lower.includes('brainstorm') || lower.includes('idea')) {
        reply = `✨ <strong>Fresh Workspace Ideas:</strong><br/>1. <strong>Split Workspace Focus:</strong> Pin Docs and Sheets side-by-side to cross-reference data in real time.<br/>2. <strong>Peer Learning Circle:</strong> Invite your study group to a KnowNext pod room.<br/>3. <strong>Sprint Milestones:</strong> Track deliverables directly from the Tasks tab.`;
      } else if (lower.includes('doc') || lower.includes('summarize')) {
        reply = `📄 <strong>Docs Summary:</strong><br/>• <em>Launch brief:</em> Defines Mira workspace strategy to turn scattered context into a calm, connected day of work.<br/>• 4 team members have reviewed the document.`;
      }
      respBox.innerHTML = `<div>${reply}</div>`;
      this.triggerSavedNotification('Answered by Mira AI');
    }, 450);
  }

  clearHomeMiraQuery() {
    const input = document.getElementById('home-mira-input');
    const respBox = document.getElementById('home-mira-inline-response');
    if (input) input.value = '';
    if (respBox) {
      respBox.classList.remove('visible');
      respBox.innerHTML = '';
    }
  }

  escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ── COLLAPSIBLE SIDEBAR DOCK (Expanded & Collapsed) ──
  initSidebarCollapse() {
    const saved = localStorage.getItem('mira_sidebar_expanded');
    const sidebar = document.getElementById('sidebar-dock');
    if (saved === 'true' && sidebar) {
      sidebar.classList.add('expanded');
    }
  }

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar-dock');
    if (!sidebar) return;
    const isExpanded = sidebar.classList.toggle('expanded');
    localStorage.setItem('mira_sidebar_expanded', isExpanded ? 'true' : 'false');
    this.triggerSavedNotification(isExpanded ? 'Sidebar expanded' : 'Sidebar collapsed');
  }

  // ── GLOBAL TOPBAR & ACCOUNT MENU ──
  initGlobalTopBar() {
    document.addEventListener('click', (e) => {
      const popover = document.getElementById('account-menu-popover');
      const avatarBtn = document.getElementById('sidebar-avatar-btn') || document.getElementById('topbar-avatar-btn');
      if (popover && popover.classList.contains('open') && !popover.contains(e.target) && (!avatarBtn || !avatarBtn.contains(e.target))) {
        popover.classList.remove('open');
      }
    });
  }

  toggleAccountMenu() {
    const popover = document.getElementById('account-menu-popover');
    if (popover) {
      popover.classList.toggle('open');
    }
  }

  closeAccountMenu() {
    const popover = document.getElementById('account-menu-popover');
    if (popover) {
      popover.classList.remove('open');
    }
  }

  async handleSignOut() {
    try {
      await supabase.auth.signOut();
      this.triggerSavedNotification('Signed out of Mira Workspace');
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 400);
    } catch (err) {
      console.warn('Sign out:', err);
      window.location.href = '/index.html';
    }
  }

  async initAuthAndProfile() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        this.currentUser = session.user;
        const meta = session.user.user_metadata || {};
        const name = meta.full_name || session.user.email?.split('@')[0] || 'Prince';
        const initial = name.charAt(0).toUpperCase();

        const greetingHeadline = document.getElementById('home-greeting-headline');
        if (greetingHeadline) greetingHeadline.textContent = `Good morning, ${name}!`;

        const avatarLetter = document.getElementById('user-avatar-letter');
        if (avatarLetter) avatarLetter.textContent = initial;
        const menuAvatar = document.getElementById('menu-avatar-letter');
        if (menuAvatar) menuAvatar.textContent = initial;

        const menuName = document.getElementById('menu-user-name');
        if (menuName) menuName.textContent = name;
        const menuEmail = document.getElementById('menu-user-email');
        if (menuEmail) menuEmail.textContent = session.user.email || 'prince@knownext.in';
        const sidebarAvatarName = document.getElementById('sidebar-avatar-name');
        if (sidebarAvatarName) sidebarAvatarName.textContent = name;
      }
    } catch (err) {
      console.warn('Auth session check offline:', err);
    }
  }

  initSyncStatus() {
    const updateSync = () => {
      const isOnline = navigator.onLine;
      const syncTextTop = document.getElementById('sync-status-label-top');
      if (syncTextTop) syncTextTop.textContent = isOnline ? 'All synced' : 'Offline';
    };
    window.addEventListener('online', updateSync);
    window.addEventListener('offline', updateSync);
    updateSync();
  }

  // ── UNIVERSAL SPOTLIGHT SEARCH (Ctrl+K) ──
  initUniversalSearch() {
    this.searchFilter = 'all';
    this.searchIndex = [
      { type: 'tools', name: 'Mira Drive', sub: 'Cloud file management & storage', action: () => this.addToolToSplitWorkspace('drive'), icon: '📁', color: '#06b6d4' },
      { type: 'tools', name: 'Mira Docs', sub: 'Collaborative real-time document editor', action: () => this.addToolToSplitWorkspace('docs'), icon: '📄', color: '#60a5fa' },
      { type: 'tools', name: 'Present / Slides', sub: 'Slide deck and lecture presentation', action: () => this.addToolToSplitWorkspace('slides'), icon: '📽️', color: '#fb923c' },
      { type: 'tools', name: 'Sheets Studio', sub: 'Tabular computation and attendance analytics', action: () => this.addToolToSplitWorkspace('sheets'), icon: '📊', color: '#34d399' },
      { type: 'tools', name: 'Plan your day', sub: 'Daily focus schedule and task checklist', action: () => this.switchView('tasks'), icon: '✅', color: '#10b981' },
      { type: 'tools', name: 'Focus Sessions', sub: 'Windows 11-style Pomodoro timer', action: () => this.switchView('focus'), icon: '⏱️', color: '#eab308' },
      { type: 'tools', name: 'KnowNext Community', sub: 'Anonymous doubt forum & peer tutoring', action: () => this.addToolToSplitWorkspace('knownext'), icon: '🔒', color: '#a855f7' },
      { type: 'tools', name: 'Mira AI Copilot', sub: 'Intelligent assistant for planning and summarizing', action: () => window.miraAi?.toggleSidebar(), icon: '✨', color: '#c084fc' },
      { type: 'docs', name: 'Launch brief — Product strategy', sub: 'Docs · Edited 12 min ago', action: () => this.openRecentDoc('Launch brief'), icon: '📄', color: '#60a5fa' },
      { type: 'docs', name: 'Fluid_Mechanics_Lecture_04.pdf', sub: 'PDF Notes · 3.4 MB · Yesterday', action: () => this.openRecentDoc('Fluid Mechanics'), icon: '📑', color: '#ef4444' },
      { type: 'docs', name: 'Linear_Algebra_Assignment_2.pdf', sub: 'Assignment · 1.2 MB · 2d ago', action: () => this.openRecentDoc('Linear Algebra'), icon: '📝', color: '#f59e0b' },
      { type: 'docs', name: 'Batch A Attendance Summary.xlsx', sub: 'Sheets · 32/38 students present · 3d ago', action: () => this.openRecentDoc('Attendance'), icon: '📊', color: '#10b981' },
      { type: 'tasks', name: 'Review product roadmap & sprint board', sub: 'High priority · Academic task', action: () => this.switchView('tasks'), icon: '📌', color: '#ef4444' },
      { type: 'tasks', name: 'Upload lecture notes and PDF handouts', sub: 'Medium priority · Docs task', action: () => this.switchView('tasks'), icon: '📌', color: '#f59e0b' },
      { type: 'tasks', name: 'Prepare live faculty sync presentation', sub: 'Low priority · Meet task', action: () => this.switchView('tasks'), icon: '📌', color: '#10b981' },
      { type: 'tasks', name: 'Answer student doubts on KnowNext forum', sub: 'Medium priority · KnowNext task', action: () => this.switchView('tasks'), icon: '📌', color: '#a855f7' },
      { type: 'community', name: 'TCP vs UDP handshake differences', sub: 'KnowNext Doubt · 1 reply', action: () => this.addToolToSplitWorkspace('knownext'), icon: '❓', color: '#a855f7' },
      { type: 'community', name: 'Op-Amp differential amplifier CMRR derivation', sub: 'KnowNext Doubt · 2 replies', action: () => this.addToolToSplitWorkspace('knownext'), icon: '❓', color: '#a855f7' }
    ];
  }

  openUniversalSearch() {
    const modal = document.getElementById('modal-universal-search');
    if (modal) {
      modal.classList.add('open');
      const input = document.getElementById('universal-search-dialog-input');
      if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 80);
      }
      this.renderUniversalSearchResults('');
    }
  }

  closeUniversalSearch() {
    const modal = document.getElementById('modal-universal-search');
    if (modal) modal.classList.remove('open');
  }

  handleUniversalSearchInput(val) {
    this.renderUniversalSearchResults(val);
  }

  filterUniversalSearchCategory(cat, btn) {
    this.searchFilter = cat;
    document.querySelectorAll('[data-search-filter]').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const input = document.getElementById('universal-search-dialog-input');
    this.renderUniversalSearchResults(input ? input.value : '');
  }

  renderUniversalSearchResults(query) {
    const viewport = document.getElementById('universal-search-results-viewport');
    if (!viewport) return;
    const q = (query || '').toLowerCase().trim();

    let filtered = this.searchIndex;
    if (this.searchFilter !== 'all') {
      filtered = filtered.filter(item => item.type === this.searchFilter);
    }
    if (q) {
      filtered = filtered.filter(item => item.name.toLowerCase().includes(q) || item.sub.toLowerCase().includes(q));
    }

    if (filtered.length === 0) {
      viewport.innerHTML = `
        <div style="text-align:center; padding: 2.5rem 1rem; color: var(--text-muted);">
          <div style="font-size: 28px; margin-bottom: 8px;">🔍</div>
          <div style="font-size: 14px; font-weight: 600; color: #ffffff;">No matching resources found</div>
          <div style="font-size: 12px; margin-top: 4px;">Try searching for "docs", "sheets", "roadmap", or ask Mira AI.</div>
          <button type="button" class="btn-hero-primary" style="margin-top: 14px; font-size: 12px; padding: 6px 14px;" onclick="window.miraApp.closeUniversalSearch(); window.openMiraWith('${this.escapeHtml(q)}');">Ask Mira AI Copilot</button>
        </div>`;
      return;
    }

    let html = '';
    filtered.forEach((item, index) => {
      html += `
        <div class="search-result-item" onclick="window.miraApp.executeSearchResult(${index})" tabindex="0">
          <div class="search-result-item-left">
            <div class="search-result-icon" style="background: rgba(255,255,255,0.06); color: ${item.color};">
              ${item.icon}
            </div>
            <div>
              <div class="search-result-name">${this.escapeHtml(item.name)}</div>
              <div class="search-result-sub">${this.escapeHtml(item.sub)}</div>
            </div>
          </div>
          <span style="font-size: 12px; color: var(--text-muted);">&rarr;</span>
        </div>`;
    });

    viewport.innerHTML = html;
  }

  executeSearchResult(index) {
    let filtered = this.searchIndex;
    if (this.searchFilter !== 'all') {
      filtered = filtered.filter(item => item.type === this.searchFilter);
    }
    const input = document.getElementById('universal-search-dialog-input');
    const q = (input?.value || '').toLowerCase().trim();
    if (q) {
      filtered = filtered.filter(item => item.name.toLowerCase().includes(q) || item.sub.toLowerCase().includes(q));
    }
    const item = filtered[index];
    if (item && item.action) {
      this.closeUniversalSearch();
      item.action();
    }
  }

  openSettings() {
    this.openModal('modal-settings');
  }

  createNewDocument() {
    this.addToolToSplitWorkspace('docs');
    this.triggerSavedNotification('Created new document: Untitled brief');
  }

  uploadFileDialog() {
    this.addToolToSplitWorkspace('drive');
    this.triggerSavedNotification('Opened Mira Drive for file upload');
  }

  openNewProjectModal() {
    this.openModal('modal-add-task');
  }

  openRecentDoc(name) {
    if (name.includes('Attendance')) {
      this.addToolToSplitWorkspace('sheets');
    } else {
      this.addToolToSplitWorkspace('docs');
    }
    this.triggerSavedNotification(`Opened ${name}`);
  }
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
  window.miraApp = new MiraApp();
});
