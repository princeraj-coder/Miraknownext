// ─────────────────────────────────────────────────────────────────────────────
//  server/auth-helper.js — Supabase JWT Authentication & Ownership Verifier
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabaseClient = null;
if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.warn('[Auth Helper] Supabase client init error:', err.message);
  }
}

/**
 * Extract and authenticate user from HTTP Authorization header
 * @param {Object} req - Incoming request object
 * @returns {Promise<{user: Object | null, error: string | null}>}
 */
export async function authenticateRequest(req) {
  const authHeader = req.headers?.authorization || req.headers?.['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) {
    return {
      user: null,
      error: 'Missing or malformed Authorization header. Please sign in to Mira.'
    };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return { user: null, error: 'Empty authentication token.' };
  }

  // Verify token with Supabase Auth
  if (supabaseClient) {
    try {
      const { data: { user }, error } = await supabaseClient.auth.getUser(token);
      if (error || !user) {
        return { user: null, error: error?.message || 'Invalid or expired authentication session.' };
      }
      return { user, error: null };
    } catch (err) {
      console.warn('[Auth Helper] getUser error:', err.message);
      return { user: null, error: 'Authentication verification service error.' };
    }
  }

  return { user: null, error: 'Authentication service not configured.' };
}
