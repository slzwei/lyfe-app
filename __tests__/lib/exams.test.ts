/**
 * Tests for lib/exams.ts — Exam attempt & result service functions
 */
import { supabase } from '@/lib/supabase';

import {
    submitExamAttempt,
    submitVarkAttempt,
    submitEnneagramAttempt,
    submitDiscAttempt,
    fetchExamPapersWithAttempts,
    fetchExamResult,
} from '@/lib/exams';
import type { ExamQuestion } from '@/types/exam';

jest.mock('@/lib/supabase');

const mockSupa = supabase as any;

function mockResolve(chain: any, value: any) {
    chain.__resolveWith(value);
}

// ── Fixtures ──

const QUESTIONS: ExamQuestion[] = [
    {
        id: 'q1',
        paper_id: 'p1',
        question_number: 1,
        question_text: 'What is 1+1?',
        options: { A: '1', B: '2', C: '3', D: '4' },
        correct_answer: 'B',
        has_latex: false,
        explanation: 'Basic math',
        explanation_has_latex: false,
    },
    {
        id: 'q2',
        paper_id: 'p1',
        question_number: 2,
        question_text: 'What is 2+2?',
        options: { A: '3', B: '4', C: '5', D: '6' },
        correct_answer: 'B',
        has_latex: false,
        explanation: null,
        explanation_has_latex: false,
    },
    {
        id: 'q3',
        paper_id: 'p1',
        question_number: 3,
        question_text: 'What is 3+3?',
        options: { A: '5', B: '6', C: '7', D: '8' },
        correct_answer: 'B',
        has_latex: false,
        explanation: null,
        explanation_has_latex: false,
    },
    {
        id: 'q4',
        paper_id: 'p1',
        question_number: 4,
        question_text: 'What is 4+4?',
        options: { A: '7', B: '8', C: '9', D: '10' },
        correct_answer: 'B',
        has_latex: false,
        explanation: null,
        explanation_has_latex: false,
    },
    {
        id: 'q5',
        paper_id: 'p1',
        question_number: 5,
        question_text: 'What is 5+5?',
        options: { A: '9', B: '10', C: '11', D: '12' },
        correct_answer: 'B',
        has_latex: false,
        explanation: null,
        explanation_has_latex: false,
    },
];

beforeEach(() => {
    mockSupa.__resetChains();
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-08T12:00:00Z'));
});

afterEach(() => {
    jest.useRealTimers();
});

// ── submitExamAttempt ──

describe('submitExamAttempt', () => {
    it('returns server-computed score and creates attempt with answers', async () => {
        // Server computes: 5/5 correct → score=5, percentage=100, passed=true
        mockSupa.rpc.mockResolvedValueOnce({
            data: { attempt_id: 'attempt-1', score: 5, percentage: 100, passed: true },
            error: null,
        });

        const result = await submitExamAttempt(
            {
                userId: 'u1',
                paperId: 'p1',
                questions: QUESTIONS,
                answers: { q1: 'B', q2: 'B', q3: 'B', q4: 'B', q5: 'B' },
                status: 'submitted',
                startedAt: new Date('2026-03-08T11:50:00Z').getTime(),
            },
            'M9',
        );

        expect(result.error).toBeNull();
        expect(result.data?.score).toBe(5);
        expect(result.data?.totalQuestions).toBe(5);
        expect(result.data?.percentage).toBe(100);
        expect(result.data?.passed).toBe(true);
        expect(result.data?.paperCode).toBe('M9');
        expect(result.data?.answers).toHaveLength(5);
        expect(result.data?.answers.every((a) => a.isCorrect)).toBe(true);

        // Verify RPC is NOT sent client-computed score params
        const rpcCall = mockSupa.rpc.mock.calls[0];
        expect(rpcCall[0]).toBe('submit_exam_attempt');
        expect(rpcCall[1]).not.toHaveProperty('p_score');
        expect(rpcCall[1]).not.toHaveProperty('p_percentage');
        expect(rpcCall[1]).not.toHaveProperty('p_passed');
    });

    it('returns server-computed passing score', async () => {
        // Server computes: 4/5 correct → score=4, percentage=80, passed=true
        mockSupa.rpc.mockResolvedValueOnce({
            data: { attempt_id: 'attempt-2', score: 4, percentage: 80, passed: true },
            error: null,
        });

        const result = await submitExamAttempt(
            {
                userId: 'u1',
                paperId: 'p1',
                questions: QUESTIONS,
                answers: { q1: 'B', q2: 'B', q3: 'B', q4: 'B', q5: 'wrong' },
                status: 'submitted',
                startedAt: Date.now() - 60000,
            },
            'M9',
        );

        expect(result.data?.score).toBe(4);
        expect(result.data?.percentage).toBe(80);
        expect(result.data?.passed).toBe(true);
    });

    it('returns server-computed failing score', async () => {
        // Server computes: 3/5 correct → score=3, percentage=60, passed=false
        mockSupa.rpc.mockResolvedValueOnce({
            data: { attempt_id: 'attempt-3', score: 3, percentage: 60, passed: false },
            error: null,
        });

        const result = await submitExamAttempt(
            {
                userId: 'u1',
                paperId: 'p1',
                questions: QUESTIONS,
                answers: { q1: 'B', q2: 'B', q3: 'B', q4: 'wrong', q5: 'wrong' },
                status: 'submitted',
                startedAt: Date.now() - 60000,
            },
            'M9',
        );

        expect(result.data?.score).toBe(3);
        expect(result.data?.percentage).toBe(60);
        expect(result.data?.passed).toBe(false);
    });

    it('handles unanswered questions as incorrect', async () => {
        // Server computes: 1/5 correct → score=1, percentage=20, passed=false
        mockSupa.rpc.mockResolvedValueOnce({
            data: { attempt_id: 'attempt-4', score: 1, percentage: 20, passed: false },
            error: null,
        });

        // Only answer q1, leave rest blank
        const result = await submitExamAttempt(
            {
                userId: 'u1',
                paperId: 'p1',
                questions: QUESTIONS,
                answers: { q1: 'B' }, // missing q2-q5
                status: 'auto_submitted',
                startedAt: Date.now() - 300000,
            },
            'M9',
        );

        expect(result.data?.score).toBe(1);
        expect(result.data?.percentage).toBe(20);
        expect(result.data?.passed).toBe(false);
        expect(result.data?.status).toBe('auto_submitted');
        expect(result.data?.answers.filter((a) => a.selected === null)).toHaveLength(4);
    });

    it('returns error when attempt insert fails', async () => {
        mockSupa.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Insert failed' } });

        const result = await submitExamAttempt(
            {
                userId: 'u1',
                paperId: 'p1',
                questions: QUESTIONS,
                answers: {},
                status: 'submitted',
                startedAt: Date.now(),
            },
            'M9',
        );

        expect(result.error).toBe('Insert failed');
        expect(result.data).toBeNull();
    });

    it('returns error and cleans up attempt when answer insert fails', async () => {
        mockSupa.rpc.mockResolvedValueOnce({
            data: null,
            error: { message: 'Failed to save your answers. Please try again.' },
        });

        const result = await submitExamAttempt(
            {
                userId: 'u1',
                paperId: 'p1',
                questions: QUESTIONS,
                answers: { q1: '2' },
                status: 'submitted',
                startedAt: Date.now(),
            },
            'M9',
        );

        // Should return null data and a user-friendly error
        expect(result.data).toBeNull();
        expect(result.error).toBe('Failed to save your answers. Please try again.');
    });

    it('tracks answer correctness per question', async () => {
        mockSupa.rpc.mockResolvedValueOnce({
            data: { attempt_id: 'attempt-6', score: 3, percentage: 60, passed: false },
            error: null,
        });

        const result = await submitExamAttempt(
            {
                userId: 'u1',
                paperId: 'p1',
                questions: QUESTIONS,
                answers: { q1: 'B', q2: 'wrong', q3: 'B', q4: 'wrong', q5: 'B' },
                status: 'submitted',
                startedAt: Date.now() - 60000,
            },
            'M5',
        );

        const answers = result.data!.answers;
        expect(answers[0]).toEqual({ questionId: 'q1', selected: 'B', isCorrect: true, correctAnswer: 'B' });
        expect(answers[1]).toEqual({ questionId: 'q2', selected: 'wrong', isCorrect: false, correctAnswer: 'B' });
        expect(answers[2]).toEqual({ questionId: 'q3', selected: 'B', isCorrect: true, correctAnswer: 'B' });
    });
});

// ── fetchExamResult ──

describe('fetchExamResult', () => {
    it('returns result with questions and answers joined', async () => {
        const attemptsChain = mockSupa.__getChain('exam_attempts');
        mockResolve(attemptsChain, {
            data: {
                id: 'attempt-1',
                paper_id: 'p1',
                score: 4,
                total_questions: 5,
                percentage: 80,
                passed: true,
                status: 'submitted',
            },
            error: null,
        });

        const papersChain = mockSupa.__getChain('exam_papers');
        mockResolve(papersChain, { data: { code: 'M9' }, error: null });

        const answersChain = mockSupa.__getChain('exam_answers');
        mockResolve(answersChain, {
            data: [
                {
                    selected_answer: '2',
                    is_correct: true,
                    exam_questions: QUESTIONS[0],
                },
                {
                    selected_answer: 'wrong',
                    is_correct: false,
                    exam_questions: QUESTIONS[1],
                },
            ],
            error: null,
        });

        const result = await fetchExamResult('attempt-1');
        expect(result.error).toBeNull();
        expect(result.data?.score).toBe(4);
        expect(result.data?.percentage).toBe(80);
        expect(result.data?.passed).toBe(true);
        expect(result.data?.paperCode).toBe('M9');
        expect(result.data?.questions).toHaveLength(2);
        expect(result.data?.answers).toHaveLength(2);
        expect(result.data?.answers[0].isCorrect).toBe(true);
        expect(result.data?.answers[1].isCorrect).toBe(false);
    });

    it('returns error when attempt not found', async () => {
        const chain = mockSupa.__getChain('exam_attempts');
        mockResolve(chain, { data: null, error: { message: 'Not found' } });

        const result = await fetchExamResult('bad-id');
        expect(result.error).toBe('Not found');
        expect(result.data).toBeNull();
    });

    it('returns error when answers query fails', async () => {
        const attemptsChain = mockSupa.__getChain('exam_attempts');
        mockResolve(attemptsChain, {
            data: {
                id: 'attempt-1',
                paper_id: 'p1',
                score: 0,
                total_questions: 5,
                percentage: 0,
                passed: false,
                status: 'submitted',
            },
            error: null,
        });

        const papersChain = mockSupa.__getChain('exam_papers');
        mockResolve(papersChain, { data: { code: 'M9' }, error: null });

        const answersChain = mockSupa.__getChain('exam_answers');
        mockResolve(answersChain, { data: null, error: { message: 'Answers query failed' } });

        const result = await fetchExamResult('attempt-1');
        expect(result.error).toBe('Answers query failed');
    });

    it('returns VARK personality results when allow_multiple_answers is true', async () => {
        const attemptsChain = mockSupa.__getChain('exam_attempts');
        mockResolve(attemptsChain, {
            data: {
                id: 'attempt-vark',
                paper_id: 'p-vark',
                total_questions: 16,
                status: 'submitted',
                personality_results: {
                    scores: { V: 6, A: 4, R: 3, K: 3 },
                    percentages: { V: 38, A: 25, R: 19, K: 19 },
                    preference: 'single',
                    topTypes: ['V'],
                },
            },
            error: null,
        });

        const papersChain = mockSupa.__getChain('exam_papers');
        mockResolve(papersChain, { data: { code: 'VARK', allow_multiple_answers: true }, error: null });

        mockSupa.rpc.mockResolvedValueOnce({ data: [], error: null });

        const result = await fetchExamResult('attempt-vark');
        expect(result.error).toBeNull();
        expect(result.data?.personalityResults).toBeDefined();
        expect((result.data?.personalityResults as any)?.preference).toBe('single');
        expect((result.data?.personalityResults as any)?.topTypes).toEqual(['V']);
        expect(result.data?.score).toBe(0);
        expect(result.data?.passed).toBe(false);
    });

    it('returns null personalityResults when JSONB data is malformed', async () => {
        const attemptsChain = mockSupa.__getChain('exam_attempts');
        mockResolve(attemptsChain, {
            data: {
                id: 'attempt-bad',
                paper_id: 'p-vark',
                total_questions: 16,
                status: 'submitted',
                personality_results: { broken: true }, // missing required fields
            },
            error: null,
        });

        const papersChain = mockSupa.__getChain('exam_papers');
        mockResolve(papersChain, { data: { code: 'VARK', allow_multiple_answers: true }, error: null });

        mockSupa.rpc.mockResolvedValueOnce({ data: [], error: null });

        const result = await fetchExamResult('attempt-bad');
        expect(result.error).toBeNull();
        expect(result.data?.personalityResults).toBeNull();
    });

    it('defaults paperCode to empty string when paper not found', async () => {
        const attemptsChain = mockSupa.__getChain('exam_attempts');
        mockResolve(attemptsChain, {
            data: {
                id: 'attempt-1',
                paper_id: 'p1',
                score: 0,
                total_questions: 5,
                percentage: 0,
                passed: false,
                status: 'submitted',
            },
            error: null,
        });

        const papersChain = mockSupa.__getChain('exam_papers');
        mockResolve(papersChain, { data: null, error: null });

        const answersChain = mockSupa.__getChain('exam_answers');
        mockResolve(answersChain, { data: [], error: null });

        const result = await fetchExamResult('attempt-1');
        expect(result.data?.paperCode).toBe('');
    });
});

// ── submitVarkAttempt ──

const VARK_QUESTIONS: ExamQuestion[] = [
    {
        id: 'vq1',
        paper_id: 'p-vark',
        question_number: 1,
        question_text: 'How do you prefer to learn?',
        options: { A: 'Diagrams', B: 'Listening', C: 'Reading', D: 'Practice' },
        correct_answer: 'A:V,B:A,C:R,D:K',
        has_latex: false,
        explanation: '{"quiz_type":"vark","types":{"A":"V","B":"A","C":"R","D":"K"}}',
        explanation_has_latex: false,
    },
    {
        id: 'vq2',
        paper_id: 'p-vark',
        question_number: 2,
        question_text: 'When studying, you prefer...',
        options: { A: 'Charts', B: 'Discussion', C: 'Notes', D: 'Hands-on' },
        correct_answer: 'A:V,B:A,C:R,D:K',
        has_latex: false,
        explanation: '{"quiz_type":"vark","types":{"A":"V","B":"A","C":"R","D":"K"}}',
        explanation_has_latex: false,
    },
];

describe('submitVarkAttempt', () => {
    it('submits personality quiz with VARK scores and no pass/fail', async () => {
        mockSupa.rpc.mockResolvedValueOnce({ data: { attempt_id: 'vark-attempt-1' }, error: null });

        const result = await submitVarkAttempt(
            {
                userId: 'u1',
                paperId: 'p-vark',
                questions: VARK_QUESTIONS,
                answers: { vq1: 'A,C', vq2: 'A' }, // V+R, V → V:2, R:1
                status: 'submitted',
                startedAt: new Date('2026-03-08T11:55:00Z').getTime(),
            },
            'VARK',
        );

        expect(result.error).toBeNull();
        expect(result.data?.score).toBe(0);
        expect(result.data?.passed).toBe(false);
        expect(result.data?.paperCode).toBe('VARK');
        expect(result.data?.personalityResults).toBeDefined();
        expect(result.data?.personalityResults?.scores.V).toBe(2);
        expect(result.data?.personalityResults?.scores.R).toBe(1);
        expect(result.data?.answers).toHaveLength(2);
        expect(result.data?.answers.every((a) => a.isCorrect === false)).toBe(true);
    });

    it('returns error when attempt insert fails', async () => {
        mockSupa.rpc.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

        const result = await submitVarkAttempt(
            {
                userId: 'u1',
                paperId: 'p-vark',
                questions: VARK_QUESTIONS,
                answers: { vq1: 'A' },
                status: 'submitted',
                startedAt: Date.now(),
            },
            'VARK',
        );

        expect(result.data).toBeNull();
        expect(result.error).toBe('DB error');
    });

    it('returns error when RPC fails', async () => {
        mockSupa.rpc.mockResolvedValueOnce({
            data: null,
            error: { message: 'Failed to save your answers. Please try again.' },
        });

        const result = await submitVarkAttempt(
            {
                userId: 'u1',
                paperId: 'p-vark',
                questions: VARK_QUESTIONS,
                answers: { vq1: 'A,B' },
                status: 'submitted',
                startedAt: Date.now(),
            },
            'VARK',
        );

        expect(result.data).toBeNull();
        expect(result.error).toBe('Failed to save your answers. Please try again.');
    });
});

// ── fetchExamPapersWithAttempts ──

describe('fetchExamPapersWithAttempts', () => {
    it('returns papers and stats on success', async () => {
        const papersChain = mockSupa.__getChain('exam_papers');
        mockResolve(papersChain, {
            data: [
                { id: 'p1', code: 'M5', display_order: 1, is_active: true },
                { id: 'p2', code: 'M9', display_order: 2, is_active: true },
            ],
            error: null,
        });

        const attemptsChain = mockSupa.__getChain('exam_attempts');
        mockResolve(attemptsChain, {
            data: [
                { paper_id: 'p1', score: 4, percentage: 80, passed: true, submitted_at: '2026-03-05T00:00:00Z' },
                { paper_id: 'p1', score: 5, percentage: 100, passed: true, submitted_at: '2026-03-06T00:00:00Z' },
                { paper_id: 'p2', score: 2, percentage: 40, passed: false, submitted_at: '2026-03-04T00:00:00Z' },
            ],
            error: null,
        });

        const result = await fetchExamPapersWithAttempts('u1');
        expect(result.error).toBeNull();
        expect(result.papers).toHaveLength(2);
        expect(result.stats['p1']).toEqual({
            attemptCount: 2,
            bestScore: 100,
            lastAttemptDate: '2026-03-06T00:00:00Z',
            bestPassed: true,
        });
        expect(result.stats['p2']).toEqual({
            attemptCount: 1,
            bestScore: 40,
            lastAttemptDate: '2026-03-04T00:00:00Z',
            bestPassed: false,
        });
    });

    it('returns error when papers query fails', async () => {
        const papersChain = mockSupa.__getChain('exam_papers');
        mockResolve(papersChain, { data: null, error: { message: 'Query failed' } });

        const result = await fetchExamPapersWithAttempts('u1');
        expect(result.error).toBe('Query failed');
        expect(result.papers).toEqual([]);
        expect(result.stats).toEqual({});
    });

    it('handles no attempts gracefully', async () => {
        const papersChain = mockSupa.__getChain('exam_papers');
        mockResolve(papersChain, { data: [{ id: 'p1', code: 'M5' }], error: null });

        const attemptsChain = mockSupa.__getChain('exam_attempts');
        mockResolve(attemptsChain, { data: null, error: null });

        const result = await fetchExamPapersWithAttempts('u1');
        expect(result.papers).toHaveLength(1);
        expect(result.stats).toEqual({});
    });
});

// ── submitEnneagramAttempt ──

const ENNEAGRAM_QUESTIONS: ExamQuestion[] = [
    {
        id: 'eq1',
        paper_id: 'p-enn',
        question_number: 1,
        question_text: 'I tend to be...',
        options: { A: 'Principled', B: 'Caring' },
        correct_answer: 'A:1,B:2',
        has_latex: false,
        explanation: '{"quiz_type":"enneagram","types":{"A":"1","B":"2"}}',
        explanation_has_latex: false,
    },
    {
        id: 'eq2',
        paper_id: 'p-enn',
        question_number: 2,
        question_text: 'I usually...',
        options: { A: 'Achieve', B: 'Reflect' },
        correct_answer: 'A:3,B:4',
        has_latex: false,
        explanation: '{"quiz_type":"enneagram","types":{"A":"3","B":"4"}}',
        explanation_has_latex: false,
    },
];

describe('submitEnneagramAttempt', () => {
    it('submits personality quiz with Enneagram scores', async () => {
        mockSupa.rpc.mockResolvedValueOnce({ data: { attempt_id: 'enn-attempt-1' }, error: null });

        const result = await submitEnneagramAttempt(
            {
                userId: 'u1',
                paperId: 'p-enn',
                questions: ENNEAGRAM_QUESTIONS,
                answers: { eq1: 'A', eq2: 'B' },
                status: 'submitted',
                startedAt: new Date('2026-03-08T11:55:00Z').getTime(),
            },
            'ENNEAGRAM',
        );

        expect(result.error).toBeNull();
        expect(result.data?.score).toBe(0);
        expect(result.data?.passed).toBe(false);
        expect(result.data?.paperCode).toBe('ENNEAGRAM');
        expect(result.data?.personalityResults).toBeDefined();
        expect(result.data?.answers).toHaveLength(2);
    });

    it('returns error on RPC failure', async () => {
        mockSupa.rpc.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

        const result = await submitEnneagramAttempt(
            {
                userId: 'u1',
                paperId: 'p-enn',
                questions: ENNEAGRAM_QUESTIONS,
                answers: { eq1: 'A' },
                status: 'submitted',
                startedAt: Date.now(),
            },
            'ENNEAGRAM',
        );

        expect(result.data).toBeNull();
        expect(result.error).toBe('DB error');
    });
});

// ── submitDiscAttempt ──

describe('submitDiscAttempt', () => {
    const DISC_RESULTS = {
        scores: { D: 25, I: 30, S: 20, C: 25 },
        percentages: { D: 25, I: 30, S: 20, C: 25 },
        discType: 'Influencer' as const,
        totalQuestions: 38,
        angle: 72,
    };

    it('submits DISC quiz with precomputed results', async () => {
        mockSupa.rpc.mockResolvedValueOnce({ data: { attempt_id: 'disc-attempt-1' }, error: null });

        const result = await submitDiscAttempt(
            {
                userId: 'u1',
                paperId: 'p-disc',
                answers: { 1: 'A', 2: 'B' },
                startedAt: new Date('2026-03-08T11:50:00Z').getTime(),
            },
            DISC_RESULTS as any,
        );

        expect(result.error).toBeNull();
        expect(result.data?.score).toBe(0);
        expect(result.data?.paperCode).toBe('DISC');
        expect(result.data?.personalityResults).toBeDefined();
        expect(result.data?.answers).toEqual([]);
        expect(result.data?.questions).toEqual([]);
    });

    it('returns error on RPC failure', async () => {
        mockSupa.rpc.mockResolvedValueOnce({ data: null, error: { message: 'RPC failed' } });

        const result = await submitDiscAttempt(
            { userId: 'u1', paperId: 'p-disc', answers: {}, startedAt: Date.now() },
            DISC_RESULTS as any,
        );

        expect(result.data).toBeNull();
        expect(result.error).toBe('RPC failed');
    });
});
