-- 006_hardening.sql
-- Brings Dashboard-created objects into version control and adds new objects.

-- 1. results_email column (already exists in live DB via Dashboard; safe for fresh deploys)
ALTER TABLE public.disc_results ADD COLUMN IF NOT EXISTS results_email text;

-- 2. assign_candidate_role RPC (already exists in live DB via Dashboard)
--    Sets app_metadata.role = 'candidate' for the calling user.
--    SECURITY DEFINER so it can write to auth.users.
CREATE OR REPLACE FUNCTION public.assign_candidate_role()
RETURNS void AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data =
    COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "candidate"}'::jsonb
  WHERE id = auth.uid()
    AND (raw_app_meta_data->>'role' IS NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Auto-update updated_at on candidate_profiles
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_updated_at'
  ) THEN
    CREATE TRIGGER trg_profiles_updated_at
      BEFORE UPDATE ON public.candidate_profiles
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

-- 4. Staff sessions table (replaces plaintext-password cookie auth)
CREATE TABLE IF NOT EXISTS public.staff_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
ALTER TABLE public.staff_sessions ENABLE ROW LEVEL SECURITY;
-- No RLS policies: accessed only via service-role client

-- 5. Transactional candidate deletion RPC
--    Called via service-role client (bypasses RLS). No SECURITY DEFINER needed.
CREATE OR REPLACE FUNCTION public.delete_candidate(p_invitation_id uuid)
RETURNS void AS $$
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
$$ LANGUAGE plpgsql;
