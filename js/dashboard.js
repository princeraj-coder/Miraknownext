// ─────────────────────────────────────────────────────────────────────────────
//  js/dashboard.js — Interactive Workspace & Community Controller
//  Seamless animated switching between Mira & KnowNext
//  Roll-number anonymous questions, real-time live feed, attendance & PDF tools
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase.js'

// Mock state if database tables are in setup phase
const state = {
  currentWorkspace: 'mira', // 'mira' | 'knownext'
  currentUser: null,
  activeTag: 'all',
  questions: [
    {
      id: 1,
      rollId: 'Roll #23-CS-042',
      timeAgo: '15 mins ago',
      content: 'Can someone explain the difference between TCP and UDP handshakes? In what scenario would packet loss in UDP break the entire connection state?',
      tags: ['Computer Networks', 'CS Core'],
      replies: [
        {
          author: 'Teacher / Mod',
          isTeacher: true,
          text: 'Great question. TCP relies on a 3-way SYN-ACK handshake to guarantee order and delivery. UDP is connectionless without ACKs; application-level sequencing must handle losses if critical.'
        }
      ]
    },
    {
      id: 2,
      rollId: 'Roll #24-EC-109',
      timeAgo: '1 hour ago',
      content: 'Need help with Op-Amp differential amplifier derivation. What happens when the input resistors are mismatched by 5%?',
      tags: ['Electronics', 'Assignments'],
      replies: [
        {
          author: 'Roll #23-EC-088',
          isTeacher: false,
          text: 'Mismatched resistors severely degrade the Common Mode Rejection Ratio (CMRR). Check page 142 of Sedra & Smith!'
        }
      ]
    }
  ],
  attendanceList: [
    { roll: 'Roll #01', name: 'Aarav Sharma', status: 'present' },
    { roll: 'Roll #02', name: 'Ananya Verma', status: 'present' },
    { roll: 'Roll #03', name: 'Devansh Patil', status: 'absent' },
    { roll: 'Roll #04', name: 'Ishita Nair', status: 'present' },
    { roll: 'Roll #05', name: 'Kabir Mehta', status: 'late' },
    { roll: 'Roll #06', name: 'Meera Iyer', status: 'present' },
    { roll: 'Roll #07', name: 'Rohan Gupta', status: 'present' }
  ],
  files: [
    { name: 'Fluid_Mechanics_Lecture_04.pdf', size: '3.4 MB', date: 'Today, 10:30 AM' },
    { name: 'Linear_Algebra_Assignment_2.pdf', size: '1.2 MB', date: 'Yesterday' },
    { name: 'Exam_Guidelines_Midterm_2026.pdf', size: '840 KB', date: '16 Oct' }
  ],
  meetings: [
    { title: 'Parent-Teacher Academic Review', time: 'Today · 3:00 PM', attendees: '14 joined' },
    { title: 'Project Demo Session — Batch B', time: 'Tomorrow · 11:30 AM', attendees: '8 scheduled' },
    { title: 'Faculty Department Sync', time: 'Friday · 4:00 PM', attendees: '6 scheduled' }
  ]
}

// ══════════════════════════════════════════════════════════════════════════════
//  INITIALIZE
// ══════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  // Check active session
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    state.currentUser = session.user
    updateUserBadge(session.user)
  }

  // Check URL query param for default view ?view=knownext or ?view=mira
  const urlParams = new URLSearchParams(window.location.search)
  const requestedView = urlParams.get('view')
  if (requestedView === 'knownext' || requestedView === 'mira') {
    switchWorkspace(requestedView)
  } else {
    // Check localStorage preference
    const saved = localStorage.getItem('mira_active_workspace') || 'mira'
    switchWorkspace(saved)
  }

  setupEventListeners()
  renderAttendance()
  renderQuestions()
  renderFiles()
  renderMeetings()
})

// ══════════════════════════════════════════════════════════════════════════════
//  WORKSPACE SWITCHER (MIRA <-> KNOWNEXT)
// ══════════════════════════════════════════════════════════════════════════════
export function switchWorkspace(target) {
  state.currentWorkspace = target
  document.body.setAttribute('data-workspace', target)
  localStorage.setItem('mira_active_workspace', target)

  const miraView = document.getElementById('view-mira')
  const knView = document.getElementById('view-knownext')

  if (target === 'mira') {
    knView?.classList.remove('active')
    setTimeout(() => {
      miraView?.classList.add('active')
    }, 50)
  } else {
    miraView?.classList.remove('active')
    setTimeout(() => {
      knView?.classList.add('active')
    }, 50)
  }

  // Update browser URL without reloading
  const url = new URL(window.location)
  url.searchParams.set('view', target)
  window.history.replaceState({}, '', url)
}

export function toggleWorkspace() {
  const next = state.currentWorkspace === 'mira' ? 'knownext' : 'mira'
  switchWorkspace(next)
}

// ══════════════════════════════════════════════════════════════════════════════
//  KNOWNEXT: ANONYMOUS QUESTIONS (ROLL-NUMBER WISE)
// ══════════════════════════════════════════════════════════════════════════════
function generateRollId() {
  // Generate a random student roll number format (e.g. Roll #24-CS-089)
  const depts = ['CS', 'EC', 'ME', 'CE', 'IT']
  const dept = depts[Math.floor(Math.random() * depts.length)]
  const num = String(Math.floor(Math.random() * 899) + 100)
  return `Roll #26-${dept}-${num}`
}

export function postQuestion() {
  const textarea = document.getElementById('new-question-input')
  const content = textarea?.value.trim()
  if (!content) {
    showToast('Please type your question or doubt first!', 'info')
    return
  }

  const activeTagChip = document.querySelector('.tag-chip.active')
  const tag = activeTagChip?.textContent.replace('#', '') || 'General'

  // Anonymize: strictly identify via roll number format
  const newPost = {
    id: Date.now(),
    rollId: generateRollId(),
    timeAgo: 'Just now (Live)',
    content,
    tags: [tag],
    replies: []
  }

  state.questions.unshift(newPost)
  if (textarea) textarea.value = ''
  renderQuestions()
  showToast('Question posted anonymously to KnowNext live feed! 🚀', 'success')
}

export function addReply(questionId) {
  const input = document.getElementById(`reply-input-${questionId}`)
  const text = input?.value.trim()
  if (!text) return

  const targetQ = state.questions.find(q => q.id === questionId)
  if (targetQ) {
    const isTeacher = state.currentUser?.user_metadata?.role === 'teacher'
    const authorName = isTeacher ? 'Teacher / Educator' : generateRollId()

    targetQ.replies.push({
      author: authorName,
      isTeacher,
      text
    })

    renderQuestions()
    showToast('Answer added to discussion!', 'success')
  }
}

function renderQuestions() {
  const container = document.getElementById('knownext-feed-container')
  if (!container) return

  const filtered = state.activeTag === 'all'
    ? state.questions
    : state.questions.filter(q => q.tags.some(t => t.toLowerCase().includes(state.activeTag.toLowerCase())))

  container.innerHTML = filtered.map(q => `
    <div class="question-card" id="q-card-${q.id}">
      <div class="question-top">
        <div class="roll-author-badge">
          <div class="roll-avatar">🎓</div>
          <div>
            <span class="roll-id-text">${q.rollId}</span>
            <span class="privacy-tag">🔒 Anonymous Student</span>
          </div>
        </div>
        <span class="post-time">${q.timeAgo}</span>
      </div>

      <div class="question-body">
        ${escapeHtml(q.content)}
      </div>

      <div class="question-tags-row">
        ${q.tags.map(t => `<span class="question-tag">#${t}</span>`).join('')}
      </div>

      <div class="answers-section">
        <div class="answers-list" id="answers-${q.id}">
          ${q.replies.map(r => `
            <div class="reply-item">
              <span class="reply-author-icon">${r.isTeacher ? '👨‍🏫' : '💬'}</span>
              <div class="reply-content">
                <div class="reply-meta">
                  <span class="reply-name">${r.author}</span>
                  ${r.isTeacher ? '<span class="badge-teacher">Teacher Verified</span>' : ''}
                </div>
                <div>${escapeHtml(r.text)}</div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="reply-box">
          <input
            type="text"
            id="reply-input-${q.id}"
            class="reply-input"
            placeholder="Write a helpful answer or solution..."
            onkeydown="if(event.key === 'Enter') addReply(${q.id})"
          />
          <button class="btn-reply-send" onclick="addReply(${q.id})">Reply</button>
        </div>
      </div>
    </div>
  `).join('')
}

// ══════════════════════════════════════════════════════════════════════════════
//  MIRA WORKSPACE: ATTENDANCE, PDFS, MEETINGS
// ══════════════════════════════════════════════════════════════════════════════
export function toggleStudentAttendance(index) {
  const item = state.attendanceList[index]
  if (!item) return

  const nextStatus = {
    present: 'absent',
    absent: 'late',
    late: 'present'
  }
  item.status = nextStatus[item.status]
  renderAttendance()
}

function renderAttendance() {
  const tbody = document.getElementById('attendance-tbody')
  const countEl = document.getElementById('present-count')
  if (!tbody) return

  const presentCount = state.attendanceList.filter(s => s.status === 'present').length
  if (countEl) countEl.textContent = `${presentCount} / ${state.attendanceList.length}`

  tbody.innerHTML = state.attendanceList.map((s, idx) => `
    <tr>
      <td><strong>${s.roll}</strong></td>
      <td>${s.name}</td>
      <td>
        <span class="attendance-pill ${s.status}" onclick="toggleStudentAttendance(${idx})">
          ${s.status.toUpperCase()}
        </span>
      </td>
    </tr>
  `).join('')
}

export function handlePdfUpload(files) {
  if (!files || files.length === 0) return
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    state.files.unshift({
      name: f.name,
      size: `${(f.size / (1024 * 1024)).toFixed(1)} MB`,
      date: 'Just now'
    })
  }
  renderFiles()
  showToast(`${files.length} document(s) uploaded and indexed!`, 'success')
}

function renderFiles() {
  const list = document.getElementById('file-list-container')
  if (!list) return

  list.innerHTML = state.files.map(f => `
    <div class="file-item">
      <div class="file-left">
        <span class="pdf-icon-badge">PDF</span>
        <div>
          <div class="file-name">${f.name}</div>
          <div class="file-sub">${f.size} · ${f.date}</div>
        </div>
      </div>
      <button class="btn-subtle" style="padding:4px 10px; font-size:0.75rem;" onclick="showToast('Opening document viewer...', 'info')">Open</button>
    </div>
  `).join('')
}

export function createInstantMeeting() {
  const title = prompt('Enter meeting title:', 'Live Study Group Session')
  if (!title) return

  state.meetings.unshift({
    title,
    time: 'Happening Now · Live',
    attendees: '1 host'
  })
  renderMeetings()
  showToast(`Meeting "${title}" created and live!`, 'success')
}

function renderMeetings() {
  const container = document.getElementById('meetings-list-container')
  if (!container) return

  container.innerHTML = state.meetings.map(m => `
    <div class="meeting-card-item">
      <div>
        <div class="meeting-time">${m.time}</div>
        <div class="meeting-title">${m.title}</div>
        <div class="meeting-meta">👥 ${m.attendees}</div>
      </div>
      <button class="btn-mira" style="padding:6px 12px; font-size:0.78rem;" onclick="showToast('Connecting to meeting room...', 'info')">Join</button>
    </div>
  `).join('')
}

// ══════════════════════════════════════════════════════════════════════════════
//  UI EVENT LISTENERS & HELPERS
// ══════════════════════════════════════════════════════════════════════════════
function setupEventListeners() {
  // Brand switcher clicks
  document.getElementById('badge-mira')?.addEventListener('click', () => switchWorkspace('mira'))
  document.getElementById('badge-knownext')?.addEventListener('click', () => switchWorkspace('knownext'))
  document.getElementById('workspace-toggle-btn')?.addEventListener('click', toggleWorkspace)

  // Tag chip filter in KnowNext
  document.querySelectorAll('.tag-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'))
      chip.classList.add('active')
      state.activeTag = chip.dataset.tag || 'all'
      renderQuestions()
    })
  })

  // PDF Dropzone drag & drop
  const dropzone = document.getElementById('upload-dropzone')
  const fileInput = document.getElementById('pdf-file-input')

  dropzone?.addEventListener('click', () => fileInput?.click())
  fileInput?.addEventListener('change', (e) => handlePdfUpload(e.target.files))

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault()
    dropzone.style.borderColor = 'var(--mira-primary)'
  })
  dropzone?.addEventListener('dragleave', () => {
    dropzone.style.borderColor = ''
  })
  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault()
    dropzone.style.borderColor = ''
    handlePdfUpload(e.dataTransfer.files)
  })

  // Sign out button in dashboard
  document.getElementById('btn-dashboard-signout')?.addEventListener('click', async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  })
}

function updateUserBadge(user) {
  const nameEl = document.getElementById('header-user-name')
  const avatarEl = document.getElementById('header-user-avatar')
  const name = user.user_metadata?.full_name || user.email || 'Student'
  if (nameEl) nameEl.textContent = name
  if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase()
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag))
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.textContent = message
  document.body.appendChild(toast)
  requestAnimationFrame(() => toast.classList.add('show'))
  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 350)
  }, 3500)
}

// Expose globals for inline events
window.switchWorkspace = switchWorkspace
window.toggleWorkspace = toggleWorkspace
window.postQuestion = postQuestion
window.addReply = addReply
window.toggleStudentAttendance = toggleStudentAttendance
window.createInstantMeeting = createInstantMeeting
