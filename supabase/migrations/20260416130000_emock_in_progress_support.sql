ALTER TABLE public.emock_attempts ADD COLUMN status TEXT NOT NULL DEFAULT 'completed';
ALTER TABLE public.emock_attempts ADD COLUMN started_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.emock_attempts ALTER COLUMN score DROP NOT NULL;
ALTER TABLE public.emock_attempts ALTER COLUMN total DROP NOT NULL;
ALTER TABLE public.emock_attempts ALTER COLUMN passed DROP NOT NULL;
ALTER TABLE public.emock_attempts ALTER COLUMN time_taken_seconds DROP NOT NULL;
ALTER TABLE public.emock_attempts ALTER COLUMN completed_at DROP NOT NULL;
ALTER TABLE public.emock_attempts ALTER COLUMN completed_at DROP DEFAULT;

CREATE POLICY "Users update own in-progress attempts" ON public.emock_attempts
  FOR UPDATE USING (auth.uid() = user_id AND status = 'in_progress');

CREATE POLICY "Users delete own in-progress attempts" ON public.emock_attempts
  FOR DELETE USING (auth.uid() = user_id AND status = 'in_progress');

CREATE INDEX idx_emock_attempts_in_progress
  ON public.emock_attempts(user_id, module_id, quiz_id)
  WHERE status = 'in_progress';
