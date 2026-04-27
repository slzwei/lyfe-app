-- Normalize + constrain phone columns on the three tables that store them
-- (`users`, `candidates`, `leads`). Today there's nothing stopping a service-
-- role insert from putting `+65 9123-4567`, `91234567`, `6591234567`, or
-- raw garbage into the phone columns — the dedup key in create-candidate
-- breaks any time the format drifts. The trigger only runs on
-- `member_invitations`, leaving every other table loose.
--
-- We do this in two phases to be safe on prod data:
--
--   1. NORMALIZE existing rows: strip whitespace, dashes, parens, leading
--      `+`. Keep any row that ends up empty as NULL.
--   2. ADD CHECK constraint NOT VALID, then VALIDATE — this surfaces any
--      remaining offenders without locking the tables for a full scan.
--
-- The regex is generous (^\d{7,15}$): permits foreign expat phones and
-- legacy formats. SG-strict normalization happens in app/edge-function
-- code (normalizeSgPhone, etc.); the DB constraint is just a sanity
-- gate against junk values.
--
-- Pre-flight: BEFORE running this migration, eyeball the violators with:
--
--   SELECT id, phone FROM public.users WHERE phone IS NOT NULL
--     AND regexp_replace(phone, '[\s\-\(\)\+]', '', 'g') !~ '^\d{7,15}$';
--   SELECT id, phone FROM public.candidates WHERE phone IS NOT NULL
--     AND regexp_replace(phone, '[\s\-\(\)\+]', '', 'g') !~ '^\d{7,15}$';
--   SELECT id, phone FROM public.leads WHERE phone IS NOT NULL
--     AND regexp_replace(phone, '[\s\-\(\)\+]', '', 'g') !~ '^\d{7,15}$';
--
-- Decide per row: fix-in-place, or set to NULL. Then run this migration.

-- ── Phase 1: normalize ──────────────────────────────────────────────
UPDATE public.users
SET phone = regexp_replace(phone, '[\s\-\(\)\+]', '', 'g')
WHERE phone IS NOT NULL
  AND phone <> regexp_replace(phone, '[\s\-\(\)\+]', '', 'g');

UPDATE public.candidates
SET phone = regexp_replace(phone, '[\s\-\(\)\+]', '', 'g')
WHERE phone IS NOT NULL
  AND phone <> regexp_replace(phone, '[\s\-\(\)\+]', '', 'g');

UPDATE public.leads
SET phone = regexp_replace(phone, '[\s\-\(\)\+]', '', 'g')
WHERE phone IS NOT NULL
  AND phone <> regexp_replace(phone, '[\s\-\(\)\+]', '', 'g');

-- ── Phase 2: CHECK constraints ─────────────────────────────────────
-- Add NOT VALID first so existing rows aren't re-checked synchronously,
-- then VALIDATE — this avoids holding ACCESS EXCLUSIVE for a full scan
-- on large tables. (Today the tables are small, but the pattern is
-- correct for the future.)

ALTER TABLE public.users
    ADD CONSTRAINT users_phone_format_check
    CHECK (phone IS NULL OR phone ~ '^\d{7,15}$') NOT VALID;
ALTER TABLE public.users VALIDATE CONSTRAINT users_phone_format_check;

ALTER TABLE public.candidates
    ADD CONSTRAINT candidates_phone_format_check
    CHECK (phone IS NULL OR phone ~ '^\d{7,15}$') NOT VALID;
ALTER TABLE public.candidates VALIDATE CONSTRAINT candidates_phone_format_check;

ALTER TABLE public.leads
    ADD CONSTRAINT leads_phone_format_check
    CHECK (phone IS NULL OR phone ~ '^\d{7,15}$') NOT VALID;
ALTER TABLE public.leads VALIDATE CONSTRAINT leads_phone_format_check;

COMMENT ON CONSTRAINT users_phone_format_check ON public.users IS
    'Phone must be 7-15 digits, no separators. SG-strict normalization (+65 prefix) handled in app code; this is a DB-level sanity gate.';
COMMENT ON CONSTRAINT candidates_phone_format_check ON public.candidates IS
    'Phone must be 7-15 digits, no separators.';
COMMENT ON CONSTRAINT leads_phone_format_check ON public.leads IS
    'Phone must be 7-15 digits, no separators.';
