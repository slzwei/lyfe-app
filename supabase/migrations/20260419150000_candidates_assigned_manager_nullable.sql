-- Make candidates.assigned_manager_id nullable to match the business rule
-- ("candidates can be unassigned"). The column was created NOT NULL in
-- initial_schema.sql but that's stricter than the intent. The companion
-- trigger from 20260419140000 already handles the NULL case explicitly.

ALTER TABLE public.candidates
    ALTER COLUMN assigned_manager_id DROP NOT NULL;

COMMENT ON COLUMN public.candidates.assigned_manager_id IS
    'Manager or director currently holding this candidate. NULL means unassigned.';
