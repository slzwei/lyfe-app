
-- Add portal tracking columns to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS portal text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS portal_url text;
