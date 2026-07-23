-- =============================================
-- GRAMSEVA HEALTH — FORGOT PASSWORD SETUP
-- Copy-paste this ENTIRE SQL into Supabase SQL Editor and click "Run"
-- =============================================

-- ── 1. Create Password Reset Tokens Table ──
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON public.password_reset_tokens(token_hash);

-- Enable RLS but only allow service_role to access it (our backend API)
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
-- No policies created, meaning only superuser/service_role can read/write

-- ── 2. Create Rate Limiting Table ──
CREATE TABLE IF NOT EXISTS public.password_reset_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS but only allow service_role to access it
ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;

-- ── 3. Create Function to securely get user ID by email ──
-- This allows our backend to look up a user ID without pulling the whole auth.users table
CREATE OR REPLACE FUNCTION public.get_user_id_by_email(user_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as the definer (superuser) to access auth.users
SET search_path = public
AS $$
DECLARE
  found_user_id UUID;
BEGIN
  SELECT id INTO found_user_id
  FROM auth.users
  WHERE email = user_email
  LIMIT 1;
  
  RETURN found_user_id;
END;
$$;

-- Restrict execution so anon/authenticated cannot query this function via PostgREST API
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_id_by_email(TEXT) TO service_role;

