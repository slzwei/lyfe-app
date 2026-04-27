-- PDPA-compliant consent tracking on `public.users`. Singapore's Personal
-- Data Protection Act §13 requires positive consent before personal data
-- collection or use; §36 requires marketing opt-in to be a separate
-- decision from operational consent.
--
-- We store four timestamps so that:
--   1. Withdrawing one type of consent later doesn't void the others.
--   2. Auditors can see when each consent was given (the timestamp is the
--      proof — NULL means "not yet consented").
--   3. The send-announcement edge function can filter recipients by the
--      relevant consent for any given message type (operational vs marketing).
--
-- Grandfathering existing users: every active user as of this migration
-- has been using the app under the implicit/legacy ToS, so we backfill
-- the three OPERATIONAL consents (T&C, Privacy, Operational Push) to
-- now(). Marketing consent stays NULL — that requires explicit opt-in,
-- which the next launch will collect via an in-app prompt or the
-- onboarding flow for new users.
--
-- New users (signing up after this migration) hit the Consent screen at
-- onboarding and the AuthGate blocks app entry until the three required
-- consents are populated.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS consent_tos_at timestamptz,
    ADD COLUMN IF NOT EXISTS consent_privacy_at timestamptz,
    ADD COLUMN IF NOT EXISTS consent_operational_push_at timestamptz,
    ADD COLUMN IF NOT EXISTS consent_marketing_at timestamptz;

-- Grandfather existing active users — they've effectively consented by
-- using the app under the prior implicit terms. Marketing stays NULL.
UPDATE public.users
SET
    consent_tos_at = COALESCE(consent_tos_at, now()),
    consent_privacy_at = COALESCE(consent_privacy_at, now()),
    consent_operational_push_at = COALESCE(consent_operational_push_at, now())
WHERE is_active = true;

COMMENT ON COLUMN public.users.consent_tos_at IS
    'PDPA: timestamp the user accepted the Terms of Service. NULL = not yet consented; access blocked at AuthGate. NOT cleared on signOut.';
COMMENT ON COLUMN public.users.consent_privacy_at IS
    'PDPA: timestamp the user accepted the Privacy Policy. NULL = not yet consented; access blocked at AuthGate.';
COMMENT ON COLUMN public.users.consent_operational_push_at IS
    'PDPA: timestamp the user opted in to operational push notifications (lead alerts, event reminders, system messages). Distinct from marketing consent per PDPA §36.';
COMMENT ON COLUMN public.users.consent_marketing_at IS
    'PDPA §36: timestamp the user opted in to marketing messages (announcements, promotions). NULL = NOT consented; send-announcement filters out non-consenting recipients when is_marketing=true.';

-- Allow users to update their own consent columns. The guard_user_self_update
-- trigger pins role/is_active/etc. — we need consent fields explicitly
-- writable by the user themself (no service-role-only restriction).
-- The existing UPDATE policy on users (auth.uid() = id) already covers this;
-- no policy change required since the columns are part of the same row.
