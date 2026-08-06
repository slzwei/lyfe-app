-- Deleting a callback log left its activity-timeline breadcrumb behind —
-- there was no link between the two. Give breadcrumbs a callback_id FK that
-- CASCADEs, so the DB removes the breadcrumb atomically with the callback.
ALTER TABLE public.candidate_activities
  ADD COLUMN callback_id uuid REFERENCES public.candidate_callbacks(id) ON DELETE CASCADE;

-- Cascade deletes look up activities by callback_id; partial index keeps it
-- cheap without bloating the (mostly-null) column.
CREATE INDEX idx_candidate_activities_callback_id
  ON public.candidate_activities (callback_id)
  WHERE callback_id IS NOT NULL;

-- Backfill breadcrumbs written before this column existed: same candidate,
-- same author, written within seconds after the callback row.
UPDATE public.candidate_activities a
SET callback_id = c.id
FROM public.candidate_callbacks c
WHERE a.callback_id IS NULL
  AND a.type = 'call'
  AND a.note LIKE 'Callback on %'
  AND a.candidate_id = c.candidate_id
  AND a.user_id = c.logged_by_user_id
  AND a.created_at BETWEEN c.created_at AND c.created_at + interval '5 seconds';
