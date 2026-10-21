-- ═══════════════════════════════════════════════════════════════════════
--  Mira AI Multi-Model Platform — Supabase Database Schema
--  Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. AI CONVERSATIONS TABLE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL DEFAULT 'New Conversation',
  selected_provider TEXT NOT NULL DEFAULT 'gemini',
  selected_model    TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  pinned            BOOLEAN NOT NULL DEFAULT FALSE,
  archived          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for speedy listing of a user's conversations
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user ON public.ai_conversations(user_id, updated_at DESC);

-- ── 2. AI MESSAGES TABLE ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role              TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content           TEXT NOT NULL,
  provider          TEXT,
  model             TEXT,
  status            TEXT NOT NULL DEFAULT 'completed',
  attachments       JSONB DEFAULT '[]'::jsonb,
  tokens_used       JSONB DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for ordering messages inside a conversation
CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON public.ai_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_ai_messages_user ON public.ai_messages(user_id);

-- ── 3. AI PROVIDER USAGE & RATE LIMITING TABLE ────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_provider_usage (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id   UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  provider          TEXT NOT NULL,
  model             TEXT NOT NULL,
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'success',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON public.ai_provider_usage(user_id, created_at DESC);

-- ── 4. AI FILE METADATA TABLE (AZURE BLOB STORAGE) ─────────────────────
CREATE TABLE IF NOT EXISTS public.ai_file_metadata (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id   UUID REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  filename          TEXT NOT NULL,
  original_name     TEXT NOT NULL,
  file_size         BIGINT NOT NULL,
  mime_type         TEXT NOT NULL,
  storage_path      TEXT NOT NULL,
  storage_provider  TEXT NOT NULL DEFAULT 'azure',
  extracted_text    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_files_user ON public.ai_file_metadata(user_id);

-- ── 5. AI USER PREFERENCES TABLE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_user_preferences (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_provider  TEXT NOT NULL DEFAULT 'gemini',
  default_model     TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  system_prompt     TEXT DEFAULT '',
  temperature       NUMERIC NOT NULL DEFAULT 0.7,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 6. ROW LEVEL SECURITY (RLS) POLICIES ──────────────────────────────
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_file_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_user_preferences ENABLE ROW LEVEL SECURITY;

-- ai_conversations
DROP POLICY IF EXISTS "Users can read own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.ai_conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.ai_conversations;

CREATE POLICY "Users can read own conversations"
  ON public.ai_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON public.ai_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON public.ai_conversations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON public.ai_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- ai_messages
DROP POLICY IF EXISTS "Users can read own messages" ON public.ai_messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON public.ai_messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.ai_messages;

CREATE POLICY "Users can read own messages"
  ON public.ai_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own messages"
  ON public.ai_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own messages"
  ON public.ai_messages FOR DELETE
  USING (auth.uid() = user_id);

-- ai_provider_usage
DROP POLICY IF EXISTS "Users can view own usage" ON public.ai_provider_usage;
DROP POLICY IF EXISTS "Users can insert own usage" ON public.ai_provider_usage;

CREATE POLICY "Users can view own usage"
  ON public.ai_provider_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own usage"
  ON public.ai_provider_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ai_file_metadata
DROP POLICY IF EXISTS "Users can view own file metadata" ON public.ai_file_metadata;
DROP POLICY IF EXISTS "Users can insert own file metadata" ON public.ai_file_metadata;
DROP POLICY IF EXISTS "Users can delete own file metadata" ON public.ai_file_metadata;

CREATE POLICY "Users can view own file metadata"
  ON public.ai_file_metadata FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own file metadata"
  ON public.ai_file_metadata FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own file metadata"
  ON public.ai_file_metadata FOR DELETE
  USING (auth.uid() = user_id);

-- ai_user_preferences
DROP POLICY IF EXISTS "Users can view own ai preferences" ON public.ai_user_preferences;
DROP POLICY IF EXISTS "Users can insert own ai preferences" ON public.ai_user_preferences;
DROP POLICY IF EXISTS "Users can update own ai preferences" ON public.ai_user_preferences;

CREATE POLICY "Users can view own ai preferences"
  ON public.ai_user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ai preferences"
  ON public.ai_user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai preferences"
  ON public.ai_user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 7. AUTO-UPDATE updated_at TRIGGER FOR ai_conversations ─────────────
DROP TRIGGER IF EXISTS ai_conversations_updated_at ON public.ai_conversations;
CREATE TRIGGER ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
