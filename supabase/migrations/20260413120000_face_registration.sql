-- Face verification: track registration state + version-control the storage bucket.
--
-- Adds a users.face_registered_at timestamp so the app has a single authoritative
-- source of truth for whether a user has uploaded a face reference (avoiding the
-- POC-era pattern of probing the bucket on every mount). Also captures the
-- face-references storage bucket that was created manually during the POC so it's
-- reproducible in CI.

-- ── Column on public.users ────────────────────────────────────────────
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS face_registered_at timestamptz;

COMMENT ON COLUMN public.users.face_registered_at IS
    'When this user last uploaded a face reference to the face-references bucket. NULL if never registered. Written by the verify-face edge function (register action) using the service role.';

-- ── Storage bucket ────────────────────────────────────────────────────
-- Private bucket; only the verify-face edge function (service role) reads or writes.
-- 5MB upload limit matches MAX JPEG size from the mobile camera pipeline.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'face-references',
    'face-references',
    false,
    5242880,
    ARRAY['image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;
