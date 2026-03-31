
-- Add staff attribution column to invitations
-- Links each invitation to the staff user who created it
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS invited_by_user_id uuid REFERENCES public.users(id);
