-- ════════════════════════════════════════════════════════════════════
-- Tighten events / event_attendees RLS (TRACKER #36, second half)
--
-- WHY:
--   `read_events` and `read_event_attendees` were USING(true): any
--   authenticated user — including candidates — could read the full
--   agency calendar (incl. venue coordinates) and every attendee row at
--   API level (verified via rolled-back impersonation, 2026-07-03).
--   `authenticated_insert_events` was WITH CHECK (auth.uid() IS NOT
--   NULL): any candidate could INSERT events. The route-guard half was
--   closed in the 2026-07-08 calendar overhaul (useRequireRole on
--   /(tabs)/events/create); this closes the API half.
--
-- WHAT:
--   1. is_event_attendee(uuid) — SECURITY DEFINER membership probe.
--      Needed because a policy on event_attendees cannot subquery
--      event_attendees directly (Postgres RLS self-reference recursion),
--      and reusing it on events keeps both policies cheap + identical.
--   2. read_events: staff roles read all (managers/directors need team
--      calendars; PA/RO/admin read everything — matches app queries);
--      everyone else (candidates) reads only events they created or
--      attend.
--   3. read_event_attendees: staff read all; others read their own rows
--      + co-attendees of events they attend (event detail screen).
--   4. INSERT: staff creator roles only (admin/director/manager/pa/ro —
--      agents can't create events in-app either), and created_by must
--      be the caller (no spoofing). Renamed to staff_insert_events.
--
-- VERIFIED NON-BREAKING (live pg_policies audit before writing):
--   * update_events / delete_events / manage_attendees untouched.
--   * roadshow_{configs,attendance,activities}_select subquery
--     event_attendees ONLY as `user_id = auth.uid()` and events ONLY as
--     `created_by = auth.uid()` — both branches always pass under the
--     new policies, so roadshow leaderboards/check-ins are unaffected.
--   * create_roadshow_bulk + notification triggers are SECURITY DEFINER
--     (bypass RLS).
--   * Candidates CAN be event attendees (the attendee picker includes
--     them) — the is_event_attendee branch keeps their calendar,
--     event detail, and co-attendee list working.
--
-- ROLLBACK:
--   DROP POLICY read_events ON events;
--   CREATE POLICY read_events ON events FOR SELECT TO authenticated USING (true);
--   DROP POLICY staff_insert_events ON events;
--   CREATE POLICY authenticated_insert_events ON events FOR INSERT
--     WITH CHECK (auth.uid() IS NOT NULL);
--   DROP POLICY read_event_attendees ON event_attendees;
--   CREATE POLICY read_event_attendees ON event_attendees FOR SELECT
--     TO authenticated USING (true);
--   DROP FUNCTION is_event_attendee(uuid);
-- ════════════════════════════════════════════════════════════════════

-- 1. Membership probe (definer: bypasses RLS to avoid self-reference
--    recursion; only ever reveals the CALLER's own membership).
CREATE OR REPLACE FUNCTION public.is_event_attendee(p_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM event_attendees
        WHERE event_id = p_event_id AND user_id = auth.uid()
    );
$$;

-- 2. events SELECT
DROP POLICY IF EXISTS read_events ON public.events;
CREATE POLICY read_events ON public.events
    FOR SELECT TO authenticated
    USING (
        ((auth.jwt() -> 'app_metadata') ->> 'role') IN ('admin', 'director', 'manager', 'agent', 'pa', 'ro')
        OR created_by = auth.uid()
        OR is_event_attendee(id)
    );

-- 3. events INSERT (replaces authenticated_insert_events)
DROP POLICY IF EXISTS authenticated_insert_events ON public.events;
DROP POLICY IF EXISTS staff_insert_events ON public.events;
CREATE POLICY staff_insert_events ON public.events
    FOR INSERT TO authenticated
    WITH CHECK (
        ((auth.jwt() -> 'app_metadata') ->> 'role') IN ('admin', 'director', 'manager', 'pa', 'ro')
        AND created_by = auth.uid()
    );

-- 4. event_attendees SELECT
DROP POLICY IF EXISTS read_event_attendees ON public.event_attendees;
CREATE POLICY read_event_attendees ON public.event_attendees
    FOR SELECT TO authenticated
    USING (
        ((auth.jwt() -> 'app_metadata') ->> 'role') IN ('admin', 'director', 'manager', 'agent', 'pa', 'ro')
        OR user_id = auth.uid()
        OR is_event_attendee(event_id)
    );
