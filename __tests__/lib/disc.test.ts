import { computeDiscScores, isDiscResults, getDiscLabel, getCircumplexType } from '@/lib/disc';
import type { DiscResults } from '@/constants/disc';

describe('computeDiscScores', () => {
    it('returns midline percentages when all word pairs/ratings are center (3)', () => {
        const answers: Record<number, number | string> = {};
        // Word pairs: all center (no contribution)
        for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 39, 17, 18, 19, 20, 21, 22, 23, 24]) {
            answers[id] = 3;
        }
        // Single words: all center
        for (let i = 25; i <= 32; i++) answers[i] = 3;
        // Scenarios: alternate A/B
        answers[33] = 'A';
        answers[34] = 'B';
        answers[35] = 'A';
        answers[36] = 'A';
        answers[37] = 'B';
        answers[38] = 'B';

        const result = computeDiscScores(answers);
        expect(result.quizType).toBe('disc');
        expect(result.totalQuestions).toBe(39);
        // Only scenarios contribute; percentages should be near midline
        expect(typeof result.d_pct).toBe('number');
        expect(typeof result.angle).toBe('number');
        expect(typeof result.profile_strength).toBe('string');
        expect(result.priorities.length).toBeGreaterThanOrEqual(3);
    });

    it('produces a strong D type when answers favour active + skeptical', () => {
        const answers: Record<number, number | string> = {};
        // Word pairs: push left types that are D, push right types that are D
        // For D-boosting: pick the side that adds to D, subtract from others
        // Questions with leftType=D: Q6(D/I), Q14(D/I), Q15(D/I) → pick left (value=5)
        // Questions with rightType=D: Q3(C/D), Q8(S/D), Q9(S/D), Q11(C/D), Q12(S/D),
        //   Q16(S/D), Q20(S/D), Q23(C/D), Q24(S/D) → pick right (value=1)
        // All other word pairs: center (3)
        for (const id of [1, 2, 4, 5, 7, 10, 13, 17, 18, 19, 21, 22, 39]) {
            answers[id] = 3;
        }
        answers[6] = 5;
        answers[14] = 5;
        answers[15] = 5; // D on left
        answers[3] = 1;
        answers[8] = 1;
        answers[9] = 1;
        answers[11] = 1;
        answers[12] = 1;
        answers[16] = 1;
        answers[20] = 1;
        answers[23] = 1;
        answers[24] = 1; // D on right

        // Single words: D-type high, others low
        answers[26] = 5; // Daring (D)
        answers[32] = 5; // Determined (D)
        answers[25] = 1; // Agreeable (S)
        answers[27] = 1; // Sociable (I)
        answers[28] = 1; // Optimistic (I)
        answers[29] = 1; // Patient (S)
        answers[30] = 1; // Systematic (C)
        answers[31] = 1; // Detail-Oriented (C)

        // Scenarios: active + skeptical choices
        answers[33] = 'A'; // n (active → D,I)
        answers[34] = 'A'; // e (skeptical → D,C)
        answers[35] = 'A'; // n (active → D,I)
        answers[36] = 'B'; // e (skeptical → D,C)
        answers[37] = 'A'; // e (skeptical → D,C)
        answers[38] = 'A'; // e (skeptical → D,C)

        const result = computeDiscScores(answers);
        expect(result.d_pct).toBeGreaterThan(result.i_pct);
        expect(result.d_pct).toBeGreaterThan(result.s_pct);
        expect(result.d_pct).toBeGreaterThan(result.c_pct);
        // Angle should be in D range (120-150°) or adjacent
        expect(result.angle).toBeGreaterThan(89);
        expect(result.angle).toBeLessThan(181);
    });

    it('produces an I type when answers favour active + agreeable', () => {
        const answers: Record<number, number | string> = {};
        // Questions with leftType=I: Q1(I/C), Q2(I/C), Q4(I/S), Q7(I/S),
        //   Q10(I/C), Q13(I/S), Q18(I/C), Q21(I/C), Q22(I/C) → pick left (value=5)
        // Questions with rightType=I: Q6(D/I), Q14(D/I), Q15(D/I), Q19(C/I) → pick right (value=1)
        for (const id of [3, 5, 8, 9, 11, 12, 16, 17, 20, 23, 24, 39]) {
            answers[id] = 3;
        }
        answers[1] = 5;
        answers[2] = 5;
        answers[4] = 5;
        answers[7] = 5;
        answers[10] = 5;
        answers[13] = 5;
        answers[18] = 5;
        answers[21] = 5;
        answers[22] = 5; // I on left
        answers[6] = 1;
        answers[14] = 1;
        answers[15] = 1;
        answers[19] = 1; // I on right

        // Single words: I-type high
        answers[27] = 5; // Sociable (I)
        answers[28] = 5; // Optimistic (I)
        answers[26] = 1;
        answers[25] = 1;
        answers[29] = 1;
        answers[30] = 1;
        answers[31] = 1;
        answers[32] = 1;

        // Scenarios: active + agreeable
        answers[33] = 'A'; // n (active → D,I)
        answers[34] = 'B'; // w (agreeable → I,S)
        answers[35] = 'A'; // n (active → D,I)
        answers[36] = 'A'; // w (agreeable → I,S)
        answers[37] = 'B'; // w (agreeable → I,S)
        answers[38] = 'B'; // w (agreeable → I,S)

        const result = computeDiscScores(answers);
        expect(result.i_pct).toBeGreaterThan(result.d_pct);
        expect(result.i_pct).toBeGreaterThan(result.s_pct);
        expect(result.i_pct).toBeGreaterThan(result.c_pct);
    });

    it('computes independent percentages that do NOT sum to 100', () => {
        const answers: Record<number, number | string> = {};
        // Push D and I both high (active axis)
        for (const id of [1, 2, 4, 5, 7, 10, 13, 17, 18, 21, 22, 39]) {
            answers[id] = 3;
        }
        // Active questions → push active (right side for receptive/active pairs)
        answers[3] = 1;
        answers[8] = 1;
        answers[11] = 1;
        answers[12] = 1;
        answers[16] = 1;
        answers[19] = 1;
        answers[20] = 1;
        answers[23] = 1;
        answers[24] = 1;
        // D and I left types → pick left
        answers[6] = 5;
        answers[14] = 5;
        answers[15] = 5;
        answers[9] = 3;

        for (let i = 25; i <= 32; i++) answers[i] = 3;
        answers[33] = 'A';
        answers[34] = 'A';
        answers[35] = 'A';
        answers[36] = 'B';
        answers[37] = 'A';
        answers[38] = 'A';

        const result = computeDiscScores(answers);
        const sum = result.d_pct + result.i_pct + result.s_pct + result.c_pct;
        // Independent normalization — should NOT sum to exactly 100
        // (it could vary widely based on answers)
        expect(sum).not.toBe(100);
    });

    it('returns balanced profile when all answers are perfectly neutral', () => {
        const answers: Record<number, number | string> = {};
        for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 39, 17, 18, 19, 20, 21, 22, 23, 24]) {
            answers[id] = 3;
        }
        for (let i = 25; i <= 32; i++) answers[i] = 3;
        // Scenarios that cancel out: equal n/s and e/w
        answers[33] = 'A'; // n
        answers[34] = 'A'; // e
        answers[35] = 'B'; // s
        answers[36] = 'A'; // w
        answers[37] = 'B'; // w
        answers[38] = 'A'; // e

        const result = computeDiscScores(answers);
        // With neutral word pairs/ratings and balanced scenarios,
        // magnitude should be low → balanced profile
        // n=2, s=1 → v=1; e=2, w=2 → h=0
        // magnitude = sqrt(1+0) = 1, strength_pct = 1 < 15
        expect(result.profile_strength).toBe('balanced');
        expect(result.disc_type).toBe('Balanced');
    });

    it('returns near-midline percentages when no answers provided', () => {
        const result = computeDiscScores({});
        // With no answers, raw=0 for each type. Independent normalization
        // maps 0 relative to the theoretical min/max range (asymmetric
        // because Format C only adds). Result is ~45% for each type.
        for (const pct of [result.d_pct, result.i_pct, result.s_pct, result.c_pct]) {
            expect(pct).toBeGreaterThanOrEqual(40);
            expect(pct).toBeLessThanOrEqual(50);
        }
    });

    it('computes priorities as an array of 3-5 items', () => {
        const answers: Record<number, number | string> = {};
        for (const id of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 39, 17, 18, 19, 20, 21, 22, 23, 24]) {
            answers[id] = 5; // all-left
        }
        for (let i = 25; i <= 32; i++) answers[i] = 5;
        answers[33] = 'A';
        answers[34] = 'A';
        answers[35] = 'A';
        answers[36] = 'A';
        answers[37] = 'A';
        answers[38] = 'A';

        const result = computeDiscScores(answers);
        expect(result.priorities.length).toBeGreaterThanOrEqual(3);
        expect(result.priorities.length).toBeLessThanOrEqual(5);
        // Each priority should be a string
        result.priorities.forEach((p) => expect(typeof p).toBe('string'));
    });
});

describe('getCircumplexType', () => {
    it('maps angles to the correct 12 types', () => {
        expect(getCircumplexType(15)).toBe('Is');
        expect(getCircumplexType(45)).toBe('I');
        expect(getCircumplexType(75)).toBe('Id');
        expect(getCircumplexType(105)).toBe('Di');
        expect(getCircumplexType(135)).toBe('D');
        expect(getCircumplexType(165)).toBe('Dc');
        expect(getCircumplexType(195)).toBe('Cd');
        expect(getCircumplexType(225)).toBe('C');
        expect(getCircumplexType(255)).toBe('Cs');
        expect(getCircumplexType(285)).toBe('Sc');
        expect(getCircumplexType(315)).toBe('S');
        expect(getCircumplexType(345)).toBe('Si');
    });

    it('handles boundary angles correctly', () => {
        expect(getCircumplexType(0)).toBe('Is');
        expect(getCircumplexType(30)).toBe('I');
        expect(getCircumplexType(90)).toBe('Di');
        expect(getCircumplexType(180)).toBe('Cd');
        expect(getCircumplexType(270)).toBe('Sc');
        expect(getCircumplexType(330)).toBe('Si');
        expect(getCircumplexType(359.9)).toBe('Si');
    });
});

describe('isDiscResults', () => {
    it('returns true for valid DISC results', () => {
        const valid: DiscResults = {
            quizType: 'disc',
            d_raw: 10,
            i_raw: 5,
            s_raw: -3,
            c_raw: 2,
            d_pct: 72,
            i_pct: 58,
            s_pct: 35,
            c_pct: 48,
            disc_type: 'Di',
            angle: 105,
            profile_strength: 'strong',
            strength_pct: 55,
            priorities: ['Action', 'Results', 'Enthusiasm'],
            totalQuestions: 39,
        };
        expect(isDiscResults(valid)).toBe(true);
    });

    it('returns false for enneagram results', () => {
        expect(isDiscResults({ quizType: 'enneagram', scores: {}, primaryType: 1 })).toBe(false);
    });

    it('returns false for old-format DISC results', () => {
        // Old format with primaryType/subtype/scores — should not match new guard
        expect(
            isDiscResults({
                quizType: 'disc',
                primaryType: 'D',
                subtype: 'Di',
                scores: { D: 8, I: 5, S: 2, C: 3 },
                percentages: { D: 44, I: 28, S: 11, C: 17 },
            }),
        ).toBe(false);
    });

    it('returns false for null/undefined', () => {
        expect(isDiscResults(null)).toBe(false);
        expect(isDiscResults(undefined)).toBe(false);
    });
});

describe('getDiscLabel', () => {
    it('returns full name for pure type', () => {
        expect(getDiscLabel('D')).toBe('Drive');
        expect(getDiscLabel('I')).toBe('Influence');
    });

    it('returns combined name for subtype', () => {
        expect(getDiscLabel('Di')).toBe('Drive/influence');
        expect(getDiscLabel('Is')).toBe('Influence/support');
    });

    it('returns Balanced for balanced type', () => {
        expect(getDiscLabel('Balanced')).toBe('Balanced');
    });
});
