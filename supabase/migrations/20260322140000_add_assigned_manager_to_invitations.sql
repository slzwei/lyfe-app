-- Add assigned_manager_id to invitations table.
-- When a PA sends an invite, they pick a manager/director to assign the candidate to.
-- NULL means use invited_by_user_id as fallback (preserves existing behavior).

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS assigned_manager_id uuid REFERENCES public.users(id);

CREATE INDEX IF NOT EXISTS idx_invitations_assigned_manager
  ON public.invitations(assigned_manager_id)
  WHERE assigned_manager_id IS NOT NULL;
