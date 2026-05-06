-- Persist latitude/longitude through the bulk roadshow create path.
--
-- Before this migration, create_roadshow_bulk silently dropped the lat/lng
-- pinned on the MapPicker because the RPC's INSERT column list omitted them.
-- Multi-day roadshows shipped with NULL coords, which the check-in proximity
-- gate read as "Location not set — check-in unavailable", blocking agents
-- from checking in even though the manager had pinned the venue.
--
-- Idempotent: CREATE OR REPLACE replaces the function body in place.

CREATE OR REPLACE FUNCTION create_roadshow_bulk(
    p_events jsonb,
    p_config jsonb,
    p_attendees jsonb,
    p_created_by uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_ids uuid[] := '{}';
    v_event_id uuid;
    v_event jsonb;
    v_lat double precision;
    v_lng double precision;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() != p_created_by THEN
        RAISE EXCEPTION 'Unauthorized: caller must match p_created_by';
    END IF;

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
    END IF;

    RETURN jsonb_build_object(
        'event_ids', to_jsonb(v_event_ids),
        'count', array_length(v_event_ids, 1)
    );
END;
$$;
