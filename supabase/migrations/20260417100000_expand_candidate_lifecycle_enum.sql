-- Phase A1: expand candidate_status + lifecycle_stage enums
--
-- Adds three new stages used by the recruitment lifecycle rewrite:
--   eapp_done  — manager has accepted the candidate; replaces legacy 'approved'
--   on_hold    — paused; previous stage preserved in candidates.stage_before_hold
--   rejected   — terminal; hidden from ATS lists by default, records kept
--
-- MUST be deployed BEFORE migration 20260417100100_candidate_lifecycle_tables.sql.
-- Postgres forbids using a newly-added enum value in the same transaction it was
-- added. By isolating the ADD VALUEs in their own migration, the values commit
-- cleanly and are available to the next migration.
--
-- The legacy value 'approved' is intentionally NOT dropped. Removing an enum
-- value requires recreating the type and is unsafe with existing rows.
-- Existing 'approved' rows are backfilled to 'eapp_done' in migration A2.

ALTER TYPE candidate_status ADD VALUE IF NOT EXISTS 'eapp_done' AFTER 'interviewed';
ALTER TYPE candidate_status ADD VALUE IF NOT EXISTS 'on_hold';
ALTER TYPE candidate_status ADD VALUE IF NOT EXISTS 'rejected';

ALTER TYPE lifecycle_stage ADD VALUE IF NOT EXISTS 'eapp_done' AFTER 'interviewed';
ALTER TYPE lifecycle_stage ADD VALUE IF NOT EXISTS 'on_hold';
ALTER TYPE lifecycle_stage ADD VALUE IF NOT EXISTS 'rejected';
