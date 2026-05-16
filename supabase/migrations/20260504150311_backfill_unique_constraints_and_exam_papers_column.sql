-- Backfill unique constraints + allow_multiple_answers column.
--
-- This migration was applied manually to staging as version 20260504150311
-- and the same schema shape already exists in prod, but the file was missing
-- locally. Keep it idempotent so future db pushes can safely record the
-- version without failing on databases where the objects already exist.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.disc_responses'::regclass
      AND conname = 'disc_responses_user_id_key'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'disc_responses_user_id_key'
        AND c.relkind = 'i'
    ) THEN
      ALTER TABLE public.disc_responses
        ADD CONSTRAINT disc_responses_user_id_key UNIQUE USING INDEX disc_responses_user_id_key;
    ELSE
      ALTER TABLE public.disc_responses
        ADD CONSTRAINT disc_responses_user_id_key UNIQUE (user_id);
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.disc_results'::regclass
      AND conname = 'disc_results_user_id_key'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'disc_results_user_id_key'
        AND c.relkind = 'i'
    ) THEN
      ALTER TABLE public.disc_results
        ADD CONSTRAINT disc_results_user_id_key UNIQUE USING INDEX disc_results_user_id_key;
    ELSE
      ALTER TABLE public.disc_results
        ADD CONSTRAINT disc_results_user_id_key UNIQUE (user_id);
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.enneagram_responses'::regclass
      AND conname = 'enneagram_responses_user_id_key'
  ) THEN
    ALTER TABLE public.enneagram_responses
      ADD CONSTRAINT enneagram_responses_user_id_key UNIQUE (user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.enneagram_results'::regclass
      AND conname = 'enneagram_results_user_id_key'
  ) THEN
    ALTER TABLE public.enneagram_results
      ADD CONSTRAINT enneagram_results_user_id_key UNIQUE (user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.emock_tutorial_progress'::regclass
      AND conname = 'emock_tutorial_progress_user_id_module_id_chapter_key_quest_key'
  ) THEN
    ALTER TABLE public.emock_tutorial_progress
      ADD CONSTRAINT emock_tutorial_progress_user_id_module_id_chapter_key_quest_key
      UNIQUE (user_id, module_id, chapter_key, question_key);
  END IF;
END;
$$;

ALTER TABLE public.exam_papers
  ADD COLUMN IF NOT EXISTS allow_multiple_answers boolean NOT NULL DEFAULT false;
