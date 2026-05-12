-- ════════════════════════════════════════════════════════════════════
-- 20260512100000 — auto-claim push_token to the most recent registrant
--
-- WHY:
--   Until now, users.push_token was only written, never invalidated when
--   a different user signed in on the same device. After several
--   sign-in/out cycles on a shared QA device, 9 different users all held
--   the same ExponentPushToken value, and every fan-out notification
--   (manager + PA, cron-driven, send-announcement, etc.) delivered N
--   pushes to that one handset.
--
--   Verified 2026-05-12 via the REST API: 9 active users all carried
--   `ExponentPushToken[eDyypjEMbCYIGEpN1rcBkL]` simultaneously. Steven
--   Teo was receiving 2× pushes for every Enneagram / DISC / profile
--   completion (manager row + PA row both delivering to the same token)
--   and ~4× pushes per event reminder (4 attendees, same token). The
--   pg_net._http_response log confirms paired `{"sent":true}` responses
--   at the exact same millisecond for these events.
--
-- WHAT THIS MIGRATION DOES:
--   1. Adds BEFORE INSERT OR UPDATE OF push_token trigger that auto-NULLs
--      any OTHER users row whose push_token already matches the incoming
--      value. Self-healing on every sign-in / biometric-unlock from any
--      client (lyfe-app native, future lyfe-sg, edge functions).
--   2. One-time backfill: NULLs every push_token currently shared by
--      2+ users. The affected users lose pushes until they next launch
--      the app and `registerPushToken` runs — at which point that single
--      user re-claims the token cleanly.
--
-- DESIGN NOTES:
--   * BEFORE trigger keeps it atomic — no race window where two rows
--     hold the same token between the dedup UPDATE and the new write.
--   * SECURITY DEFINER so the trigger can UPDATE rows owned by other
--     users (RLS would otherwise block the cross-user clear).
--   * search_path pinned to public, per the project's standing rule
--     (mutable search_path on SECURITY DEFINER was previously flagged).
--   * A UNIQUE constraint on push_token would be too strict — it would
--     raise an error on the new write rather than silently re-claiming.
--   * The condition `NEW.push_token IS NOT NULL` guarantees that setting
--     push_token to NULL (sign-out flow, or the backfill itself) does
--     NOT trip the trigger and try to clear other NULL rows.
--
-- ROLLBACK:
--   DROP TRIGGER IF EXISTS trg_users_claim_push_token ON public.users;
--   DROP FUNCTION IF EXISTS public.claim_push_token();
--   (The backfilled NULLs are not reversible from this migration — they
--    were duplicates anyway, so there's no correct value to restore.)
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.claim_push_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.push_token IS NOT NULL
     AND NEW.push_token IS DISTINCT FROM OLD.push_token THEN
    UPDATE public.users
       SET push_token = NULL
     WHERE push_token = NEW.push_token
       AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.claim_push_token() IS
  'BEFORE INSERT/UPDATE OF push_token on users. NULLs any other rows '
  'already holding the same Expo push token, so a device only ever '
  'delivers pushes to the most recently signed-in user.';

DROP TRIGGER IF EXISTS trg_users_claim_push_token ON public.users;
CREATE TRIGGER trg_users_claim_push_token
  BEFORE INSERT OR UPDATE OF push_token ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.claim_push_token();

-- ── One-time backfill ────────────────────────────────────────────────
-- NULL every push_token currently shared by 2+ users. Each affected user
-- re-registers cleanly on their next sign-in / biometric unlock via the
-- mobile app's registerPushToken().
WITH dupes AS (
  SELECT push_token
    FROM public.users
   WHERE push_token IS NOT NULL
   GROUP BY push_token
  HAVING count(*) > 1
)
UPDATE public.users SET push_token = NULL
 WHERE push_token IN (SELECT push_token FROM dupes);
