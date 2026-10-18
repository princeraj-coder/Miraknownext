-- ═══════════════════════════════════════════════════════════════════════
--  Mira × KnowNext — Supabase Database Schema
--  Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. PROFILES TABLE ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                UUID        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name         TEXT,
  email             TEXT,
  role              TEXT        CHECK (role IN ('student', 'teacher', 'professional', 'personal')),
  goal              TEXT        CHECK (goal IN ('tasks_meetings', 'pdfs_docs', 'ask_answer', 'teach_manage')),
  primary_workspace TEXT        CHECK (primary_workspace IN ('mira', 'knowNext', 'both')),
  avatar_url        TEXT,
  onboarding_done   BOOLEAN     DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. ROW LEVEL SECURITY ─────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile (needed for trigger)
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ── 3. AUTO-CREATE PROFILE ON SIGN UP ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.email
  );
  RETURN NEW;
END;
$$;

-- Trigger fires after every new user is created in auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ── 4. AUTO-UPDATE updated_at ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ── 5. HELPFUL VIEW: user summary ─────────────────────────────────────
CREATE OR REPLACE VIEW public.user_summary AS
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.role,
    p.goal,
    p.primary_workspace,
    p.onboarding_done,
    p.created_at
  FROM public.profiles p;

-- ── Done! ──────────────────────────────────────────────────────────────
-- After running this, go back to your app and test the auth flow.
