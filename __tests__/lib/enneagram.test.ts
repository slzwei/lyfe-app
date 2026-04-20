import {
    parseEnneagramTypeMapping,
    computeEnneagramScores,
    isEnneagramResults,
    getEnneagramLabel,
} from '@/lib/enneagram';
import type { ExamQuestion } from '@/types/exam';

function makeQuestion(id: string, num: number, typeA: number, typeB: number): ExamQuestion {
    return {
        id,
        paper_id: 'ennea-paper',
        question_number: num,
        question_text: 'Choose the statement that describes you best.',
        has_latex: false,
        options: { A: 'Statement A', B: 'Statement B' },
        correct_answer: '',
        explanation: JSON.stringify({ quiz_type: 'enneagram', types: { A: typeA, B: typeB } }),
        explanation_has_latex: false,
    };
}

// ── parseEnneagramTypeMapping ──

describe('parseEnneagramTypeMapping', () => {
    it('parses valid enneagram explanation JSON', () => {
        const result = parseEnneagramTypeMapping('{"quiz_type":"enneagram","types":{"A":4,"B":6}}');
        expect(result).toEqual({ A: 4, B: 6 });
    });

    it('returns null for null input', () => {
        expect(parseEnneagramTypeMapping(null)).toBeNull();
    });

    it('returns null for non-enneagram JSON', () => {
        expect(parseEnneagramTypeMapping('{"quiz_type":"vark"}')).toBeNull();
    });

    it('returns null for invalid JSON', () => {
        expect(parseEnneagramTypeMapping('not json')).toBeNull();
    });

    it('returns null for empty string', () => {
        expect(parseEnneagramTypeMapping('')).toBeNull();
    });
});

// ── computeEnneagramScores ──

describe('computeEnneagramScores', () => {
    it('tallies answers correctly for a simple case', () => {
        const questions = [
            makeQuestion('q1', 1, 4, 6), // A=type4, B=type6
            makeQuestion('q2', 2, 8, 9), // A=type8, B=type9
            makeQuestion('q3', 3, 3, 1), // A=type3, B=type1
        ];
        const answers: Record<string, string> = {
            q1: 'A', // +1 type 4
            q2: 'B', // +1 type 9
            q3: 'A', // +1 type 3
        };

        const result = computeEnneagramScores(questions, answers);
        expect(result.quizType).toBe('enneagram');
        expect(result.scores['3']).toBe(1);
        expect(result.scores['4']).toBe(1);
        expect(result.scores['9']).toBe(1);
        // All other types should be 0
        expect(result.scores['1']).toBe(0);
        expect(result.scores['2']).toBe(0);
    });

    it('identifies the primary type as the highest scoring', () => {
        const questions = [
            makeQuestion('q1', 1, 4, 6),
            makeQuestion('q2', 2, 4, 9),
            makeQuestion('q3', 3, 4, 1),
            makeQuestion('q4', 4, 6, 1),
        ];
        const answers: Record<string, string> = {
            q1: 'A', // type 4
            q2: 'A', // type 4
            q3: 'A', // type 4
            q4: 'A', // type 6
        };

        const result = computeEnneagramScores(questions, answers);
        expect(result.primaryType).toBe(4);
    });

    it('determines wing as the adjacent type with higher score', () => {
        // Type 4's adjacent types are 3 and 5
        const questions = [
            makeQuestion('q1', 1, 4, 6),
            makeQuestion('q2', 2, 4, 9),
            makeQuestion('q3', 3, 4, 1),
            makeQuestion('q4', 4, 5, 1), // type 5 (adjacent to 4)
            makeQuestion('q5', 5, 3, 1), // type 3 (adjacent to 4)
            makeQuestion('q6', 6, 5, 1), // type 5 again
        ];
        const answers: Record<string, string> = {
            q1: 'A', // type 4
            q2: 'A', // type 4
            q3: 'A', // type 4
            q4: 'A', // type 5
            q5: 'A', // type 3
            q6: 'A', // type 5
        };

        const result = computeEnneagramScores(questions, answers);
        expect(result.primaryType).toBe(4);
        expect(result.wing).toBe(5); // 5 scored higher than 3
    });

    it('wraps around for type 9 wings (8 and 1)', () => {
        const questions = [
            makeQuestion('q1', 1, 9, 2),
            makeQuestion('q2', 2, 9, 3),
            makeQuestion('q3', 3, 9, 4),
            makeQuestion('q4', 4, 1, 5), // type 1 (adjacent to 9)
            makeQuestion('q5', 5, 8, 5), // type 8 (adjacent to 9)
            makeQuestion('q6', 6, 1, 5), // type 1 again
        ];
        const answers: Record<string, string> = {
            q1: 'A', // type 9
            q2: 'A', // type 9
            q3: 'A', // type 9
            q4: 'A', // type 1
            q5: 'A', // type 8
            q6: 'A', // type 1
        };

        const result = computeEnneagramScores(questions, answers);
        expect(result.primaryType).toBe(9);
        expect(result.wing).toBe(1); // 1 scored higher than 8
    });

    it('wraps around for type 1 wings (9 and 2)', () => {
        const questions = [
            makeQuestion('q1', 1, 1, 3),
            makeQuestion('q2', 2, 1, 4),
            makeQuestion('q3', 3, 1, 5),
            makeQuestion('q4', 4, 9, 6), // type 9 (adjacent to 1)
            makeQuestion('q5', 5, 2, 7), // type 2 (adjacent to 1)
        ];
        const answers: Record<string, string> = {
            q1: 'A', // type 1
            q2: 'A', // type 1
            q3: 'A', // type 1
            q4: 'A', // type 9
            q5: 'A', // type 2
        };

        const result = computeEnneagramScores(questions, answers);
        expect(result.primaryType).toBe(1);
        // type 9 and type 2 both scored 1, so wing should be null (equal)
        expect(result.wing).toBeNull();
    });

    it('returns null wing when adjacent types have equal scores', () => {
        const questions = [
            makeQuestion('q1', 1, 5, 1),
            makeQuestion('q2', 2, 5, 2),
            makeQuestion('q3', 3, 4, 9), // type 4 (adjacent to 5)
            makeQuestion('q4', 4, 6, 9), // type 6 (adjacent to 5)
        ];
        const answers: Record<string, string> = {
            q1: 'A', // type 5
            q2: 'A', // type 5
            q3: 'A', // type 4
            q4: 'A', // type 6
        };

        const result = computeEnneagramScores(questions, answers);
        expect(result.primaryType).toBe(5);
        expect(result.wing).toBeNull(); // 4 and 6 both scored 1
    });

    it('computes percentages correctly', () => {
        const questions = [
            makeQuestion('q1', 1, 4, 6),
            makeQuestion('q2', 2, 4, 6),
            makeQuestion('q3', 3, 4, 6),
            makeQuestion('q4', 4, 6, 9),
        ];
        const answers: Record<string, string> = {
            q1: 'A', // type 4
            q2: 'A', // type 4
            q3: 'B', // type 6
            q4: 'B', // type 9
        };

        const result = computeEnneagramScores(questions, answers);
        // Total: 4 answers. Type4=2, Type6=1, Type9=1
        expect(result.percentages['4']).toBe(50);
        expect(result.percentages['6']).toBe(25);
        expect(result.percentages['9']).toBe(25);
    });

    it('handles unanswered questions', () => {
        const questions = [makeQuestion('q1', 1, 4, 6), makeQuestion('q2', 2, 8, 9)];
        const answers: Record<string, string> = {
            q1: 'A', // type 4
            // q2 unanswered
        };

        const result = computeEnneagramScores(questions, answers);
        expect(result.scores['4']).toBe(1);
        expect(result.scores['8']).toBe(0);
        expect(result.scores['9']).toBe(0);
    });

    it('handles empty answers object', () => {
        const questions = [makeQuestion('q1', 1, 4, 6)];
        const result = computeEnneagramScores(questions, {});
        // All scores should be 0
        for (let t = 1; t <= 9; t++) {
            expect(result.scores[String(t)]).toBe(0);
            expect(result.percentages[String(t)]).toBe(0);
        }
    });

    it('skips questions with non-enneagram explanation', () => {
        const questions = [makeQuestion('q1', 1, 4, 6), makeQuestion('q2', 2, 8, 9)];
        questions[0].explanation = 'Not enneagram JSON';
        const answers: Record<string, string> = {
            q1: 'A',
            q2: 'B', // type 9
        };

        const result = computeEnneagramScores(questions, answers);
        expect(result.scores['4']).toBe(0); // q1 skipped
        expect(result.scores['9']).toBe(1);
    });
});

// ── getEnneagramLabel ──

describe('getEnneagramLabel', () => {
    it('returns type with wing', () => {
        expect(getEnneagramLabel(4, 5)).toBe('Type 4w5 — Individualist with a Investigator wing');
    });

    it('returns type without wing', () => {
        expect(getEnneagramLabel(7, null)).toBe('Type 7 — Enthusiast');
    });

    it('returns type 9 with wing 1', () => {
        expect(getEnneagramLabel(9, 1)).toBe('Type 9w1 — Peacemaker with a Reformer wing');
    });
});

// ── isEnneagramResults ──

describe('isEnneagramResults', () => {
    const validResults = {
        quizType: 'enneagram',
        scores: { '1': 5, '2': 8, '3': 3, '4': 12, '5': 10, '6': 4, '7': 2, '8': 1, '9': 3 },
        percentages: { '1': 10, '2': 17, '3': 6, '4': 25, '5': 21, '6': 8, '7': 4, '8': 2, '9': 6 },
        primaryType: 4,
        wing: 5,
    };

    it('returns true for valid EnneagramResults object', () => {
        expect(isEnneagramResults(validResults)).toBe(true);
    });

    it('returns false for null', () => {
        expect(isEnneagramResults(null)).toBe(false);
    });

    it('returns false for a string', () => {
        expect(isEnneagramResults('not an object')).toBe(false);
    });

    it('returns false for VARK results', () => {
        expect(
            isEnneagramResults({
                scores: { V: 3, A: 2, R: 1, K: 0 },
                percentages: { V: 50, A: 33, R: 17, K: 0 },
                topTypes: ['V'],
                preference: 'single',
            }),
        ).toBe(false);
    });

    it('returns false for object without quizType', () => {
        const { quizType, ...rest } = validResults;
        expect(isEnneagramResults(rest)).toBe(false);
    });

    it('returns false for object with wrong quizType', () => {
        expect(isEnneagramResults({ ...validResults, quizType: 'vark' })).toBe(false);
    });

    it('returns false for object missing scores', () => {
        const { scores, ...rest } = validResults;
        expect(isEnneagramResults(rest)).toBe(false);
    });

    it('returns false for object with non-numeric primaryType', () => {
        expect(isEnneagramResults({ ...validResults, primaryType: 'four' })).toBe(false);
    });
});
