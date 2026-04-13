-- Roadshow proximity check: precise coordinates + radius for check-in enforcement.
--
-- Adds latitude/longitude/radius columns so the check-in flow can verify the
-- user is physically at the roadshow venue (in addition to the Lyfe ID face
-- check). latitude/longitude are nullable: NULL means "location TBC" — the
-- event still exists but check-ins are blocked until a manager pins the spot
-- via the MapPicker.

ALTER TABLE public.events
    ADD COLUMN latitude double precision,
    ADD COLUMN longitude double precision,
    ADD COLUMN location_radius_meters int NOT NULL DEFAULT 100;

-- Guardrails: valid decimal-degree ranges, positive radius.
ALTER TABLE public.events
    ADD CONSTRAINT events_latitude_range
        CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90)),
    ADD CONSTRAINT events_longitude_range
        CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180)),
    ADD CONSTRAINT events_radius_positive
        CHECK (location_radius_meters > 0);

-- Both lat and lng must be set together, or both null.
ALTER TABLE public.events
    ADD CONSTRAINT events_location_coords_pair
        CHECK (
            (latitude IS NULL AND longitude IS NULL)
            OR (latitude IS NOT NULL AND longitude IS NOT NULL)
        );

COMMENT ON COLUMN public.events.latitude IS
    'Decimal degrees WGS84. NULL means the venue location is "TBC" — the Lyfe app blocks check-ins for such events until a manager pins coords via the MapPicker.';
COMMENT ON COLUMN public.events.longitude IS
    'Decimal degrees WGS84. See latitude for TBC semantics.';
COMMENT ON COLUMN public.events.location_radius_meters IS
    'Distance in metres from (latitude, longitude) within which a user can successfully check in. Default 100m. Overridable per event.';
