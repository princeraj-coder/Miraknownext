// ─────────────────────────────────────────────────────────────────────────────
//  js/auth.js  —  Auth handlers, modal UI & onboarding flow
//  Wires up Sign In / Sign Up / Onboarding / Session persistence
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase.js'

// ══════════════════════════════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════════════════════════════
let currentUser = null
let onboardingData = { role: null, goal: null, workspace: null }

// ══════════════════════════════════════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initModal()
  checkExistingSession()
  listenToAuthState()
})

// ══════════════════════════════════════════════════════════════════════════════
//  SESSION — check on load & listen for changes
// ══════════════════════════════════════════════════════════════════════════════
async function checkExistingSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) { console.error('Session check failed:', error.message); return }
  if (session?.user) {
    currentUser = session.user
    updateUIForLoggedIn(session.user)
  }
}

function listenToAuthState() {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('[Auth]', event)
    if (event === 'SIGNED_IN' && session?.user) {
      currentUser = session.user
      updateUIForLoggedIn(session.user)
    }
    if (event === 'SIGNED_OUT') {
      currentUser = null
      updateUIForLoggedOut()
    }
    if (event === 'PASSWORD_RECOVERY') {
      showToast('Check your email to reset your password.', 'info')
    }
  })
}

// ══════════════════════════════════════════════════════════════════════════════
//  MODAL — open / close / steps / tabs
// ══════════════════════════════════════════════════════════════════════════════
function initModal() {
  // All "Get Started" / CTA buttons open the modal
  document.querySelectorAll('[data-open-modal]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault()
      // If already logged in, do nothing special (button text changed to name)
      if (currentUser) return
      openModal(btn.dataset.openModal || 'signup')
    })
  })

  // Close on backdrop click
  const overlay = document.getElementById('auth-modal')
  overlay?.addEventListener('click', e => { if (e.target === overlay) closeModal() })

  // Close button
  document.getElementById('modal-close')?.addEventListener('click', closeModal)

  // Escape key
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal() })

  // Tab buttons (Sign In / Sign Up switcher)
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  })

  // Forms
  document.getElementById('form-signup')?.addEventListener('submit', handleSignUp)
  document.getElementById('form-signin')?.addEventListener('submit', handleSignIn)

  // Forgot password
  document.getElementById('link-forgot')?.addEventListener('click', handleForgotPassword)
}

export function openModal(tab = 'signup') {
  if (currentUser) return           // already signed in
  const modal = document.getElementById('auth-modal')
  if (!modal) return
  modal.classList.add('open')
  modal.setAttribute('aria-hidden', 'false')
  document.body.style.overflow = 'hidden'
  showStep('auth')
  switchTab(tab)
  // Focus first input after animation
  setTimeout(() => {
    const first = modal.querySelector(`#pane-${tab} input`)
    first?.focus()
  }, 320)
}

export function closeModal() {
  const modal = document.getElementById('auth-modal')
  if (!modal) return
  modal.classList.remove('open')
  modal.setAttribute('aria-hidden', 'true')
  document.body.style.overflow = ''
  // Reset state
  setTimeout(() => {
    document.getElementById('form-signup')?.reset()
    document.getElementById('form-signin')?.reset()
    clearAllErrors()
    resetOnboardingUI()
    onboardingData = { role: null, goal: null, workspace: null }
  }, 300)
}

function showStep(stepId) {
  document.querySelectorAll('.modal-step').forEach(s => {
    s.classList.remove('active')
    s.setAttribute('aria-hidden', 'true')
  })
  const el = document.getElementById(`step-${stepId}`)
  if (el) {
    el.classList.add('active')
    el.setAttribute('aria-hidden', 'false')
  }
}

function switchTab(tab) {
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab)
  })
  document.getElementById('pane-signup')?.classList.toggle('hidden', tab !== 'signup')
  document.getElementById('pane-signin')?.classList.toggle('hidden', tab !== 'signin')
}

// ══════════════════════════════════════════════════════════════════════════════
//  AUTH HANDLERS
// ══════════════════════════════════════════════════════════════════════════════

// ── Sign Up ───────────────────────────────────────────────────────────────────
async function handleSignUp(e) {
  e.preventDefault()
  clearAllErrors()

  const name     = document.getElementById('signup-name')?.value.trim()
  const email    = document.getElementById('signup-email')?.value.trim()
  const password = document.getElementById('signup-password')?.value
  const confirm  = document.getElementById('signup-confirm')?.value
  const btn      = document.getElementById('btn-signup')

  // Client-side validation
  if (!name || name.length < 2) {
    showError('signup-error', 'Please enter your full name (at least 2 characters).')
    return
  }
  if (!email || !email.includes('@')) {
    showError('signup-error', 'Please enter a valid email address.')
    return
  }
  if (!password || password.length < 8) {
    showError('signup-error', 'Password must be at least 8 characters.')
    return
  }
  if (password !== confirm) {
    showError('signup-error', 'Passwords do not match. Please re-enter.')
    return
  }

  setButtonLoading(btn, true, 'Creating your account…')

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },      // stored in user_metadata
      emailRedirectTo: window.location.origin,
    },
  })

  setButtonLoading(btn, false, 'Create Account →')

  if (error) {
    showError('signup-error', error.message)
    return
  }

  // Supabase may require email confirmation — handle both paths
  if (data.user && data.session) {
    // Auto-confirmed (email confirmation disabled in Supabase settings)
    currentUser = data.user
    showStep('q1')
  } else if (data.user && !data.session) {
    // Email confirmation required
    showStep('confirm-email')
  }
}

// ── Sign In ───────────────────────────────────────────────────────────────────
async function handleSignIn(e) {
  e.preventDefault()
  clearAllErrors()

  const email    = document.getElementById('signin-email')?.value.trim()
  const password = document.getElementById('signin-password')?.value
  const btn      = document.getElementById('btn-signin')

  if (!email || !password) {
    showError('signin-error', 'Please enter both email and password.')
    return
  }

  setButtonLoading(btn, true, 'Signing in…')

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  setButtonLoading(btn, false, 'Sign In →')

  if (error) {
    // Map common Supabase errors to friendly messages
    const msg = error.message.includes('Invalid login credentials')
      ? 'Incorrect email or password. Please try again.'
      : error.message.includes('Email not confirmed')
      ? 'Please confirm your email before signing in.'
      : error.message
    showError('signin-error', msg)
    return
  }

  currentUser = data.user

  // Check if user has completed onboarding
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_done, primary_workspace')
    .eq('id', data.user.id)
    .single()

  closeModal()

  if (!profile?.onboarding_done) {
    // Returning user who never finished onboarding — open onboarding
    setTimeout(() => {
      const modal = document.getElementById('auth-modal')
      modal?.classList.add('open')
      modal?.setAttribute('aria-hidden', 'false')
      document.body.style.overflow = 'hidden'
      showStep('q1')
    }, 400)
  } else {
    const name = data.user.user_metadata?.full_name?.split(' ')[0] || 'back'
    showToast(`Welcome back, ${name}! Redirecting to dashboard...`, 'success')
    const targetParam = profile?.primary_workspace === 'knowNext' ? 'knownext' : 'mira'
    setTimeout(() => {
      window.location.href = `/dashboard.html?view=${targetParam}`
    }, 800)
  }
}

// ── Forgot Password ───────────────────────────────────────────────────────────
async function handleForgotPassword(e) {
  e.preventDefault()
  const email = document.getElementById('signin-email')?.value.trim()
  if (!email) {
    showError('signin-error', 'Enter your email above, then click "Forgot password".')
    return
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '?reset=true',
  })
  if (error) { showError('signin-error', error.message); return }
  showToast('Password reset email sent — check your inbox.', 'info')
}

// ── Sign Out (exposed globally) ───────────────────────────────────────────────
export async function signOut() {
  await supabase.auth.signOut()
  showToast('You have been signed out.', 'info')
}

// ══════════════════════════════════════════════════════════════════════════════
//  ONBOARDING FLOW
// ══════════════════════════════════════════════════════════════════════════════

/** Called from inline onclick on option cards */
export function selectOption(field, value, el) {
  // Deselect siblings in same step
  el.closest('.option-grid')?.querySelectorAll('.option-card').forEach(c => {
    c.classList.remove('selected')
    c.setAttribute('aria-checked', 'false')
  })
  el.classList.add('selected')
  el.setAttribute('aria-checked', 'true')
  onboardingData[field] = value

  // Enable the Next button for this step
  const stepMap = { role: 'q1', goal: 'q2', workspace: 'q3' }
  const nextBtn = document.getElementById(`next-${stepMap[field]}`)
  if (nextBtn) { nextBtn.disabled = false }
}

/** Called from inline onclick on Continue / Finish buttons */
export async function goToStep(fromField, nextStepId) {
  if (!onboardingData[fromField]) return   // guard: nothing selected

  if (nextStepId === 'welcome') {
    await finalizeOnboarding()
  }
  showStep(nextStepId)
}

async function finalizeOnboarding() {
  if (!currentUser) return

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id:                currentUser.id,
      full_name:         currentUser.user_metadata?.full_name,
      email:             currentUser.email,
      role:              onboardingData.role,
      goal:              onboardingData.goal,
      primary_workspace: onboardingData.workspace,
      onboarding_done:   true,
      updated_at:        new Date().toISOString(),
    })

  if (error) {
    console.error('[Supabase] Profile save failed:', error.message)
  }

  // Redirect to dashboard with workspace query param
  const targetParam = onboardingData.workspace === 'knowNext' ? 'knownext' : 'mira'
  setTimeout(() => {
    window.location.href = `/dashboard.html?view=${targetParam}`
  }, 1000)
}

function resetOnboardingUI() {
  document.querySelectorAll('.option-card').forEach(c => {
    c.classList.remove('selected')
    c.setAttribute('aria-checked', 'false')
  })
  ;['next-q1', 'next-q2', 'next-q3'].forEach(id => {
    const btn = document.getElementById(id)
    if (btn) btn.disabled = true
  })
}

// ══════════════════════════════════════════════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════════════════════════════════════════════

function updateUIForLoggedIn(user) {
  const first = (user.user_metadata?.full_name || user.email || 'You').split(' ')[0]
  document.querySelectorAll('[data-open-modal]').forEach(btn => {
    btn.textContent = `Hi, ${first} 👋`
    btn.style.background = 'var(--green)'
    btn.style.cursor = 'default'
  })
  // Show sign-out option if element exists
  document.querySelectorAll('[data-signout]').forEach(btn => {
    btn.style.display = 'inline-flex'
    btn.addEventListener('click', signOut)
  })
}

function updateUIForLoggedOut() {
  document.querySelectorAll('[data-open-modal]').forEach(btn => {
    btn.textContent = 'Get Started'
    btn.style.background = ''
    btn.style.cursor = ''
  })
  document.querySelectorAll('[data-signout]').forEach(btn => {
    btn.style.display = 'none'
  })
}

function setButtonLoading(btn, loading, text) {
  if (!btn) return
  btn.disabled = loading
  btn.textContent = text
}

function showError(id, message) {
  const el = document.getElementById(id)
  if (!el) return
  el.textContent = message
  el.classList.remove('hidden')
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function clearAllErrors() {
  document.querySelectorAll('.form-error').forEach(el => {
    el.textContent = ''
    el.classList.add('hidden')
  })
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.setAttribute('role', 'status')
  toast.textContent = message
  document.body.appendChild(toast)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'))
  })
  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 350)
  }, 3800)
}

// ══════════════════════════════════════════════════════════════════════════════
//  EXPOSE to window for inline HTML onclick handlers
// ══════════════════════════════════════════════════════════════════════════════
window.selectOption = selectOption
window.goToStep     = goToStep
window.openModal    = openModal
window.closeModal   = closeModal
window.signOut      = signOut
