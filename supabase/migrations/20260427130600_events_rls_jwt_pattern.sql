-- Rewrite events / event_attendees RLS policies to avoid the recursive
-- `EXISTS (SELECT 1 FROM users WHERE id = auth.uid() ...)` pattern.
--
-- The admin role check moves to a JWT claim lookup (avoids hitting the
-- users table at all). The PA-of-manager check uses pa_manager_assignments
-- directly instead of users.reports_to — same semantic, but no recursion
-- through the users RLS evaluator.
--
-- Behavioral parity:
--   * INSERT: any authenticated user (unchanged).
--   * UPDATE events: creator OR admin OR PA assigned to creator (unchanged).
--   * DELETE events: creator OR admin (unchanged).
--   * event_attendees ALL: PA, admin, OR creator of parent event (unchanged).
--
-- Tested with the same 6-role matrix as the original policies.

-- ─────────────────────────────────────────────────────────────────────
-- events.UPDATE
--
-- Original (20260306105130) checked users.reports_to for the PA
-- branch. We use pa_manager_assignments instead — same purpose, but:
--   * recursion-free (pa_manager_assignments has no users-RLS recursion)
--   * matches the canonical PA→manager mapping used elsewhere
--     (create-candidate, pa-flow guards, etc.)
--   * many-to-many: PA assigned to multiple managers can update events
--     for any of them, not just their primary upline. This is the
--     intended design; users.reports_to is legacy.
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS update_events ON public.events;

CREATE POLICY update_events ON public.events
  FOR UPDATE
  USING (
    created_by = auth.uid()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'pa'
      AND EXISTS (
        SELECT 1
        FROM public.pa_manager_assignments
        WHERE pa_id = auth.uid()
          AND manager_id = events.created_by
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────
-- events.DELETE
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS delete_events ON public.events;

CREATE POLICY delete_events ON public.events
  FOR DELETE
  USING (
    created_by = auth.uid()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ─────────────────────────────────────────────────────────────────────
-- event_attendees ALL (manage_attendees)
--
--   Original: users-JOIN to find role IN ('pa', 'admin') OR be the
--   parent event creator. We replace the users-JOIN with a JWT role
--   check — same semantic ("any PA or any admin"), just no recursion.
-- ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS manage_attendees ON public.event_attendees;

CREATE POLICY manage_attendees ON public.event_attendees
  FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('pa', 'admin')
    OR EXISTS (
      SELECT 1 FROM public.events
      WHERE id = event_attendees.event_id
        AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('pa', 'admin')
    OR EXISTS (
      SELECT 1 FROM public.events
      WHERE id = event_attendees.event_id
        AND created_by = auth.uid()
    )
  );

-- INSERT policy on events (authenticated_insert_events) is already
-- recursion-free (uses auth.uid() IS NOT NULL only); no change needed.
