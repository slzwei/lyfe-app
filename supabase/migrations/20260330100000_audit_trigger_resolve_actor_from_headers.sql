-- Update audit trigger to resolve actor from custom request headers
-- when auth.uid() is not available (service-role client with actor context).
-- The app sends x-actor-id and x-actor-role headers via the Supabase client
-- so the trigger can attribute changes to the correct staff member.
--
-- Note: Supabase PostgREST does NOT set individual request.header.<name> GUCs.
-- Instead, all headers are available as a JSON object in request.headers (plural).

CREATE OR REPLACE FUNCTION public.zzz_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id   uuid;
  v_actor_role text;
  v_source     text;
  v_old        jsonb;
  v_new        jsonb;
  v_headers    json;
BEGIN
  -- Never let audit logging break a business operation
  BEGIN
    -- Resolve actor via fallback chain:
    -- 1. auth.uid() — normal authenticated user
    -- 2. JWT claims sub — alternative JWT format
    -- 3. x-actor-id from request headers JSON — service-role client with actor context
    v_actor_id := COALESCE(
      auth.uid(),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
    );

    -- If still null, try custom header from raw headers JSON
    IF v_actor_id IS NULL THEN
      v_headers := nullif(current_setting('request.headers', true), '')::json;
      IF v_headers IS NOT NULL THEN
        v_actor_id := (v_headers ->> 'x-actor-id')::uuid;
      END IF;
    END IF;

    -- Resolve role from JWT, then fall back to custom header
    v_actor_role := (
      nullif(current_setting('request.jwt.claims', true), '')::jsonb
      -> 'app_metadata' ->> 'role'
    );
    IF v_actor_role IS NULL AND v_headers IS NOT NULL THEN
      v_actor_role := v_headers ->> 'x-actor-role';
    END IF;

    -- Determine source context
    IF v_actor_id IS NOT NULL THEN
      v_source := 'app';
    ELSIF current_user IN ('supabase_admin', 'postgres') THEN
      v_source := 'dashboard';
    ELSE
      v_source := 'service_role';
    END IF;

    -- Serialize row data
    IF TG_OP = 'DELETE' THEN
      v_old := row_to_json(OLD)::jsonb;
      v_new := NULL;
    ELSIF TG_OP = 'INSERT' THEN
      v_old := NULL;
      v_new := row_to_json(NEW)::jsonb;
    ELSE -- UPDATE
      v_old := row_to_json(OLD)::jsonb;
      v_new := row_to_json(NEW)::jsonb;
    END IF;

    INSERT INTO public.audit_log (table_name, operation, actor_id, actor_role, source, old_data, new_data, tx_id)
    VALUES (TG_TABLE_NAME, TG_OP, v_actor_id, v_actor_role, v_source, v_old, v_new, txid_current());

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[audit_log] write failed on %.%: %', TG_TABLE_NAME, TG_OP, SQLERRM;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;
