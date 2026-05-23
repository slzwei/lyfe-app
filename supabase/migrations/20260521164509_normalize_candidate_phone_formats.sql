-- Candidate Invite Parity — phone format normalization + backfill
--
-- Source-of-truth storage formats:
--   public.candidates.phone               65XXXXXXXX
--   public.users.phone                    65XXXXXXXX
--   public.member_invitations.phone       65XXXXXXXX
--   public.candidate_profiles.contact_number   +65XXXXXXXX
--
-- public.normalize_sg_phone(text) already exists (migration
-- 20260405000000_phone_eligibility_check.sql) and returns 65XXXXXXXX or NULL.
--
-- Preflight audit (run manually before/after to confirm counts — not executed
-- by this migration):
--
--   select 'candidates.phone' as field,
--     count(*) filter (where phone ~ '^[89][0-9]{7}$')        as raw_8_digit,
--     count(*) filter (where phone ~ '^65[89][0-9]{7}$')      as normalized_65,
--     count(*) filter (where phone ~ '^\+65[89][0-9]{7}$')    as plus_65_compact,
--     count(*) filter (where phone ~ '\s')                    as contains_spaces,
--     count(*) filter (where phone is not null and btrim(phone) <> ''
--       and public.normalize_sg_phone(phone) is null)         as invalid_sg
--   from public.candidates;  -- repeat per table
--
-- Backfill rules:
--   * Only rows whose value normalizes to a valid SG phone are rewritten.
--   * Non-SG / invalid values are LEFT UNTOUCHED for manual review.
--   * invitations.email is intentionally NOT modified here — phone-like or
--     synthetic emails must be inspected manually before any rewrite.
--
-- Verified before applying (production audit, 2026-05-21): the three phone
-- backfills change 0 rows (data already normalized); contact_number changes
-- exactly 1 row. No unique constraint exists on any updated column except the
-- partial unique index on member_invitations(phone) WHERE status='pending',
-- which the 0-row UPDATE cannot violate.

-- ── 1. Backfill SG phone rows to 65XXXXXXXX ────────────────────────────────

UPDATE public.candidates
SET phone = public.normalize_sg_phone(phone)
WHERE phone IS NOT NULL
  AND public.normalize_sg_phone(phone) IS NOT NULL
  AND phone IS DISTINCT FROM public.normalize_sg_phone(phone);

UPDATE public.users
SET phone = public.normalize_sg_phone(phone)
WHERE phone IS NOT NULL
  AND public.normalize_sg_phone(phone) IS NOT NULL
  AND phone IS DISTINCT FROM public.normalize_sg_phone(phone);

UPDATE public.member_invitations
SET phone = public.normalize_sg_phone(phone)
WHERE phone IS NOT NULL
  AND public.normalize_sg_phone(phone) IS NOT NULL
  AND phone IS DISTINCT FROM public.normalize_sg_phone(phone);

-- candidate_profiles.contact_number uses the +65XXXXXXXX display-compact form.
UPDATE public.candidate_profiles
SET contact_number = '+' || public.normalize_sg_phone(contact_number)
WHERE contact_number IS NOT NULL
  AND public.normalize_sg_phone(contact_number) IS NOT NULL
  AND contact_number IS DISTINCT FROM ('+' || public.normalize_sg_phone(contact_number));

-- ── 2. Fix the auto-profile trigger to write +65XXXXXXXX contact numbers ───
--
-- When a candidates row is inserted, this trigger bridges mobile-created
-- candidates to the lyfe-sg profile/onboarding system. candidates.phone is
-- now stored as 65XXXXXXXX, but candidate_profiles.contact_number must be the
-- +65XXXXXXXX form the onboarding form expects.

CREATE OR REPLACE FUNCTION create_candidate_profile_on_insert()
RETURNS trigger AS $$
DECLARE
  matched_user_id uuid;
  v_contact_number text;
BEGIN
  -- Skip if this candidate already has a linked profile
  IF EXISTS (SELECT 1 FROM candidate_profiles WHERE candidate_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Try to find an auth user by phone match
  SELECT id INTO matched_user_id
  FROM auth.users
  WHERE phone = NEW.phone
  LIMIT 1;

  IF matched_user_id IS NOT NULL THEN
    -- Write contact_number in +65XXXXXXXX form when the candidate phone is a
    -- valid SG mobile; otherwise fall back to the raw value.
    IF public.normalize_sg_phone(NEW.phone) IS NOT NULL THEN
      v_contact_number := '+' || public.normalize_sg_phone(NEW.phone);
    ELSE
      v_contact_number := NEW.phone;
    END IF;

    -- Create profile linked to both the auth user and the candidate record
    INSERT INTO candidate_profiles (user_id, full_name, email, contact_number, candidate_id)
    VALUES (matched_user_id, NEW.name, NEW.email, v_contact_number, NEW.id)
    ON CONFLICT (user_id) DO UPDATE SET candidate_id = NEW.id
    WHERE candidate_profiles.candidate_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
