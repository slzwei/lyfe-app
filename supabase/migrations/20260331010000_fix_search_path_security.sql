-- Fix SECURITY DEFINER functions missing SET search_path
-- From production readiness audit 2026-03-31 (Phase 1, Task 1)
-- search_path injection allows privilege escalation on SECURITY DEFINER functions

-- ═══════════════════════════════════════════════════════════════════
-- 1. notify_progress_change (SECURITY DEFINER)
--    Fires on candidate_profiles, disc_responses, disc_results, invitations
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.notify_progress_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE progress_signals SET updated_at = now() WHERE id = 1;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. sync_candidate_status_to_lifecycle (SECURITY DEFINER)
--    Fires on candidates UPDATE — syncs status to users.lifecycle_stage
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.sync_candidate_status_to_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE users SET lifecycle_stage = NEW.status::text::lifecycle_stage
    FROM candidate_profiles cp
    WHERE cp.candidate_id = NEW.id
      AND users.id = cp.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. create_candidate_profile_on_insert (SECURITY DEFINER)
--    Fires on candidates INSERT — queries auth.users by phone
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_candidate_profile_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_user_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM candidate_profiles WHERE candidate_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO matched_user_id
  FROM auth.users
  WHERE phone = NEW.phone
  LIMIT 1;

  IF matched_user_id IS NOT NULL THEN
    INSERT INTO candidate_profiles (user_id, full_name, email, contact_number, candidate_id)
    VALUES (matched_user_id, NEW.name, NEW.email, NEW.phone, NEW.id)
    ON CONFLICT (user_id) DO UPDATE SET candidate_id = NEW.id
    WHERE candidate_profiles.candidate_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 4. update_updated_at (not SECURITY DEFINER, but widely used trigger)
--    Was correct in 20260305100456 but lost search_path in 006_hardening
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 5. delete_candidate (not SECURITY DEFINER, called via service-role)
--    Uses unqualified table names — pin search_path for safety
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.delete_candidate(p_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.invitations WHERE id = p_invitation_id;

  IF v_user_id IS NOT NULL THEN
    DELETE FROM public.disc_results WHERE user_id = v_user_id;
    DELETE FROM public.disc_responses WHERE user_id = v_user_id;
    DELETE FROM public.candidate_profiles WHERE user_id = v_user_id;
  END IF;

  DELETE FROM public.invitations WHERE id = p_invitation_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 6. normalize_phone (not SECURITY DEFINER, but fires on sensitive tables)
--    Triggers on users, candidates, leads, member_invitations
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.normalize_phone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND NEW.phone LIKE '+%' THEN
    NEW.phone := substr(NEW.phone, 2);
  END IF;
  RETURN NEW;
END;
$$;
