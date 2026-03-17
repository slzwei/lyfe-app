/**
 * Enneagram scoring logic — pure functions, no side effects.
 */
import type { ExamQuestion } from '@/types/exam';
import type { EnneagramType, EnneagramResults } from '@/constants/enneagram';
import { ENNEAGRAM_TYPES } from '@/constants/enneagram';

/**
 * Parse the Enneagram type mapping from a question's `explanation` JSON field.
 * Expected format: `{"quiz_type":"enneagram","types":{"A":4,"B":6}}`
 * Returns null if it's not an Enneagram question.
 */
export function parseEnneagramTypeMapping(explanation: string | null): Record<string, number> | null {
    if (!explanation) return null;
    try {
        const parsed = JSON.parse(explanation);
        if (parsed?.quiz_type === 'enneagram' && parsed?.types) {
            return parsed.types as Record<string, number>;
        }
    } catch {
        // Not JSON or malformed
    }
    return null;
}

/**
 * Compute Enneagram scores from questions and answers.
 *
 * @param questions - All exam questions (with `explanation` containing type mappings)
 * @param answers - Map of questionId → selected option ("A" or "B")
 */
export function computeEnneagramScores(questions: ExamQuestion[], answers: Record<string, string>): EnneagramResults {
    const scores: Record<string, number> = {};
    for (const t of ENNEAGRAM_TYPES) {
        scores[String(t)] = 0;
    }

    for (const q of questions) {
        const typeMap = parseEnneagramTypeMapping(q.explanation);
        if (!typeMap) continue;

        const selected = answers[q.id];
        if (!selected) continue;

        const enneaType = typeMap[selected.trim()];
        if (enneaType != null && String(enneaType) in scores) {
            scores[String(enneaType)]++;
        }
    }

    // Compute percentages
    const totalSelections = ENNEAGRAM_TYPES.reduce((sum, t) => sum + scores[String(t)], 0);
    const percentages: Record<string, number> = {};
    for (const t of ENNEAGRAM_TYPES) {
        percentages[String(t)] = totalSelections > 0 ? Math.round((scores[String(t)] / totalSelections) * 100) : 0;
    }

    // Find primary type (highest scoring)
    let primaryType: EnneagramType = 1;
    let maxScore = 0;
    for (const t of ENNEAGRAM_TYPES) {
        if (scores[String(t)] > maxScore) {
            maxScore = scores[String(t)];
            primaryType = t;
        }
    }

    // Determine wing (adjacent type with higher score)
    const wing = getWing(primaryType, scores);

    return { quizType: 'enneagram', scores, percentages, primaryType, wing, totalQuestions: questions.length };
}

/**
 * Determine the wing — the adjacent type (on the Enneagram circle) with the higher score.
 * The Enneagram is circular: 1's neighbors are 9 and 2; 9's neighbors are 8 and 1.
 * Returns null if both adjacent types have equal scores.
 */
function getWing(primaryType: EnneagramType, scores: Record<string, number>): EnneagramType | null {
    const prev = (primaryType === 1 ? 9 : primaryType - 1) as EnneagramType;
    const next = (primaryType === 9 ? 1 : primaryType + 1) as EnneagramType;

    const prevScore = scores[String(prev)] || 0;
    const nextScore = scores[String(next)] || 0;

    if (prevScore === nextScore) return null;
    return prevScore > nextScore ? prev : next;
}

/**
 * Runtime type guard for EnneagramResults from JSONB.
 * Use when reading `personality_results` from the database.
 */
export function isEnneagramResults(val: unknown): val is EnneagramResults {
    if (!val || typeof val !== 'object') return false;
    const v = val as Record<string, unknown>;
    return (
        v.quizType === 'enneagram' &&
        v.scores != null &&
        typeof v.scores === 'object' &&
        v.percentages != null &&
        typeof v.percentages === 'object' &&
        typeof v.primaryType === 'number'
    );
}

/**
 * Get a human-readable label for the result.
 * e.g. "Type 4w5 — The Individualist"
 */
export function getEnneagramLabel(primaryType: EnneagramType, wing: EnneagramType | null): string {
    if (wing != null) {
        return `Type ${primaryType}w${wing}`;
    }
    return `Type ${primaryType}`;
}
