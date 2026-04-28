-- Migrate emock_attempts + emock_tutorial_progress to the pool model.
--
-- Background: the emock module shifts from fixed papers (Set A / Set B / Mock 1 / Mock 2)
-- to a single per-module question pool. A "mock" is now a snapshot of UUIDs drawn at
-- attempt-start, persisted on the row for resume + reproducible review. Tutorial mode
-- now identifies questions by UUID instead of "{quizId}:{n}".
--
-- This migration ONLY changes the schema and clears now-incompatible state.
-- The application code that uses the new columns ships in a later PR.

BEGIN;

-- ─── 1. emock_attempts: add snapshot + kind columns ───────────────────────────

ALTER TABLE public.emock_attempts
  ADD COLUMN question_ids jsonb,
  ADD COLUMN exam_kind text NOT NULL DEFAULT 'mock';

COMMENT ON COLUMN public.emock_attempts.question_ids IS
  'Pool-model: ordered array of UUIDs drawn for this attempt. NULL for legacy rows keyed by quiz_id.';
COMMENT ON COLUMN public.emock_attempts.exam_kind IS
  'Attempt variant. Currently always ''mock''; reserved for future variants.';

-- ─── 2. quiz_id: drop NOT NULL so new pool-model rows can omit it ─────────────

ALTER TABLE public.emock_attempts
  ALTER COLUMN quiz_id DROP NOT NULL;

COMMENT ON COLUMN public.emock_attempts.quiz_id IS
  'LEGACY. Populated only on rows created before the pool-model migration. New rows leave this NULL and use question_ids instead.';

-- ─── 3. Enforce "one in-progress mock per (user, module)" for pool-model rows ─
--
-- Distinct from the existing non-unique idx_emock_attempts_in_progress, which
-- stays in place as a regular lookup index. This unique partial index applies
-- only to new pool-model rows (quiz_id IS NULL).

CREATE UNIQUE INDEX emock_attempts_one_in_progress_pool
  ON public.emock_attempts (user_id, module_id)
  WHERE status = 'in_progress' AND quiz_id IS NULL;

-- ─── 4. Discard legacy in-progress attempts ──────────────────────────────────
--
-- These rows are keyed by quiz_id (set-a / set-b / mock-1 / mock-2). Their
-- answers cannot be graded against the new pool because the static papers
-- are being removed. Per the migration plan, they are abandoned at cutover.
-- Completed attempts are preserved for history (rendered as legacy rows).

DELETE FROM public.emock_attempts WHERE status = 'in_progress';

-- ─── 5. Wipe tutorial progress ───────────────────────────────────────────────
--
-- The question_key format changes from "{quizId}:{question_number}" to a UUID.
-- Old rows reference quizIds that no longer exist. Best-effort migration would
-- rely on fragile question-text matching, so per the migration plan we wipe.

DELETE FROM public.emock_tutorial_progress;

COMMIT;
