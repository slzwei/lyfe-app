-- Fix Enneagram Sampler quiz:
--   1. Restore official RHETI Sampler wording for Q6, Q23, Q26, Q31, Q35.
--   2. Replace type mappings for all 36 questions with corrected SCORING_KEY.
--
-- Adds empty C/D keys because `chk_options_shape` (CHECK with NOT VALID)
-- now requires A/B/C/D on any modified row.

DO $$
DECLARE
    paper UUID;
BEGIN
    SELECT id INTO paper FROM public.exam_papers WHERE code = 'ENNEAGRAM_SAMPLER';

    -- Backfill empty C/D on all 36 rows to satisfy chk_options_shape on UPDATE.
    UPDATE public.exam_questions
    SET options = options || '{"C":"","D":""}'::jsonb
    WHERE paper_id = paper;

    -- ── Question text updates (5 restored questions) ────────────────────────

    UPDATE public.exam_questions
    SET options = jsonb_build_object(
            'A', 'It''s been difficult for me to relax and stop worrying about potential problems.',
            'B', 'It''s been difficult for me to get myself worked up about potential problems.',
            'C', '', 'D', ''
        )
    WHERE paper_id = paper AND question_number = 6;

    UPDATE public.exam_questions
    SET options = jsonb_build_object(
            'A', 'I''ve been a bit cynical and skeptical.',
            'B', 'I''ve been mushy and sentimental.',
            'C', '', 'D', ''
        )
    WHERE paper_id = paper AND question_number = 23;

    UPDATE public.exam_questions
    SET options = jsonb_build_object(
            'A', 'I have tended to get anxious if there was too much excitement and stimulation.',
            'B', 'I have tended to get anxious if there wasn''t enough excitement and stimulation.',
            'C', '', 'D', ''
        )
    WHERE paper_id = paper AND question_number = 26;

    UPDATE public.exam_questions
    SET options = jsonb_build_object(
            'A', 'I''ve wanted to "fit in" with others—I get uncomfortable when I stand out too much.',
            'B', 'I''ve wanted to stand out from others—I get uncomfortable when I don''t distinguish myself.',
            'C', '', 'D', ''
        )
    WHERE paper_id = paper AND question_number = 31;

    UPDATE public.exam_questions
    SET options = jsonb_build_object(
            'A', 'I''ve been appreciated for my unsinkable spirit and resourcefulness.',
            'B', 'I''ve been appreciated for my deep caring and personal warmth.',
            'C', '', 'D', ''
        )
    WHERE paper_id = paper AND question_number = 35;

    -- ── Type mapping updates (all 36 questions, idempotent) ─────────────────

    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":4,"B":6}}' WHERE paper_id = paper AND question_number = 1;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":8,"B":9}}' WHERE paper_id = paper AND question_number = 2;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":3,"B":1}}' WHERE paper_id = paper AND question_number = 3;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":5,"B":7}}' WHERE paper_id = paper AND question_number = 4;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":2,"B":4}}' WHERE paper_id = paper AND question_number = 5;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":6,"B":9}}' WHERE paper_id = paper AND question_number = 6;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":8,"B":1}}' WHERE paper_id = paper AND question_number = 7;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":2,"B":5}}' WHERE paper_id = paper AND question_number = 8;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":3,"B":7}}' WHERE paper_id = paper AND question_number = 9;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":4,"B":9}}' WHERE paper_id = paper AND question_number = 10;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":5,"B":8}}' WHERE paper_id = paper AND question_number = 11;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":6,"B":1}}' WHERE paper_id = paper AND question_number = 12;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":2,"B":3}}' WHERE paper_id = paper AND question_number = 13;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":4,"B":7}}' WHERE paper_id = paper AND question_number = 14;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":5,"B":1}}' WHERE paper_id = paper AND question_number = 15;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":6,"B":8}}' WHERE paper_id = paper AND question_number = 16;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":9,"B":2}}' WHERE paper_id = paper AND question_number = 17;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":3,"B":4}}' WHERE paper_id = paper AND question_number = 18;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":6,"B":7}}' WHERE paper_id = paper AND question_number = 19;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":2,"B":1}}' WHERE paper_id = paper AND question_number = 20;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":8,"B":3}}' WHERE paper_id = paper AND question_number = 21;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":5,"B":9}}' WHERE paper_id = paper AND question_number = 22;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":6,"B":2}}' WHERE paper_id = paper AND question_number = 23;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":7,"B":8}}' WHERE paper_id = paper AND question_number = 24;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":4,"B":1}}' WHERE paper_id = paper AND question_number = 25;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":9,"B":7}}' WHERE paper_id = paper AND question_number = 26;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":6,"B":3}}' WHERE paper_id = paper AND question_number = 27;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":5,"B":4}}' WHERE paper_id = paper AND question_number = 28;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":8,"B":2}}' WHERE paper_id = paper AND question_number = 29;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":7,"B":1}}' WHERE paper_id = paper AND question_number = 30;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":9,"B":3}}' WHERE paper_id = paper AND question_number = 31;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":5,"B":6}}' WHERE paper_id = paper AND question_number = 32;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":4,"B":8}}' WHERE paper_id = paper AND question_number = 33;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":9,"B":1}}' WHERE paper_id = paper AND question_number = 34;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":7,"B":2}}' WHERE paper_id = paper AND question_number = 35;
    UPDATE public.exam_questions SET explanation = '{"quiz_type":"enneagram","types":{"A":3,"B":5}}' WHERE paper_id = paper AND question_number = 36;
END $$;
