-- M9 (2026-06-12 production-readiness audit; ticket opened 2026-06-13 after the
-- H5 sweep + Codex review): lock down the remaining anon-executable SECURITY
-- DEFINER functions in the public schema.
--
-- BACKGROUND
--   get_advisors(security) -> anon_security_definer_function_executable flagged
--   51 public SECURITY DEFINER functions whose EXECUTE was still held by the
--   `anon` role (51 = the count after H5 append_invitation_file, H5b
--   notify_insert, and M4 check_phone_eligible were each locked down). Root
--   cause: Supabase ships
--     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS
--       TO anon, authenticated;
--   so EVERY newly-created function is born anon/authenticated-executable, and a
--   bare `REVOKE ... FROM PUBLIC` does NOT remove those explicit role grants
--   (proven live: get_team_lead_stats, whose 20260427130800 migration revoked
--   PUBLIC and granted authenticated, still showed anon=X in proacl). Because the
--   functions are SECURITY DEFINER (owner = postgres), an `anon` grant is a real
--   privilege-escalation surface, not a cosmetic advisory.
--
-- TRIAGE — verified 2026-06-14 against live nvtedkyjwulkzjeoqjgx by cross-checking
-- pg_proc.proacl + prosecdef, pg_policies (RLS helper usage + the role each policy
-- applies to), cron.job (ownership = postgres), every supabase.rpc() call site in
-- lyfe-app and lyfe-sg, and a rolled-back `SET ROLE anon` probe (see bucket C).
-- 49 functions are locked here; 2 are intentionally left anon-executable.
--
--   A. Trigger functions (RETURNS trigger, 28). Fired only by the trigger system,
--      which executes them as the table owner WITHOUT an EXECUTE privilege check;
--      PostgREST also refuses to expose trigger-returning functions over /rpc.
--      No application code calls them. -> REVOKE from PUBLIC, anon, authenticated.
--
--   B. Cron-only maintenance (2): cleanup_old_notifications + cleanup_orphaned_users
--      are invoked by pg_cron jobs 6 & 7, which run as `postgres` (owner keeps
--      EXECUTE). They delete / deactivate rows with no auth check and have no
--      client caller. -> REVOKE from PUBLIC, anon, authenticated; GRANT service_role.
--
--   C. Authenticated callers + authenticated-only RLS helpers (19). Drop anon,
--      keep authenticated + service_role.
--        * Self-guarding RPCs called by logged-in users (lyfe-app supabase.rpc with
--          a user JWT): get_exam_questions, submit_exam_attempt (x3 overloads),
--          sync_auth_metadata, get_lead_pipeline_stats (x2), list_agents_for_reassign,
--          reassign_agent_upline, create_roadshow_bulk, create_lead_with_activity,
--          assign_lead_with_activity, update_lead_status_with_activity,
--          get_team_lead_stats. Each mutating one already rejects `auth.uid() IS NULL`
--          and re-derives ownership server-side (never trusts client ids — see H1
--          migration 20260612000000), so the anon grant was already a no-op. The
--          sharp edge was get_exam_questions: it strips correct_answer for non-admins
--          but did NOT reject anonymous callers, so anon could read exam / personality
--          question CONTENT one paper id at a time.
--        * RLS helper functions used ONLY in `TO authenticated` policies:
--          can_access_candidate (candidates / candidate_activities / candidate_documents
--          / interviews / enrollment_upsert), can_access_lead (leads / lead_activities),
--          get_team_member_ids (exam_attempts). Policies are role-scoped, so they are
--          NEVER evaluated for the anon role — confirmed by a rolled-back probe: after
--          `REVOKE ... FROM anon`, `SET ROLE anon; SELECT FROM leads/candidates/
--          exam_attempts` returned 0 rows with NO "permission denied for function".
--          Revoking anon is therefore the correct follow-through now that those
--          policies are already authenticated-scoped.
--        * auth_user_role, can_manage_event: same RLS-helper family, currently
--          referenced by no policy and no function body, and they key off auth.uid()
--          (return nothing to anon). Locked to authenticated for consistency.
--
--   KEPT anon-executable BY DESIGN (NOT touched; 2 functions):
--      * get_enneagram_sampler_questions — the public Enneagram sampler the lyfe-sg
--        marketing / quiz surface calls before auth (5 call sites). Returns sampler
--        questions only, no scoring keys.
--      * can_access_candidate_user — invoked by the `TO public` SELECT/UPDATE
--        policies on candidate_programme_enrollment, where anon holds Supabase's
--        default table grants; revoking anon would turn a (legitimately empty) anon
--        query into "permission denied for function" rather than zero rows. The clean
--        path is to first narrow those two policies to `TO authenticated`, then revoke
--        — tracked as a separate follow-up (touches RLS policy definitions, not grants).
--
-- DRIFT FLAGGED (pre-existing, NOT introduced here): five functions touched below
-- exist in the live DB but have NO canonical CREATE in supabase/migrations/ (created
-- via the Dashboard, like the lead RPCs codified in 20260612000000):
--   * trigger fns: alert_candidate_deleted, complete_module_item_on_exam_submit
--   * RPC:         create_lead_with_activity
--   * RLS helpers: auth_user_role, can_manage_event
-- To keep this migration replayable on a fresh `supabase db reset`, every statement
-- below is wrapped in a `to_regprocedure(...) IS NOT NULL` guard and is a no-op for
-- any absent function. Codifying those five (and the two trigger fns' triggers)
-- into the canonical chain belongs in a follow-up.
--
-- Privilege-only change (no function bodies change). REVOKE/GRANT are idempotent.

DO $m9$
DECLARE
  -- A. Trigger functions (28) — fire as owner; never client-callable.
  a_sigs text[] := ARRAY[
    'public.alert_candidate_deleted()','public.claim_push_token()','public.complete_module_item_on_exam_submit()',
    'public.create_candidate_profile_on_insert()','public.guard_user_self_update()','public.handle_new_user()',
    'public.leads_notify_mktr_outcome()','public.notify_mktr_user_change()','public.notify_progress_change()',
    'public.notify_push_dispatcher()','public.sync_candidate_status_to_lifecycle()','public.sync_role_to_jwt()',
    'public.trigger_notify_candidate_assigned()','public.trigger_notify_candidate_update()','public.trigger_notify_disc_completed()',
    'public.trigger_notify_enneagram_completed()','public.trigger_notify_interview_scheduled()','public.trigger_notify_interview_updated()',
    'public.trigger_notify_invite_accepted()','public.trigger_notify_lead_milestone()','public.trigger_notify_lead_reassigned()',
    'public.trigger_notify_module_completed()','public.trigger_notify_new_manager_joined()','public.trigger_notify_profile_completed()',
    'public.trigger_notify_roadmap_unlocked()','public.validate_candidate_manager_role()','public.validate_reports_to_role()',
    'public.zzz_audit_trigger()'
  ];
  -- B. Cron-only maintenance (2) — run as postgres via pg_cron; lock to service_role.
  b_sigs text[] := ARRAY['public.cleanup_old_notifications()','public.cleanup_orphaned_users()'];
  -- C. Authenticated callers + authenticated-only RLS helpers (19) — drop anon.
  c_sigs text[] := ARRAY[
    'public.get_exam_questions(uuid)',
    'public.submit_exam_attempt(uuid, uuid, text, integer, timestamp with time zone, timestamp with time zone, integer, jsonb, jsonb)',
    'public.submit_exam_attempt(uuid, uuid, text, integer, integer, integer, boolean, timestamp with time zone, timestamp with time zone, integer, jsonb, jsonb)',
    'public.submit_exam_attempt(uuid, uuid, text, integer, integer, integer, boolean, timestamp with time zone, timestamp with time zone, integer, jsonb, jsonb, text)',
    'public.sync_auth_metadata()','public.get_lead_pipeline_stats(uuid)','public.get_lead_pipeline_stats(uuid, boolean)',
    'public.list_agents_for_reassign()','public.reassign_agent_upline(uuid, uuid)','public.create_roadshow_bulk(jsonb, jsonb, jsonb, uuid)',
    'public.create_lead_with_activity(text, text, text, text, text, text, uuid)','public.assign_lead_with_activity(uuid, uuid, uuid)',
    'public.update_lead_status_with_activity(uuid, text, text, uuid)','public.get_team_lead_stats(uuid[], integer)',
    'public.can_access_candidate(uuid, uuid)','public.can_access_lead(uuid, uuid)','public.get_team_member_ids(uuid)',
    'public.auth_user_role()','public.can_manage_event(uuid)'
  ];
  sig text;
BEGIN
  FOREACH sig IN ARRAY a_sigs LOOP
    IF to_regprocedure(sig) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
    END IF;
  END LOOP;

  FOREACH sig IN ARRAY b_sigs LOOP
    IF to_regprocedure(sig) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);
    END IF;
  END LOOP;

  FOREACH sig IN ARRAY c_sigs LOOP
    IF to_regprocedure(sig) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', sig);
    END IF;
  END LOOP;
END
$m9$;

-- Document the priority-1 finding on the function itself (mirrors the H5/M4 style).
DO $cmt$
BEGIN
  IF to_regprocedure('public.get_exam_questions(uuid)') IS NOT NULL THEN
    EXECUTE $c$COMMENT ON FUNCTION public.get_exam_questions(uuid) IS 'Returns a paper''s questions; strips correct_answer for non-admin callers. EXECUTE revoked from PUBLIC/anon per M9 audit 2026-06-14 — it did not reject anonymous callers, so anon could read exam/personality question content. Kept executable by authenticated (exam-taking flow) + service_role.'$c$;
  END IF;
END
$cmt$;
