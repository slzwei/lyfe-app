-- Supabase platform shim for offline migration replay (audit C3 verification).
-- Recreates just enough of the Supabase-managed surface (roles, auth, storage,
-- vault, cron, net, realtime publication) for the repo's migrations to replay
-- on a vanilla PostgreSQL 17. Stubs are inert (no real HTTP/cron/crypto).

-- ── roles ─────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── extensions schema ─────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

-- ── auth ──────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aud text,
  role text,
  email text,
  phone text UNIQUE,
  encrypted_password text,
  email_confirmed_at timestamptz,
  phone_confirmed_at timestamptz,
  confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb DEFAULT '{}'::jsonb,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  is_super_admin boolean,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(coalesce(
    current_setting('request.jwt.claim.sub', true),
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
  ), '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon')
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

-- ── storage ───────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  owner uuid,
  public boolean DEFAULT false,
  avif_autodetection boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text,
  owner uuid,
  owner_id text,
  version text,
  metadata jsonb,
  path_tokens text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
CREATE OR REPLACE FUNCTION storage.filename(name text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)]
$$;
CREATE OR REPLACE FUNCTION storage.extension(name text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT reverse(split_part(reverse(name), '.', 1))
$$;

GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON storage.buckets, storage.objects TO anon, authenticated, service_role;

-- ── vault ─────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS vault;
CREATE TABLE IF NOT EXISTS vault.secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE,
  description text DEFAULT '',
  secret text NOT NULL,
  key_id uuid,
  nonce bytea,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE OR REPLACE VIEW vault.decrypted_secrets AS
  SELECT id, name, description, secret, secret AS decrypted_secret, key_id, nonce, created_at, updated_at
  FROM vault.secrets;
CREATE OR REPLACE FUNCTION vault.create_secret(
  new_secret text, new_name text DEFAULT NULL, new_description text DEFAULT '', new_key_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO vault.secrets (secret, name, description)
  VALUES (new_secret, new_name, new_description)
  RETURNING id
$$;
CREATE OR REPLACE FUNCTION vault.update_secret(
  secret_id uuid, new_secret text DEFAULT NULL, new_name text DEFAULT NULL, new_description text DEFAULT NULL, new_key_id uuid DEFAULT NULL
) RETURNS void LANGUAGE sql AS $$
  UPDATE vault.secrets SET
    secret = coalesce(new_secret, secret),
    name = coalesce(new_name, name),
    description = coalesce(new_description, description),
    updated_at = now()
  WHERE id = secret_id
$$;

-- ── cron (pg_cron stub) ───────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS cron;
CREATE TABLE IF NOT EXISTS cron.job (
  jobid bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  schedule text NOT NULL,
  command text NOT NULL,
  nodename text DEFAULT 'localhost',
  nodeport int DEFAULT 5432,
  database text DEFAULT current_database(),
  username text DEFAULT current_user,
  active boolean DEFAULT true,
  jobname text UNIQUE
);
CREATE TABLE IF NOT EXISTS cron.job_run_details (
  jobid bigint,
  runid bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_pid int,
  database text,
  username text,
  command text,
  status text,
  return_message text,
  start_time timestamptz,
  end_time timestamptz
);
CREATE OR REPLACE FUNCTION cron.schedule(job_name text, schedule text, command text)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v_id bigint;
BEGIN
  DELETE FROM cron.job WHERE jobname = job_name;
  INSERT INTO cron.job (schedule, command, jobname) VALUES (schedule, command, job_name)
  RETURNING jobid INTO v_id;
  RETURN v_id;
END $$;
CREATE OR REPLACE FUNCTION cron.schedule(schedule text, command text)
RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO cron.job (schedule, command) VALUES (schedule, command) RETURNING jobid
$$;
CREATE OR REPLACE FUNCTION cron.unschedule(job_name text)
RETURNS boolean LANGUAGE sql AS $$
  WITH del AS (DELETE FROM cron.job WHERE jobname = job_name RETURNING 1)
  SELECT count(*) > 0 FROM del
$$;
CREATE OR REPLACE FUNCTION cron.unschedule(job_id bigint)
RETURNS boolean LANGUAGE sql AS $$
  WITH del AS (DELETE FROM cron.job WHERE jobid = job_id RETURNING 1)
  SELECT count(*) > 0 FROM del
$$;

-- ── net (pg_net stub) ─────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS net;
CREATE TABLE IF NOT EXISTS net.http_request_queue (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  method text, url text, headers jsonb, body bytea, timeout_milliseconds int
);
CREATE TABLE IF NOT EXISTS net._http_response (
  id bigint,
  status_code int,
  content_type text,
  headers jsonb,
  content text,
  timed_out boolean,
  error_msg text,
  created timestamptz DEFAULT now()
);
CREATE OR REPLACE FUNCTION net.http_post(
  url text,
  body jsonb DEFAULT '{}'::jsonb,
  params jsonb DEFAULT '{}'::jsonb,
  headers jsonb DEFAULT '{"Content-Type": "application/json"}'::jsonb,
  timeout_milliseconds integer DEFAULT 5000
) RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO net.http_request_queue (method, url, headers, body, timeout_milliseconds)
  VALUES ('POST', url, headers, convert_to(body::text, 'UTF8'), timeout_milliseconds)
  RETURNING id
$$;
CREATE OR REPLACE FUNCTION net.http_get(
  url text,
  params jsonb DEFAULT '{}'::jsonb,
  headers jsonb DEFAULT '{}'::jsonb,
  timeout_milliseconds integer DEFAULT 5000
) RETURNS bigint LANGUAGE sql AS $$
  INSERT INTO net.http_request_queue (method, url, headers, timeout_milliseconds)
  VALUES ('GET', url, headers, timeout_milliseconds)
  RETURNING id
$$;

-- ── realtime publication ──────────────────────────────────────────────
CREATE PUBLICATION supabase_realtime;

-- ── GUCs some migrations read at apply time ───────────────────────────
-- (database-level settings are applied by verify-db-rebuild.sh, which knows
-- the scratch database's name: a dummy supabase.service_role_key plus the
-- Supabase default search_path of "$user", public, extensions — migrations
-- call pgcrypto functions like gen_random_bytes/hmac unqualified.)

-- ── default privileges (Supabase grants these on the public schema) ───
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
