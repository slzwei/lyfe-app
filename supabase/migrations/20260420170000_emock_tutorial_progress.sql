CREATE TABLE public.emock_tutorial_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL,
  chapter_key TEXT NOT NULL,
  question_key TEXT NOT NULL,
  selected_letter TEXT NOT NULL CHECK (selected_letter IN ('A','B','C','D','E')),
  is_correct BOOLEAN NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_id, chapter_key, question_key)
);

CREATE INDEX idx_emock_tutorial_user_mod_chap
  ON public.emock_tutorial_progress (user_id, module_id, chapter_key);

ALTER TABLE public.emock_tutorial_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own tutorial progress" ON public.emock_tutorial_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own tutorial progress" ON public.emock_tutorial_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own tutorial progress" ON public.emock_tutorial_progress
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own tutorial progress" ON public.emock_tutorial_progress
  FOR DELETE USING (auth.uid() = user_id);
