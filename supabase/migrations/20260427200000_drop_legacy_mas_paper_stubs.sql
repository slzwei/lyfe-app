-- Drop legacy M5 / M9 / M9A / HI exam_papers stub rows
--
-- These four rows were inserted in the original exam_papers seed (Feb 2026)
-- under the assumption that candidates would take MAS licensing papers
-- in-app via the standard exam_attempts flow. That assumption was reversed
-- when the candidate lifecycle rewrite shipped (migration 20260417100100):
--
--   * Real CMFAS papers are now sat at MAS testing centres; results are
--     logged by managers in the ATS via `candidate_paper_attempts` (FK to
--     candidates, paper_code CHECK enforces the same set of codes).
--   * Practice for those papers happens on lyfe-sg `/emock` and writes to
--     `emock_attempts` / `emock_tutorial_progress`.
--   * The exam_papers stub rows have stayed in place but with
--     question_count=0; the mobile exam list filters them out via a
--     hardcoded `.not('code','in','("M5","M9","M9A","HI")')` clause at
--     `app/(tabs)/exams/index.tsx`. That filter is the Band-Aid hiding
--     these stubs and is removed in the same commit as this migration.
--
-- After this migration the exam_papers table holds only the personality-
-- assessment rows (DISC, ENNEAGRAM, ENNEAGRAM_SAMPLER) which are the
-- mobile exam tab's actual purpose today.
--
-- FK behaviour:
--   * exam_questions.paper_id → exam_papers(id) ON DELETE CASCADE
--     (handles the question rows, which are 0 here in any case)
--   * exam_attempts.paper_id → exam_papers(id) NO ACTION (default RESTRICT)
--     so any historical attempts must be deleted explicitly first. CASCADE
--     on exam_answers → exam_attempts handles the answer rows.
--   * roadmap_modules.exam_paper_id → exam_papers(id) ON DELETE SET NULL
--   * roadmap_module_items.exam_paper_id → exam_papers(id) ON DELETE SET NULL

-- 1. Clean up any historical exam_attempts on the legacy stub papers.
--    The user's `delete-account` cascade rewrite (20260427130300) handled
--    user-side cascades; this handles the paper-side equivalent.
DELETE FROM public.exam_attempts
WHERE paper_id IN (
    SELECT id FROM public.exam_papers WHERE code IN ('M5', 'M9', 'M9A', 'HI')
);

-- 2. Defensive: explicit question cleanup. CASCADE on the FK would do this
--    automatically when the paper rows drop, but being explicit makes the
--    intent legible in audit history.
DELETE FROM public.exam_questions
WHERE paper_id IN (
    SELECT id FROM public.exam_papers WHERE code IN ('M5', 'M9', 'M9A', 'HI')
);

-- 3. Drop the stub paper rows. SET NULL on roadmap_modules /
--    roadmap_module_items.exam_paper_id auto-handles those references.
DELETE FROM public.exam_papers
WHERE code IN ('M5', 'M9', 'M9A', 'HI');
