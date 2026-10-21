-- FuturePay Studio (ilp-calc, the advisers' plan presentation app): each adviser's clients, and the plans each
-- client already holds or is being proposed. Only that web app writes here, signed in as the adviser; there are no
-- service-role or edge-function writes. A row belongs to the adviser who made it, and only that adviser reads or
-- changes it. Whether managers see their team's clients is a later decision. Advisers are the roles that present
-- plans to clients: admin, director, manager, agent. The role check uses the JWT, because joining users inside a
-- policy recurses (see the shared-supabase reference).

CREATE TABLE public.pf_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adviser_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 1 AND 120),
  date_of_birth date NOT NULL CHECK (date_of_birth BETWEEN DATE '1900-01-01' AND DATE '2100-12-31'),
  sex text NOT NULL CHECK (sex IN ('male', 'female')),
  smoker boolean NOT NULL,
  -- Optional contact. The phone is international form, +65XXXXXXXX for Singapore (candidate_profiles' format).
  phone text CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$'),
  email text CHECK (email IS NULL OR (char_length(email) <= 254 AND position('@' in email) > 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pf_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.pf_clients(id) ON DELETE CASCADE,
  adviser_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE CASCADE,
  -- The app's product module, e.g. 'hsbc-ifi'.
  product_id text NOT NULL CHECK (product_id ~ '^[a-z0-9][a-z0-9-]{1,63}$'),
  -- A plan the client already holds, or one the adviser is proposing.
  status text NOT NULL CHECK (status IN ('proposed', 'owned')),
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 200),
  -- Which of the app's three plan colours the plan wears, or null for the story's ink.
  colour_slot smallint CHECK (colour_slot BETWEEN 1 AND 3),
  -- The product's own saved plan, read by its module in the app (for IFI: the illustration or estimate as the story
  -- reads it, with the income start age). Figures only, never PDF bytes: those stay on the adviser's device.
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object' AND octet_length(data::text) <= 4194304),
  data_version integer NOT NULL DEFAULT 1 CHECK (data_version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- A removed plan is kept, so the adviser can undo it and every device of theirs sees it go.
  deleted_at timestamptz
);

CREATE INDEX idx_pf_clients_adviser ON public.pf_clients (adviser_id, updated_at DESC);
CREATE INDEX idx_pf_plans_client ON public.pf_plans (client_id);
CREATE INDEX idx_pf_plans_adviser ON public.pf_plans (adviser_id, updated_at DESC);

CREATE TRIGGER pf_clients_updated_at BEFORE UPDATE ON public.pf_clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER pf_plans_updated_at BEFORE UPDATE ON public.pf_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.pf_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pf_plans ENABLE ROW LEVEL SECURITY;

-- Signed-out requests never reach these tables, whatever the policies.
REVOKE ALL ON public.pf_clients, public.pf_plans FROM anon;

CREATE POLICY pf_clients_adviser_select ON public.pf_clients
  FOR SELECT TO authenticated
  USING (
    adviser_id = (SELECT auth.uid())
    AND ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'agent')
  );

CREATE POLICY pf_clients_adviser_insert ON public.pf_clients
  FOR INSERT TO authenticated
  WITH CHECK (
    adviser_id = (SELECT auth.uid())
    AND ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'agent')
  );

CREATE POLICY pf_clients_adviser_update ON public.pf_clients
  FOR UPDATE TO authenticated
  USING (
    adviser_id = (SELECT auth.uid())
    AND ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'agent')
  )
  WITH CHECK (adviser_id = (SELECT auth.uid()));

CREATE POLICY pf_clients_adviser_delete ON public.pf_clients
  FOR DELETE TO authenticated
  USING (
    adviser_id = (SELECT auth.uid())
    AND ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'agent')
  );

-- A plan can only sit under one of the adviser's own clients.
CREATE POLICY pf_plans_adviser_select ON public.pf_plans
  FOR SELECT TO authenticated
  USING (
    adviser_id = (SELECT auth.uid())
    AND ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'agent')
  );

CREATE POLICY pf_plans_adviser_insert ON public.pf_plans
  FOR INSERT TO authenticated
  WITH CHECK (
    adviser_id = (SELECT auth.uid())
    AND ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'agent')
    AND EXISTS (SELECT 1 FROM public.pf_clients c WHERE c.id = client_id AND c.adviser_id = (SELECT auth.uid()))
  );

CREATE POLICY pf_plans_adviser_update ON public.pf_plans
  FOR UPDATE TO authenticated
  USING (
    adviser_id = (SELECT auth.uid())
    AND ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'agent')
  )
  WITH CHECK (
    adviser_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.pf_clients c WHERE c.id = client_id AND c.adviser_id = (SELECT auth.uid()))
  );

CREATE POLICY pf_plans_adviser_delete ON public.pf_plans
  FOR DELETE TO authenticated
  USING (
    adviser_id = (SELECT auth.uid())
    AND ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'agent')
  );
