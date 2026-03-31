/**
 * DISC scoring logic — pure functions, no side effects.
 *
 * Scoring model:
 *   1. Accumulate raw D/I/S/C scores directly from questions
 *   2. Normalize each dimension independently (0-100, NOT summing to 100)
 *   3. Compute circumplex angle via atan2
 *   4. Map angle to 12 types (30° segments) with Balanced override
 *   5. Compute profile strength and priorities
 */
import type { DiscType, DiscResults, DiscResultType } from '@/constants/disc';
import {
    DISC_TYPES,
    DISC_TYPE_INFO,
    DISC_SUBTYPE_DISPLAY,
    DISC_WORD_PAIR_QUESTIONS,
    DISC_SINGLE_WORD_QUESTIONS,
    DISC_SCENARIO_QUESTIONS,
    DISC_PRIORITIES,
    DISC_TOTAL_QUESTIONS,
    AXIS_EFFECTS,
} from '@/constants/disc';

// ── Main Scoring Function ────────────────────────────────────────

/**
 * Compute DISC scores from raw answers.
 *
 * @param answers — Map of question id (number) → answer value.
 *   Word pairs (1–24, 39): number 1–5  (far-left=5, far-right=1)
 *   Single words (25–32):  number 1–5  (not like me=1, like me=5)
 *   Scenarios (33–38):     "A" or "B"
 */
export function computeDiscScores(answers: Record<number, number | string>): DiscResults {
    // ── Step A: Accumulate raw scores per DISC type ────────
    const raw: Record<DiscType, number> = { D: 0, I: 0, S: 0, C: 0 };

    // Format A: Word Pairs
    for (const step of [1, 2, 3] as const) {
        for (const q of DISC_WORD_PAIR_QUESTIONS[step]) {
            const value = answers[q.id];
            if (value == null || typeof value !== 'number') continue;
            const contribution = value - 3; // -2 to +2
            raw[q.leftType] += contribution;
            raw[q.rightType] -= contribution;
        }
    }

    // Format B: Single-Word Ratings
    for (const q of DISC_SINGLE_WORD_QUESTIONS) {
        const value = answers[q.id];
        if (value == null || typeof value !== 'number') continue;
        raw[q.discType] += value - 3;
    }

    // Format C: Scenario Binary Choice
    for (const q of DISC_SCENARIO_QUESTIONS) {
        const value = answers[q.id];
        if (value == null || typeof value !== 'string') continue;
        const chosenAxis = value === 'A' ? q.optionA.axis : q.optionB.axis;
        const [type1, type2] = AXIS_EFFECTS[chosenAxis];
        raw[type1] += 1;
        raw[type2] += 1;
    }

    // ── Step B: Normalize to 0-100 (independent per dimension) ─
    const ranges = computeDimensionRanges();
    const pct: Record<DiscType, number> = { D: 50, I: 50, S: 50, C: 50 };
    for (const t of DISC_TYPES) {
        const { min, max } = ranges[t];
        const range = max - min;
        pct[t] = range === 0 ? 50 : Math.max(0, Math.min(100, Math.round(((raw[t] - min) / range) * 100)));
    }

    // ── Step C: Calculate circumplex angle ──────────────────
    const verticalScore = raw.D + raw.I - (raw.S + raw.C); // Active vs Receptive
    const horizontalScore = raw.I + raw.S - (raw.D + raw.C); // Agreeable vs Skeptical

    let angle = Math.atan2(verticalScore, horizontalScore) * (180 / Math.PI);
    if (angle < 0) angle += 360;

    // ── Step D: Compute profile strength ────────────────────
    const magnitude = Math.sqrt(verticalScore ** 2 + horizontalScore ** 2);
    const strength_pct = Math.min(100, Math.round(magnitude));
    const profile_strength: 'balanced' | 'moderate' | 'strong' =
        strength_pct < 15 ? 'balanced' : strength_pct < 45 ? 'moderate' : 'strong';

    // ── Step E: Map angle to type ───────────────────────────
    const circumplexType = getCircumplexType(angle);
    const disc_type: DiscResultType = profile_strength === 'balanced' ? 'Balanced' : circumplexType;

    // ── Step F: Compute priorities ──────────────────────────
    const priorities = computePriorities(angle);

    return {
        quizType: 'disc',
        d_raw: raw.D,
        i_raw: raw.I,
        s_raw: raw.S,
        c_raw: raw.C,
        d_pct: pct.D,
        i_pct: pct.I,
        s_pct: pct.S,
        c_pct: pct.C,
        disc_type,
        angle,
        profile_strength,
        strength_pct,
        priorities,
        totalQuestions: DISC_TOTAL_QUESTIONS,
    };
}

// ── Dimension Ranges ─────────────────────────────────────────────

/** Compute theoretical min/max raw score for each DISC type from the question pool. */
function computeDimensionRanges(): Record<DiscType, { min: number; max: number }> {
    const ranges: Record<DiscType, { min: number; max: number }> = {
        D: { min: 0, max: 0 },
        I: { min: 0, max: 0 },
        S: { min: 0, max: 0 },
        C: { min: 0, max: 0 },
    };

    // Format A: each word pair affects both leftType and rightType by [-2, +2]
    for (const step of [1, 2, 3] as const) {
        for (const q of DISC_WORD_PAIR_QUESTIONS[step]) {
            ranges[q.leftType].min += -2;
            ranges[q.leftType].max += 2;
            ranges[q.rightType].min += -2;
            ranges[q.rightType].max += 2;
        }
    }

    // Format B: each single-word affects its discType by [-2, +2]
    for (const q of DISC_SINGLE_WORD_QUESTIONS) {
        ranges[q.discType].min += -2;
        ranges[q.discType].max += 2;
    }

    // Format C: chosen axis adds +1 to two types
    for (const q of DISC_SCENARIO_QUESTIONS) {
        const typesA = new Set(AXIS_EFFECTS[q.optionA.axis]);
        const typesB = new Set(AXIS_EFFECTS[q.optionB.axis]);
        for (const t of DISC_TYPES) {
            const inA = typesA.has(t);
            const inB = typesB.has(t);
            if (inA && inB) {
                ranges[t].min += 1;
                ranges[t].max += 1;
            } else if (inA || inB) {
                ranges[t].max += 1;
            }
        }
    }

    return ranges;
}

// ── Circumplex Type Mapping ──────────────────────────────────────

/** Map circumplex angle (0-360°) to one of 12 types (30° segments). */
export function getCircumplexType(angle: number): Exclude<DiscResultType, 'Balanced'> {
    if (angle >= 0 && angle < 30) return 'Is';
    if (angle >= 30 && angle < 60) return 'I';
    if (angle >= 60 && angle < 90) return 'Id';
    if (angle >= 90 && angle < 120) return 'Di';
    if (angle >= 120 && angle < 150) return 'D';
    if (angle >= 150 && angle < 180) return 'Dc';
    if (angle >= 180 && angle < 210) return 'Cd';
    if (angle >= 210 && angle < 240) return 'C';
    if (angle >= 240 && angle < 270) return 'Cs';
    if (angle >= 270 && angle < 300) return 'Sc';
    if (angle >= 300 && angle < 330) return 'S';
    return 'Si'; // 330-360
}

// ── Priorities ───────────────────────────────────────────────────

function angularDistance(a: number, b: number): number {
    let diff = Math.abs(a - b);
    if (diff > 180) diff = 360 - diff;
    return diff;
}

/** Select 3-5 priorities closest to the user's circumplex angle. */
function computePriorities(angle: number): string[] {
    const ranked = DISC_PRIORITIES.map((p) => ({ name: p.name, dist: angularDistance(p.angle, angle) })).sort(
        (a, b) => a.dist - b.dist,
    );

    // Always include 3 closest
    const names = ranked.slice(0, 3).map((r) => r.name);
    // Conditionally include 4th and 5th if within 60°
    for (let i = 3; i < Math.min(5, ranked.length); i++) {
        if (ranked[i].dist <= 60) names.push(ranked[i].name);
    }
    return names;
}

// ── Type Guard ───────────────────────────────────────────────────

/**
 * Runtime type guard for DiscResults from JSONB.
 * Use when reading `personality_results` from the database.
 */
export function isDiscResults(val: unknown): val is DiscResults {
    if (!val || typeof val !== 'object') return false;
    const v = val as Record<string, unknown>;
    return (
        v.quizType === 'disc' &&
        typeof v.d_raw === 'number' &&
        typeof v.disc_type === 'string' &&
        typeof v.angle === 'number'
    );
}

// ── Secondary Type ──────────────────────────────────────────────

/**
 * Get the secondary DISC type for a result.
 * For subtypes (e.g. 'Cs') the secondary is the second character.
 * For pure types (e.g. 'C') the secondary is the highest-scoring non-primary type.
 */
export function getSecondaryType(results: DiscResults): DiscType | null {
    if (results.disc_type === 'Balanced') return null;
    const primary = results.disc_type.charAt(0) as DiscType;
    if (results.disc_type.length === 2) {
        return results.disc_type.charAt(1).toUpperCase() as DiscType;
    }
    const pcts: [DiscType, number][] = [
        ['D', results.d_pct],
        ['I', results.i_pct],
        ['S', results.s_pct],
        ['C', results.c_pct],
    ];
    return pcts.filter(([t]) => t !== primary).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
}

// ── Display Helpers ──────────────────────────────────────────────

/** Get the human-readable label for a DISC result type, e.g. "Clarity (CS)". */
export function getDiscLabel(discType: DiscResultType): string {
    const info = DISC_TYPE_INFO[discType];
    if (discType === 'Balanced') return info.fullName;
    const displayCode = DISC_SUBTYPE_DISPLAY[discType];
    return displayCode && displayCode !== info.name ? `${info.name} (${displayCode})` : info.name;
}
