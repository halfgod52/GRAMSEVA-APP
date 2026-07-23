-- =============================================
-- ADMIN ROLE & DOCTOR VERIFICATION MIGRATION
-- Instructions: Run this manually in your Supabase SQL Editor.
-- =============================================

-- 1. Ensure `is_verified` defaults to false for all new doctors
-- This prevents self-reported doctors from acting as verified doctors automatically.
ALTER TABLE public.doctors ALTER COLUMN is_verified SET DEFAULT false;

-- 2. Add soft-delete and rejection columns to the `doctors` table
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS is_rejected BOOLEAN DEFAULT false;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- 3. Confirm Profiles schema (Already correct in codebase, but safe to verify)
-- The `profiles` table already has a check constraint: role IN ('patient', 'doctor', 'admin').
-- No migration needed for the role column itself!

-- =============================================
-- HOW TO PROMOTE A USER TO ADMIN:
-- =============================================
-- There is NO self-service path to become an admin. You must run this SQL manually
-- for the trusted user you want to be an admin.
-- Replace the UUID below with the target user's UUID from the auth.users table.

-- UPDATE public.profiles 
-- SET role = 'admin' 
-- WHERE user_id = 'INSERT-USER-UUID-HERE';
