-- Audit H6 — Realtime was dead for notifications + roadshows.
--
-- NotificationContext subscribes to postgres_changes INSERT on `notifications`
-- (the unread badge) and useRoadshowRealtime subscribes to INSERT on
-- `roadshow_activities` + `roadshow_attendance` (the live booth leaderboard) —
-- but none of these three tables were ever added to the supabase_realtime
-- publication. Without publication membership Postgres streams no WAL changes
-- for a table to the Realtime server, so those subscriptions silently received
-- zero events: the badge never moved on its own and the leaderboard stayed
-- frozen until a manual refresh. (`leads` + `progress_signals` were already
-- published, which is why those two realtime surfaces worked.)
--
-- All three subscriptions are INSERT-only, so REPLICA IDENTITY DEFAULT is
-- sufficient: Realtime evaluates each table's RLS SELECT policy against the
-- fully-logged new row to authorise delivery — exactly like the already-working
-- `leads` subscription. No REPLICA IDENTITY change is needed here; contrast
-- 20260427130200 which set REPLICA IDENTITY FULL only on the UPDATE-subscribed
-- tables (their OLD row is otherwise absent from the WAL).
--
-- Each ADD is guarded by an existence check so the statement is idempotent: a
-- from-zero `supabase db reset` rebuild adds each table exactly once, and
-- re-running against a database where a table is already a member is a no-op
-- rather than a hard "relation is already member of publication" error.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'roadshow_activities'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.roadshow_activities;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'roadshow_attendance'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.roadshow_attendance;
    END IF;
END $$;
