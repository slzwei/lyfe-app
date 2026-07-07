-- ════════════════════════════════════════════════════════════════════
-- Event invite / cancellation notifications
--
-- WHY:
--   Being added to an event produced no signal at all — no trigger, no
--   client insert, and no allowed notification type. Attendees first
--   heard about an event from the T-24h cron reminder; deleting an event
--   silently vanished it from their calendars. This migration closes the
--   loop: an in-app notification (and, via the existing notifications
--   INSERT webhook → send-push-notification EF, a push) on invite and on
--   cancellation of a future event.
--
-- WHAT:
--   1. sg_today() helper — the DB session runs UTC; every "today"
--      comparison must use the Singapore calendar day or invites around
--      midnight SGT mis-classify (same bug class as the client-side
--      dateRange fix shipped 2026-07).
--   2. chk_notification_type: live 27-type list (read from prod
--      pg_constraint, NOT from migration files — later migrations had
--      drifted) + 'event_invite' + 'event_cancelled'.
--   3. trigger_notify_event_invite — AFTER INSERT ON event_attendees.
--      Skips: transaction-local GUC suppression (bulk path), past
--      events, the event creator adding themselves.
--   4. trigger_notify_event_cancelled — BEFORE DELETE ON events (BEFORE
--      so the FK cascade hasn't removed event_attendees yet). Future
--      events only. Excludes the deleting user via auth.uid().
--   5. create_roadshow_bulk v3 — suppresses the per-row trigger inside
--      the attendee CROSS JOIN (up to 31 days × N attendees would spam
--      one push per day) and emits ONE summary invite per attendee,
--      excluding the creator, routed to the first day's event.
--
-- SERVICE-ROLE NOTE (reviewed decision):
--   auth.uid() is reliable for app-originated deletes (user JWT via
--   PostgREST) so the deleter is excluded. On service-role deletes it is
--   NULL and ALL attendees are notified — acceptable, arguably correct,
--   for admin-initiated cancellations.
--
-- DEPENDENCIES:
--   * notify_insert() helper (20260313100000_notification_triggers.sql).
--   * lyfe-app types/notification.ts adds both types + role visibility
--     (same PR) so the inbox renders proper icon/label and the prefs
--     screen can opt out. send-push-notification EF is generic
--     (default-on per type) — no EF change.
--
-- ROLLBACK:
--   DROP TRIGGER trg_notify_event_invite ON event_attendees;
--   DROP TRIGGER trg_notify_event_cancelled ON events;
--   DROP FUNCTION trigger_notify_event_invite();
--   DROP FUNCTION trigger_notify_event_cancelled();
--   DROP FUNCTION sg_today();
--   <restore create_roadshow_bulk v2 from 20260502130000>;
--   <re-add chk_notification_type without the two new types>;
-- ════════════════════════════════════════════════════════════════════

-- 1. Singapore calendar day ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sg_today()
RETURNS date
LANGUAGE sql STABLE
SET search_path = public
AS $$
    SELECT (now() AT TIME ZONE 'Asia/Singapore')::date;
$$;

-- 2. Allow the new notification types ───────────────────────────────────
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS chk_notification_type;

ALTER TABLE public.notifications
  ADD CONSTRAINT chk_notification_type CHECK (type IN (
    'roadshow_pledge',
    'new_lead',
    'candidate_update',
    'lead_milestone',
    'lead_reassigned',
    'lead_reassigned_global',
    'interview_scheduled',
    'interview_updated',
    'candidate_assigned',
    'agent_invite_accepted',
    'module_completed',
    'roadmap_unlocked',
    'new_manager_joined',
    'event_reminder',
    'interview_reminder',
    'lead_stale',
    'agency_announcement',
    'roadshow_summary',
    'system_alert',
    'lead_assigned',
    'candidate_deleted',
    'profile_completed',
    'disc_completed',
    'enneagram_completed',
    'candidate_reassigned',
    'reassignment',
    'organic_application',
    'event_invite',
    'event_cancelled'
  ));

-- 3. Invite notification on attendee INSERT ─────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_notify_event_invite()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event events%ROWTYPE;
    v_creator_name text;
BEGIN
    -- Bulk paths (create_roadshow_bulk) suppress per-row invites and send
    -- one summary instead. set_config(..., true) is transaction-local.
    IF current_setting('lyfe.suppress_event_invite_notif', true) = 'on' THEN
        RETURN NEW;
    END IF;

    SELECT * INTO v_event FROM events WHERE id = NEW.event_id;
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    -- Only future (or today's) events; creator adding themselves is noise.
    IF v_event.event_date < sg_today() OR NEW.user_id = v_event.created_by THEN
        RETURN NEW;
    END IF;

    SELECT full_name INTO v_creator_name FROM users WHERE id = v_event.created_by;

    PERFORM notify_insert(
        NEW.user_id,
        'event_invite',
        'Added to event',
        COALESCE(v_creator_name, 'A colleague') || ' added you to "' || v_event.title || '" on '
            || to_char(v_event.event_date, 'FMDD Mon'),
        jsonb_build_object(
            'route', '/(tabs)/events/' || v_event.id,
            'eventId', v_event.id
        )
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_event_invite ON public.event_attendees;
CREATE TRIGGER trg_notify_event_invite
    AFTER INSERT ON public.event_attendees
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_notify_event_invite();

-- 4. Cancellation notification on event DELETE ──────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_notify_event_cancelled()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attendee record;
BEGIN
    -- Past events: deleting is cleanup, not a cancellation.
    IF OLD.event_date < sg_today() THEN
        RETURN OLD;
    END IF;

    -- BEFORE DELETE: the ON DELETE CASCADE on event_attendees has not run
    -- yet, so the attendee list is still present.
    FOR v_attendee IN
        SELECT user_id FROM event_attendees
        WHERE event_id = OLD.id
          AND user_id IS DISTINCT FROM auth.uid()
    LOOP
        PERFORM notify_insert(
            v_attendee.user_id,
            'event_cancelled',
            'Event cancelled',
            '"' || OLD.title || '" on ' || to_char(OLD.event_date, 'FMDD Mon') || ' has been cancelled',
            -- No route: the event is gone. The inbox renders route-less
            -- notifications as informational rows.
            jsonb_build_object('eventId', OLD.id)
        );
    END LOOP;

    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_event_cancelled ON public.events;
CREATE TRIGGER trg_notify_event_cancelled
    BEFORE DELETE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_notify_event_cancelled();

-- 5. create_roadshow_bulk v3 — suppressed per-row invites + one summary ─
--    (v2 body from 20260502130000, verified against live prod def;
--     additions marked with -- v3.)
CREATE OR REPLACE FUNCTION public.create_roadshow_bulk(
    p_events jsonb,
    p_config jsonb,
    p_attendees jsonb,
    p_created_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_ids uuid[] := '{}';
    v_event_id uuid;
    v_event jsonb;
    v_lat double precision;
    v_lng double precision;
    v_title text;             -- v3
    v_first_date date;        -- v3
    v_last_date date;         -- v3
    v_day_count int;          -- v3
    v_attendee jsonb;         -- v3
    v_attendee_id uuid;       -- v3
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != p_created_by THEN
        RAISE EXCEPTION 'Unauthorized: caller must match p_created_by';
    END IF;

    -- v3: one summary invite per attendee instead of one per created day.
    PERFORM set_config('lyfe.suppress_event_invite_notif', 'on', true);

    FOR v_event IN SELECT * FROM jsonb_array_elements(p_events)
    LOOP
        -- Coords are optional; coerce both-or-neither so the
        -- events_location_coords_pair CHECK (lat/lng both null OR both set)
        -- holds even if the caller sends only one half.
        v_lat := NULLIF(v_event->>'latitude', '')::double precision;
        v_lng := NULLIF(v_event->>'longitude', '')::double precision;
        IF v_lat IS NULL OR v_lng IS NULL THEN
            v_lat := NULL;
            v_lng := NULL;
        END IF;

        INSERT INTO events (
            title, description, event_type, event_date, start_time, end_time,
            location, latitude, longitude, created_by, external_attendees
        ) VALUES (
            v_event->>'title',
            NULLIF(v_event->>'description', ''),
            'roadshow',
            (v_event->>'event_date')::date,
            (v_event->>'start_time')::time,
            CASE WHEN v_event->>'end_time' IS NOT NULL AND v_event->>'end_time' != ''
                 THEN (v_event->>'end_time')::time ELSE NULL END,
            NULLIF(v_event->>'location', ''),
            v_lat,
            v_lng,
            p_created_by,
            '[]'::jsonb
        )
        RETURNING id INTO v_event_id;

        v_event_ids := array_append(v_event_ids, v_event_id);

        -- v3: track the batch shape for the summary notification
        v_title := COALESCE(v_title, v_event->>'title');
        v_first_date := LEAST(COALESCE(v_first_date, (v_event->>'event_date')::date), (v_event->>'event_date')::date);
        v_last_date := GREATEST(COALESCE(v_last_date, (v_event->>'event_date')::date), (v_event->>'event_date')::date);

        INSERT INTO roadshow_configs (
            event_id, weekly_cost, slots_per_day, expected_start_time,
            late_grace_minutes, suggested_sitdowns, suggested_pitches, suggested_closed
        ) VALUES (
            v_event_id,
            (p_config->>'weekly_cost')::numeric,
            (p_config->>'slots_per_day')::int,
            (p_config->>'expected_start_time')::time,
            (p_config->>'late_grace_minutes')::int,
            (p_config->>'suggested_sitdowns')::int,
            (p_config->>'suggested_pitches')::int,
            (p_config->>'suggested_closed')::int
        );
    END LOOP;

    IF jsonb_array_length(p_attendees) > 0 THEN
        INSERT INTO event_attendees (event_id, user_id, attendee_role)
        SELECT v_eid, (att->>'user_id')::uuid, att->>'attendee_role'
        FROM unnest(v_event_ids) v_eid
        CROSS JOIN jsonb_array_elements(p_attendees) att;

        -- v3: one summary invite per attendee (creator excluded), routed to
        -- the first day's event.
        v_day_count := array_length(v_event_ids, 1);
        FOR v_attendee IN SELECT * FROM jsonb_array_elements(p_attendees)
        LOOP
            v_attendee_id := (v_attendee->>'user_id')::uuid;
            IF v_attendee_id IS DISTINCT FROM p_created_by THEN
                PERFORM notify_insert(
                    v_attendee_id,
                    'event_invite',
                    'Added to roadshow',
                    'You''re on "' || v_title || '" — ' || v_day_count || ' day'
                        || CASE WHEN v_day_count > 1 THEN 's' ELSE '' END || ', '
                        || to_char(v_first_date, 'FMDD Mon') || ' to ' || to_char(v_last_date, 'FMDD Mon'),
                    jsonb_build_object(
                        'route', '/(tabs)/events/' || v_event_ids[1],
                        'eventId', v_event_ids[1]
                    )
                );
            END IF;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'event_ids', to_jsonb(v_event_ids),
        'count', array_length(v_event_ids, 1)
    );
END;
$$;
