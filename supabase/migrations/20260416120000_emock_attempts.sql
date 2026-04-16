CREATE TABLE public.emock_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  quiz_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  time_taken_seconds INTEGER NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  parts JSONB,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_emock_attempts_user ON public.emock_attempts(user_id, module_id, quiz_id);
CREATE INDEX idx_emock_attempts_completed ON public.emock_attempts(completed_at DESC);

ALTER TABLE public.emock_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own attempts" ON public.emock_attempts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own attempts" ON public.emock_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
