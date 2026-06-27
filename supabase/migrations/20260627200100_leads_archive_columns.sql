-- Leads parity (Phase 0): reversible soft-archive for leads.
--
-- Mirrors candidates.archived_at / archived_by_id (20260522085112). Archiving
-- HIDES a lead from the agent's active list; it NEVER deletes (D2 = archive-only,
-- no agent delete). Reversible (unarchive). assigned_to is preserved.
--
-- ⚠️ Every ACTIVE lead query must filter `archived_at IS NULL` — app reads AND the
-- aggregate RPCs get_lead_pipeline_stats / get_team_lead_stats (done in Phase 5).
--
-- RLS unchanged: the existing row-scoped leads UPDATE policy already lets an owner
-- update their lead (the app does status UPDATEs today); archived_at is just
-- another column on that same row, so no new policy is needed. Nullable columns
-- ⇒ backward-compatible with receive-mktr-lead inserts.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by_id uuid;

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_archived_by_id_fkey;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_archived_by_id_fkey
  FOREIGN KEY (archived_by_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- archived_by_id may only be set when archived_at is set.
ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_archived_by_requires_at;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_archived_by_requires_at CHECK (
    (archived_at IS NULL AND archived_by_id IS NULL)
    OR archived_at IS NOT NULL
  );

-- Partial index for the active-list hot path (assigned_to scan, active rows only).
CREATE INDEX IF NOT EXISTS idx_leads_active_assigned_to
  ON public.leads (assigned_to) WHERE archived_at IS NULL;
