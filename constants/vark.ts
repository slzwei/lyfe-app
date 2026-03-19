/**
 * VARK Learning Style Quiz — static content and scoring config.
 */
import type { IconName } from '@/types/ui';

export type VarkType = 'V' | 'A' | 'R' | 'K';

export interface VarkTypeInfo {
    label: string;
    icon: IconName;
    description: string;
    tips: string[];
}

export type VarkPreference = 'single' | 'bimodal' | 'trimodal' | 'multimodal';

export interface VarkResults {
    scores: Record<VarkType, number>;
    percentages: Record<VarkType, number>;
    preference: VarkPreference;
    topTypes: VarkType[];
}

export const VARK_TYPE_INFO: Record<VarkType, VarkTypeInfo> = {
    V: {
        label: 'Visual',
        icon: 'eye-outline',
        description:
            'You often prefer information that is organized visually through maps, diagrams, charts, flowcharts, and spatial layout.',
        tips: [
            'Use mind maps and flowcharts to organize information',
            'Color-code your notes and highlight patterns or relationships',
            'Turn ideas into diagrams, timelines, or comparison charts',
            'Sketch the structure of a topic before studying the details',
            'Create your own visual summaries instead of only looking at others\u2019',
        ],
    },
    A: {
        label: 'Aural',
        icon: 'ear-outline',
        description:
            'You often prefer learning through listening, discussing, asking questions, and talking ideas through out loud.',
        tips: [
            'Record explanations or key points and listen again',
            'Explain ideas out loud to yourself or someone else',
            'Join study groups and ask questions in discussion',
            'Use podcasts, voice notes, or spoken summaries',
            'Repeat key ideas verbally to help fix them in memory',
        ],
    },
    R: {
        label: 'Read/Write',
        icon: 'book-outline',
        description:
            'You often prefer information presented in words, such as articles, manuals, notes, lists, and written explanations.',
        tips: [
            'Take detailed notes during lectures and meetings',
            'Rewrite key ideas in your own words',
            'Create lists, outlines, and written summaries',
            'Read articles, textbooks, and reference materials',
            'Turn diagrams or spoken explanations into written notes',
        ],
    },
    K: {
        label: 'Kinesthetic',
        icon: 'hand-left-outline',
        description:
            'You often prefer concrete examples, hands-on practice, trial and error, simulation, and learning from real situations.',
        tips: [
            'Learn by doing with simulations, labs, and real-world practice',
            'Use worked examples and case studies',
            'Apply new ideas quickly through exercises or projects',
            'Connect abstract ideas to real situations and personal experience',
            'Practice actively instead of only watching or reading',
        ],
    },
};

/** Minimum questions answered for a confident result */
export const VARK_MIN_ANSWERED = 12;

/**
 * Stepping distance used to classify preference.
 * If the gap between adjacent ranked types is >= this value,
 * everything below is excluded from the "top" group.
 * Standard VARK uses ~2 for 16-question quizzes.
 */
export const VARK_STEP_DISTANCE = 2;

/** Bar chart colors — keyed to VarkType, using theme-safe semantic names */
export const VARK_CHART_COLORS: Record<VarkType, { colorKey: string; fallback: string }> = {
    V: { colorKey: 'accent', fallback: '#FF7600' },
    A: { colorKey: 'info', fallback: '#007AFF' },
    R: { colorKey: 'success', fallback: '#34C759' },
    K: { colorKey: 'roadmapExam', fallback: '#AF52DE' },
};
