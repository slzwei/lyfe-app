-- Create DISC personality assessment exam paper.
-- DISC uses a dedicated client-side quiz screen with custom question formats
-- (word pairs, single-word ratings, scenario binary choice).
-- Questions are defined in constants/disc.ts; only the paper is stored in the DB
-- so that exam_attempts can reference it.
INSERT INTO exam_papers (
    code,
    title,
    description,
    duration_minutes,
    pass_percentage,
    question_count,
    is_active,
    is_mandatory,
    display_order,
    allow_multiple_answers
) VALUES (
    'DISC',
    'DISC Profile',
    'Discover your DISC personality profile — Drive, Influence, Support, or Clarity. A 38-question assessment across 5 steps.',
    0,   -- no time limit for personality quizzes
    0,   -- no pass/fail
    38,
    true,
    false,
    30,  -- display after VARK (10) and Enneagram (20)
    false
);
