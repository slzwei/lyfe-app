-- Add ON DELETE CASCADE to exam_attempts.user_id FK. Today the FK has no
-- action specified (defaults to NO ACTION), which means deleting a user
-- with any exam attempts raises a constraint violation — making the
-- delete-account edge function fail at Phase 6 (auth.admin.deleteUser).
--
-- CASCADE is the correct choice here:
--   * exam_answers already has ON DELETE CASCADE to exam_attempts(id), so
--     attempts → answers is already a cascade chain. Adding user → attempts
--     completes it.
--   * Personality-test results (DISC, VARK, Enneagram) are stored as exam
--     attempts. PDPA "right to be forgotten" requires they be removed when
--     a user deletes their account.
--   * Aggregate stats / reporting that need historical attempts after a
--     user leaves should already be persisting to a separate audit table
--     (none exists today, and that's a deliberate choice — agency leaders
--     review live performance, not deleted users).

ALTER TABLE public.exam_attempts
    DROP CONSTRAINT IF EXISTS exam_attempts_user_id_fkey;

ALTER TABLE public.exam_attempts
    ADD CONSTRAINT exam_attempts_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES public.users(id)
        ON DELETE CASCADE;
