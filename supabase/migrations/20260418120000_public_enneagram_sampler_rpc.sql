-- Public RPC to fetch Enneagram Sampler questions without requiring auth.
-- The quiz is a shareable public page; exam_questions RLS remains locked to
-- admin/director. This RPC narrows the exposed columns to what the quiz needs
-- (question_number, options, explanation) and is SECURITY DEFINER so it runs
-- as the owner of the function, bypassing RLS.

CREATE OR REPLACE FUNCTION public.get_enneagram_sampler_questions()
RETURNS TABLE (
    question_number integer,
    options jsonb,
    explanation text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT eq.question_number, eq.options, eq.explanation
    FROM public.exam_questions eq
    JOIN public.exam_papers ep ON ep.id = eq.paper_id
    WHERE ep.code = 'ENNEAGRAM_SAMPLER'
    ORDER BY eq.question_number
$$;

REVOKE ALL ON FUNCTION public.get_enneagram_sampler_questions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_enneagram_sampler_questions() TO anon, authenticated;
