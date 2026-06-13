-- H5 (2026-06-12 production-readiness audit): append_invitation_file was an
-- anon-executable SECURITY DEFINER mutator.
--
-- The function appends file metadata to invitations.attached_files (row-locked
-- JSONB append) with NO auth.uid()/ownership check, yet EXECUTE was granted to
-- PUBLIC, anon, and authenticated. Because it is SECURITY DEFINER, ANY caller —
-- including unauthenticated `anon` — could write arbitrary file entries onto any
-- invitation id via POST /rest/v1/rpc/append_invitation_file. Confirmed live via
-- get_advisors (anon_security_definer_function_executable + the authenticated
-- variant) on 2026-06-12.
--
-- The ONLY legitimate caller is the staff-gated upload-invite-doc API route
-- (lyfe-sg/src/app/api/upload-invite-doc/route.ts), which calls it through the
-- service-role admin client AFTER requireStaff() + an owner/manager check and
-- PDF/size/label validation. No anon or user-session path needs it. Fix: keep
-- the body as-is, revoke EXECUTE from PUBLIC/anon/authenticated, grant it only to
-- service_role (same pattern as public.delete_candidate_cascade).
--
-- DRIFT NOTE: this function existed in the live DB but had no migration of
-- record (created out-of-band; 20260322085947_invitation_attachments only added
-- the column + bucket). This migration captures its definition verbatim
-- (pg_get_functiondef, 2026-06-13) so a fresh `supabase db reset` reproduces the
-- secured function rather than an ungoverned one.

CREATE OR REPLACE FUNCTION public.append_invitation_file(p_invitation_id uuid, p_file jsonb, p_max_files integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_current JSONB;
  v_updated JSONB;
BEGIN
  -- Lock row to prevent concurrent modifications
  SELECT COALESCE(attached_files, '[]'::jsonb)
  INTO v_current
  FROM public.invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation_not_found';
  END IF;

  IF jsonb_array_length(v_current) >= p_max_files THEN
    RAISE EXCEPTION 'max_files_exceeded';
  END IF;

  v_updated := v_current || jsonb_build_array(p_file);

  UPDATE public.invitations
  SET attached_files = v_updated
  WHERE id = p_invitation_id;

  RETURN v_updated;
END;
$function$;

-- Lock down execution to the service-role path only. CREATE OR REPLACE preserves
-- pre-existing grants, so the REVOKE is required to strip the legacy
-- PUBLIC/anon/authenticated EXECUTE; the GRANT re-affirms service_role.
REVOKE ALL ON FUNCTION public.append_invitation_file(uuid, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_invitation_file(uuid, jsonb, integer) TO service_role;

COMMENT ON FUNCTION public.append_invitation_file(uuid, jsonb, integer) IS
  'Service-role-only. Atomic row-locked append to invitations.attached_files. Caller auth + ownership are enforced upstream by the upload-invite-doc API route (requireStaff + owner/manager). EXECUTE revoked from PUBLIC/anon/authenticated per H5 audit 2026-06-12.';
