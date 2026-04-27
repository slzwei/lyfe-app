-- Add 'unassignment' to the lead_activity_type enum.
--
-- Surfaced by the synthetic mktr-lead-unassigned probe (see
-- docs/synthetic-monitoring-audit.md, R1c).
--
-- The receive-mktr-lead edge function (supabase/functions/receive-mktr-lead/
-- index.ts:170) inserts a lead_activities row with type='unassignment'
-- whenever MKTR sends a lead.unassigned event. The enum has never had this
-- value, so the INSERT silently fails (the edge fn does not check the
-- error). Result: every lead.unassigned event has been losing its audit
-- trail since the feature shipped.
--
-- ALTER TYPE ... ADD VALUE IF NOT EXISTS is idempotent and supported inside
-- a transaction on PG12+. The new value isn't used in this migration, so
-- there is no commit-visibility issue.

ALTER TYPE public.lead_activity_type ADD VALUE IF NOT EXISTS 'unassignment';
