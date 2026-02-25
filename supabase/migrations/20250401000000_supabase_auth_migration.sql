-- Gear AI CoPilot - Switch from Firebase Auth to Supabase Auth
-- Version: 20250401000000
-- Description: Make firebase_uid nullable since auth is now handled by Supabase Auth.
--              The user_id (UUID) now directly maps to auth.uid() from Supabase Auth.

-- firebase_uid is no longer required (Supabase Auth uses user_id = auth.uid())
ALTER TABLE public.users ALTER COLUMN firebase_uid DROP NOT NULL;
