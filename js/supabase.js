// ─────────────────────────────────────────────────────────────────────────────
//  js/supabase.js  —  Singleton Supabase client
//  Reads credentials from VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
//  (set in .env.local — same values documented in Mira.env.local/)
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || supabaseUrl.includes('your-project-ref')) {
  console.warn(
    '⚠️  Supabase URL not configured.\n' +
    '   Open .env.local and paste your Supabase Project URL into VITE_SUPABASE_URL.'
  )
}
if (!supabaseAnonKey || supabaseAnonKey.includes('your-anon')) {
  console.warn(
    '⚠️  Supabase Anon Key not configured.\n' +
    '   Open .env.local and paste your anon public key into VITE_SUPABASE_ANON_KEY.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession:     true,   // keeps user logged in across page reloads
    autoRefreshToken:   true,   // silently refreshes JWT before expiry
    detectSessionInUrl: true,   // handles magic-link / OAuth redirects
  },
})
