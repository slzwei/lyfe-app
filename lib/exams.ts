/**
 * Exams service — Supabase CRUD for exam attempts & answers
 */
import type { ExamPaper, ExamQuestion, PaperStats } from '@/types/exam';
import type { Json } from '@/types/supabase';
import type { VarkResults } from '@/constants/vark';
import type { EnneagramResults } from '@/constants/enneagram';
import type { DiscResults } from '@/constants/disc';
import { computeVarkScores, isVarkResults } from './vark';
import { computeEnneagramScores, isEnneagramResults } from './enneagram';
import { isDiscResults } from './disc';
import { supabase } from './supabase';

/** Default pass threshold when exam_papers.pass_percentage is unavailable */
const DEFAULT_PASS_PERCENTAGE = 70;

// ── Fetch Exam Papers with Attempts ──────────────────────────

/**
 * Fetch active exam papers and the current user's attempt stats.
 * Used by the exam list screen.
 */
export async function fetchExamPapersWithAttempts(userId: string): Promise<{
    papers: ExamPaper[];
    stats: Record<string, PaperStats>;
    error: string | null;
}> {
    const { data: papersData, error: papersError } = await supabase
        .from('exam_papers')
        .select('*')
        .eq('is_active', true)
        .not('code', 'in', '("M5","M9","M9A","HI")')
        .order('display_order');

    if (papersError) return { papers: [], stats: {}, error: papersError.message };

    const papers = (papersData || []) as ExamPaper[];

    // Fetch best attempt stats for current user
    const statsMap: Record<string, PaperStats> = {};
    const { data: attempts } = await supabase
        .from('exam_attempts')
        .select('paper_id, score, percentage, passed, submitted_at')
        .eq('user_id', userId)
        .in('status', ['submitted', 'auto_submitted']);

    if (attempts) {
        for (const attempt of attempts) {
            const existing = statsMap[attempt.paper_id];
            if (!existing) {
                statsMap[attempt.paper_id] = {
                    attemptCount: 1,
                    bestScore: attempt.percentage,
                    lastAttemptDate: attempt.submitted_at,
                    bestPassed: attempt.passed,
                };
            } else {
                existing.attemptCount++;
                if (attempt.percentage && (!existing.bestScore || attempt.percentage > existing.bestScore)) {
                    existing.bestScore = attempt.percentage;
                    existing.bestPassed = attempt.passed;
                }
                if (
                    attempt.submitted_at &&
                    (!existing.lastAttemptDate || attempt.submitted_at > existing.lastAttemptDate)
                ) {
                    existing.lastAttemptDate = attempt.submitted_at;
                }
            }
        }
    }

    return { papers, stats: statsMap, error: null };
}

// ── Submit Exam ──────────────────────────────────────────────

interface SubmitExamInput {
    userId: string;
    paperId: string;
    questions: ExamQuestion[];
    answers: Record<string, string>; // { [questionId]: selectedAnswer (comma-separated for multi) }
    status: 'submitted' | 'auto_submitted';
    startedAt: number; // Unix ms
}

export interface ExamResultData {
    id: string;
    score: number;
    totalQuestions: number;
    percentage: number;
    passed: boolean;
    status: string;
    answers: {
        questionId: string;
        selected: string | null;
        isCorrect: boolean;
        correctAnswer: string;
    }[];
    questions: ExamQuestion[];
    paperCode: string;
    /** Present only for personality quizzes (VARK, Enneagram, DISC, etc.) */
    personalityResults?: VarkResults | EnneagramResults | DiscResults | null;
}

/**
 * Submit an exam attempt to Supabase atomically via RPC.
 * The `submit_exam_attempt` RPC wraps attempt insert, answers insert,
 * and status update in a single database transaction — on any failure
 * the entire transaction rolls back, preventing orphaned rows.
 */
export async function submitExamAttempt(
    input: SubmitExamInput,
    paperCode: string,
): Promise<{ data: ExamResultData | null; error: string | null }> {
    const { userId, paperId, questions, answers, status, startedAt } = input;

    // Build answer details for local display (server is authoritative for scoring)
    const answerDetails = questions.map((q) => {
        const selected = answers[q.id] || null;
        const isCorrect = selected === q.correct_answer;
        return { questionId: q.id, selected, isCorrect, correctAnswer: q.correct_answer };
    });

    const durationSeconds = Math.floor((Date.now() - startedAt) / 1000);

    // Build answers array for RPC (server computes is_correct + score)
    const answerRows = questions.map((q) => ({
        question_id: q.id,
        selected_answer: answers[q.id] || null,
    }));

    const { data: rpcResult, error: rpcError } = await supabase.rpc('submit_exam_attempt', {
        p_user_id: userId,
        p_paper_id: paperId,
        p_status: status,
        p_total_questions: questions.length,
        p_started_at: new Date(startedAt).toISOString(),
        p_submitted_at: new Date().toISOString(),
        p_duration_seconds: durationSeconds,
        p_personality_results: null,
        p_answers: answerRows,
    });

    if (rpcError) {
        return { data: null, error: rpcError.message };
    }

    const result = rpcResult as { attempt_id: string; score: number; percentage: number; passed: boolean };

    return {
        data: {
            id: result.attempt_id,
            score: result.score,
            totalQuestions: questions.length,
            percentage: result.percentage,
            passed: result.passed,
            status,
            answers: answerDetails,
            questions,
            paperCode,
        },
        error: null,
    };
}

// ── Submit VARK / Personality Quiz ───────────────────────────

/**
 * Submit a VARK (multi-select personality) quiz attempt atomically via RPC.
 * No right/wrong scoring — tallies V/A/R/K and stores a personality profile.
 */
export async function submitVarkAttempt(
    input: SubmitExamInput,
    paperCode: string,
): Promise<{ data: ExamResultData | null; error: string | null }> {
    const { userId, paperId, questions, answers, status, startedAt } = input;

    const durationSeconds = Math.floor((Date.now() - startedAt) / 1000);
    const varkResults = computeVarkScores(questions, answers);

    // Build answer details (no correct/incorrect for personality quizzes)
    const answerDetails = questions.map((q) => ({
        questionId: q.id,
        selected: answers[q.id] || null,
        isCorrect: false,
        correctAnswer: q.correct_answer,
    }));

    // Build answers array for RPC (server sets is_correct = NULL for personality)
    const answerRows = questions.map((q) => ({
        question_id: q.id,
        selected_answer: answers[q.id] || null,
    }));

    const { data: rpcResult, error: rpcError } = await supabase.rpc('submit_exam_attempt', {
        p_user_id: userId,
        p_paper_id: paperId,
        p_status: status,
        p_total_questions: questions.length,
        p_started_at: new Date(startedAt).toISOString(),
        p_submitted_at: new Date().toISOString(),
        p_duration_seconds: durationSeconds,
        p_personality_results: varkResults as unknown as Json,
        p_answers: answerRows,
    });

    if (rpcError) {
        return { data: null, error: rpcError.message };
    }

    const attemptId = (rpcResult as { attempt_id: string }).attempt_id;

    return {
        data: {
            id: attemptId,
            score: 0,
            totalQuestions: questions.length,
            percentage: 0,
            passed: false,
            status,
            answers: answerDetails,
            questions,
            paperCode,
            personalityResults: varkResults,
        },
        error: null,
    };
}

// ── Submit Enneagram / Personality Quiz ──────────────────────

/**
 * Submit an Enneagram (forced-choice personality) quiz attempt atomically via RPC.
 * No right/wrong scoring — tallies 9 Enneagram types and stores a personality profile.
 */
export async function submitEnneagramAttempt(
    input: SubmitExamInput,
    paperCode: string,
): Promise<{ data: ExamResultData | null; error: string | null }> {
    const { userId, paperId, questions, answers, status, startedAt } = input;

    const durationSeconds = Math.floor((Date.now() - startedAt) / 1000);
    const enneagramResults = computeEnneagramScores(questions, answers);

    // Build answer details (no correct/incorrect for personality quizzes)
    const answerDetails = questions.map((q) => ({
        questionId: q.id,
        selected: answers[q.id] || null,
        isCorrect: false,
        correctAnswer: q.correct_answer,
    }));

    // Build answers array for RPC (server sets is_correct = NULL for personality)
    const answerRows = questions.map((q) => ({
        question_id: q.id,
        selected_answer: answers[q.id] || null,
    }));

    const { data: rpcResult, error: rpcError } = await supabase.rpc('submit_exam_attempt', {
        p_user_id: userId,
        p_paper_id: paperId,
        p_status: status,
        p_total_questions: questions.length,
        p_started_at: new Date(startedAt).toISOString(),
        p_submitted_at: new Date().toISOString(),
        p_duration_seconds: durationSeconds,
        p_personality_results: enneagramResults as unknown as Json,
        p_answers: answerRows,
    });

    if (rpcError) {
        return { data: null, error: rpcError.message };
    }

    const attemptId = (rpcResult as { attempt_id: string }).attempt_id;

    return {
        data: {
            id: attemptId,
            score: 0,
            totalQuestions: questions.length,
            percentage: 0,
            passed: false,
            status,
            answers: answerDetails,
            questions,
            paperCode,
            personalityResults: enneagramResults,
        },
        error: null,
    };
}

// ── Submit DISC / Personality Quiz ────────────────────────────

interface SubmitDiscInput {
    userId: string;
    paperId: string;
    answers: Record<number, number | string>;
    startedAt: number; // Unix ms
}

/**
 * Submit a DISC personality quiz attempt atomically via RPC.
 * DISC uses a custom question format (word pairs, ratings, scenarios)
 * with client-side scoring — no DB questions are involved.
 */
export async function submitDiscAttempt(
    input: SubmitDiscInput,
    discResults: DiscResults,
): Promise<{ data: ExamResultData | null; error: string | null }> {
    const { userId, paperId, startedAt } = input;

    const durationSeconds = Math.floor((Date.now() - startedAt) / 1000);

    const { data: rpcResult, error: rpcError } = await supabase.rpc('submit_exam_attempt', {
        p_user_id: userId,
        p_paper_id: paperId,
        p_status: 'submitted',
        p_total_questions: discResults.totalQuestions,
        p_started_at: new Date(startedAt).toISOString(),
        p_submitted_at: new Date().toISOString(),
        p_duration_seconds: durationSeconds,
        p_personality_results: discResults as unknown as Json,
        p_answers: [],
    });

    if (rpcError) {
        return { data: null, error: rpcError.message };
    }

    const attemptId = (rpcResult as { attempt_id: string }).attempt_id;

    return {
        data: {
            id: attemptId,
            score: 0,
            totalQuestions: discResults.totalQuestions,
            percentage: 0,
            passed: false,
            status: 'submitted',
            answers: [],
            questions: [],
            paperCode: 'DISC',
            personalityResults: discResults,
        },
        error: null,
    };
}

// ── Fetch Exam Result ────────────────────────────────────────

/**
 * Fetch a completed exam attempt with its answers and questions from Supabase.
 * Falls back to null if not found (caller should try AsyncStorage).
 */
export async function fetchExamResult(
    attemptId: string,
): Promise<{ data: ExamResultData | null; error: string | null }> {
    // Fetch the attempt
    const { data: attempt, error: attemptError } = await supabase
        .from('exam_attempts')
        .select(
            'id, user_id, paper_id, status, score, total_questions, percentage, passed, started_at, submitted_at, duration_seconds, personality_results, created_at',
        )
        .eq('id', attemptId)
        .single();

    if (attemptError) return { data: null, error: attemptError.message };

    // Fetch the paper code
    const { data: paper } = await supabase
        .from('exam_papers')
        .select('code, allow_multiple_answers')
        .eq('id', attempt.paper_id)
        .single();

    // If this is a personality quiz with stored results, return them directly
    if (attempt.personality_results) {
        // Fetch questions via RPC (direct table access restricted to admin)
        const { data: questionsData } = await supabase.rpc('get_exam_questions', {
            p_paper_id: attempt.paper_id,
        });

        return {
            data: {
                id: attempt.id,
                score: 0,
                totalQuestions: attempt.total_questions,
                percentage: 0,
                passed: false,
                status: attempt.status,
                answers: [],
                questions: (questionsData as ExamQuestion[]) || [],
                paperCode: paper?.code || '',
                personalityResults: isEnneagramResults(attempt.personality_results)
                    ? attempt.personality_results
                    : isVarkResults(attempt.personality_results)
                      ? attempt.personality_results
                      : isDiscResults(attempt.personality_results)
                        ? attempt.personality_results
                        : null,
            },
            error: null,
        };
    }

    // Fetch answers with questions joined
    const { data: examAnswers, error: answersError } = await supabase
        .from('exam_answers')
        .select(
            'id, attempt_id, question_id, selected_answer, is_correct, answered_at, exam_questions!exam_answers_question_id_fkey(id, paper_id, question_number, question_text, has_latex, options, correct_answer, explanation, explanation_has_latex)',
        )
        .eq('attempt_id', attemptId)
        .order('exam_questions(question_number)');

    if (answersError) return { data: null, error: answersError.message };

    const questions: ExamQuestion[] = [];
    const answerDetails: ExamResultData['answers'] = [];

    (
        (examAnswers || []) as {
            selected_answer: string | null;
            is_correct: boolean;
            exam_questions: ExamQuestion | null;
        }[]
    ).forEach((row) => {
        const q = row.exam_questions;
        if (q) {
            questions.push(q);
            answerDetails.push({
                questionId: q.id,
                selected: row.selected_answer,
                isCorrect: row.is_correct,
                correctAnswer: q.correct_answer,
            });
        }
    });

    return {
        data: {
            id: attempt.id,
            score: attempt.score || 0,
            totalQuestions: attempt.total_questions,
            percentage: attempt.percentage || 0,
            passed: attempt.passed || false,
            status: attempt.status,
            answers: answerDetails,
            questions,
            paperCode: paper?.code || '',
        },
        error: null,
    };
}
