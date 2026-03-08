/**
 * Exams service — Supabase CRUD for exam attempts & answers
 */
import type { ExamQuestion } from '@/types/exam';
import { supabase } from './supabase';

// ── Submit Exam ──────────────────────────────────────────────

interface SubmitExamInput {
    userId: string;
    paperId: string;
    questions: ExamQuestion[];
    answers: Record<string, string>; // { [questionId]: selectedAnswer }
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
}

/**
 * Submit an exam attempt to Supabase and return the result.
 * Creates both `exam_attempts` and `exam_answers` rows.
 */
export async function submitExamAttempt(
    input: SubmitExamInput,
    paperCode: string,
): Promise<{ data: ExamResultData | null; error: string | null }> {
    const { userId, paperId, questions, answers, status, startedAt } = input;

    // Calculate score
    let correct = 0;
    const answerDetails = questions.map((q) => {
        const selected = answers[q.id] || null;
        const isCorrect = selected === q.correct_answer;
        if (isCorrect) correct++;
        return { questionId: q.id, selected, isCorrect, correctAnswer: q.correct_answer };
    });

    const percentage = Math.round((correct / questions.length) * 100);
    const passed = percentage >= 70;
    const durationSeconds = Math.floor((Date.now() - startedAt) / 1000);

    // Insert attempt as 'in_progress' first so RLS allows answer inserts
    const { data: attempt, error: attemptError } = await supabase
        .from('exam_attempts')
        .insert({
            user_id: userId,
            paper_id: paperId,
            status: 'in_progress',
            score: correct,
            total_questions: questions.length,
            percentage,
            passed,
            started_at: new Date(startedAt).toISOString(),
            submitted_at: new Date().toISOString(),
            duration_seconds: durationSeconds,
        })
        .select()
        .single();

    if (attemptError) {
        return { data: null, error: attemptError.message };
    }

    // Insert individual answers (RLS requires attempt status = 'in_progress')
    const answerRows = questions.map((q) => ({
        attempt_id: attempt.id,
        question_id: q.id,
        selected_answer: answers[q.id] || null,
        is_correct: (answers[q.id] || null) === q.correct_answer,
    }));

    const { error: answersError } = await supabase
        .from('exam_answers')
        .insert(answerRows);

    if (answersError) {
        if (__DEV__) console.error('Failed to insert exam answers:', answersError.message);
    }

    // Now update attempt to final status
    const { error: updateError } = await supabase
        .from('exam_attempts')
        .update({ status })
        .eq('id', attempt.id);

    if (updateError) {
        if (__DEV__) console.error('Failed to update attempt status:', updateError.message);
    }

    return {
        data: {
            id: attempt.id,
            score: correct,
            totalQuestions: questions.length,
            percentage,
            passed,
            status,
            answers: answerDetails,
            questions,
            paperCode,
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
        .select('*')
        .eq('id', attemptId)
        .single();

    if (attemptError) return { data: null, error: attemptError.message };

    // Fetch the paper code
    const { data: paper } = await supabase
        .from('exam_papers')
        .select('code')
        .eq('id', attempt.paper_id)
        .single();

    // Fetch answers with questions joined
    const { data: examAnswers, error: answersError } = await supabase
        .from('exam_answers')
        .select('*, exam_questions!exam_answers_question_id_fkey(*)')
        .eq('attempt_id', attemptId)
        .order('exam_questions(question_number)');

    if (answersError) return { data: null, error: answersError.message };

    const questions: ExamQuestion[] = [];
    const answerDetails: ExamResultData['answers'] = [];

    (examAnswers || []).forEach((row: any) => {
        const q = row.exam_questions;
        if (q) {
            questions.push(q as ExamQuestion);
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
