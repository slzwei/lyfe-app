/**
 * Enneagram Personality Type Quiz — static content and scoring config.
 */
import type { IconName } from '@/types/ui';

export type EnneagramType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface EnneagramTypeInfo {
    label: string;
    name: string;
    icon: IconName;
    color: string;
    description: string;
    strengths: string[];
    growthTips: string[];
}

export interface EnneagramResults {
    quizType: 'enneagram';
    scores: Record<string, number>; // { "1": 5, "2": 8, ... "9": 3 }
    percentages: Record<string, number>;
    primaryType: EnneagramType;
    wing: EnneagramType | null;
    /** Total questions in the quiz variant (36 for sampler, 144 for full). Absent in legacy results. */
    totalQuestions?: number;
}

export const ENNEAGRAM_TYPES: EnneagramType[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const ENNEAGRAM_TYPE_INFO: Record<EnneagramType, EnneagramTypeInfo> = {
    1: {
        label: '1',
        name: 'The Reformer',
        icon: 'shield-checkmark-outline',
        color: '#007AFF',
        description:
            'Principled, purposeful, self-controlled, and perfectionistic. You have a strong sense of right and wrong and strive to improve yourself and the world around you.',
        strengths: ['Ethical and conscientious', 'Strong sense of purpose', 'Organised and disciplined'],
        growthTips: [
            'Be patient with imperfection in yourself and others',
            'Learn to relax and enjoy life without needing everything to be perfect',
            'Notice when your inner critic becomes overly harsh',
        ],
    },
    2: {
        label: '2',
        name: 'The Helper',
        icon: 'heart-outline',
        color: '#FF2D55',
        description:
            'Generous, demonstrative, people-pleasing, and caring. You want to be loved and needed, and are empathetic, sincere, and warm-hearted.',
        strengths: ['Empathetic and generous', 'Relationship-focused', 'Attuned to others\u2019 needs'],
        growthTips: [
            'Learn to receive help, not just give it',
            'Set healthy boundaries and say no when needed',
            'Address your own needs without feeling guilty',
        ],
    },
    3: {
        label: '3',
        name: 'The Achiever',
        icon: 'trophy-outline',
        color: '#FF9500',
        description:
            'Adaptable, driven, image-conscious, and excelling. You want to distinguish yourself, be admired, and impress others with your accomplishments.',
        strengths: ['Goal-oriented and efficient', 'Inspiring and motivating', 'Adaptable to any situation'],
        growthTips: [
            'Slow down and connect with your genuine feelings',
            'Value who you are, not just what you achieve',
            'Avoid confusing self-worth with external success',
        ],
    },
    4: {
        label: '4',
        name: 'The Individualist',
        icon: 'color-palette-outline',
        color: '#AF52DE',
        description:
            'Expressive, dramatic, self-aware, and temperamental. You want to find yourself and create an identity that reflects your unique inner experience.',
        strengths: [
            'Emotionally honest and creative',
            'Deep empathy and intuition',
            'Appreciation for beauty and meaning',
        ],
        growthTips: [
            'Ground yourself in the present moment',
            'Appreciate what you have instead of longing for what\u2019s missing',
            'Let go of the need to be different or special',
        ],
    },
    5: {
        label: '5',
        name: 'The Investigator',
        icon: 'search-outline',
        color: '#5856D6',
        description:
            'Perceptive, innovative, private, and analytical. You want to understand the world around you and feel competent and capable.',
        strengths: ['Independent and innovative thinker', 'Observant and insightful', 'Ability to focus deeply'],
        growthTips: [
            'Engage with the world more \u2014 not everything needs to be figured out first',
            'Share your knowledge and ideas with others openly',
            'Balance thinking with action and embodied experience',
        ],
    },
    6: {
        label: '6',
        name: 'The Loyalist',
        icon: 'shield-outline',
        color: '#34C759',
        description:
            'Engaging, responsible, anxious, and vigilant. You want to feel secure and supported, and you value trust, commitment, and reliability.',
        strengths: ['Loyal and committed', 'Responsible and hardworking', 'Able to foresee potential problems'],
        growthTips: [
            'Trust your own inner guidance and judgment',
            'Recognise when anxiety is distorting your perception of reality',
            'Take action despite doubt \u2014 courage is acting while afraid',
        ],
    },
    7: {
        label: '7',
        name: 'The Enthusiast',
        icon: 'sunny-outline',
        color: '#FFCC00',
        description:
            'Spontaneous, versatile, acquisitive, and scattered. You want to maintain your freedom and happiness, and avoid missing out on worthwhile experiences.',
        strengths: ['Optimistic and energetic', 'Quick-minded and versatile', 'Ability to inspire and uplift others'],
        growthTips: [
            'Stay present with difficult feelings instead of distracting yourself',
            'Follow through on commitments before moving to the next thing',
            'Find depth and satisfaction in fewer experiences rather than breadth',
        ],
    },
    8: {
        label: '8',
        name: 'The Challenger',
        icon: 'flash-outline',
        color: '#FF3B30',
        description:
            'Self-confident, decisive, willful, and confrontational. You want to be self-reliant, prove your strength, and resist showing vulnerability.',
        strengths: ['Decisive and action-oriented', 'Protective of others', 'Natural leadership presence'],
        growthTips: [
            'Allow yourself to be vulnerable \u2014 it\u2019s a sign of strength, not weakness',
            'Listen to others fully before reacting',
            'Use your power to empower others, not to dominate',
        ],
    },
    9: {
        label: '9',
        name: 'The Peacemaker',
        icon: 'leaf-outline',
        color: '#30B0C7',
        description:
            'Receptive, reassuring, agreeable, and complacent. You want to maintain inner and outer peace, avoid conflict, and keep things running smoothly.',
        strengths: ['Calm and stabilising presence', 'Accepting and non-judgmental', 'Able to see all perspectives'],
        growthTips: [
            'Express your own needs and opinions \u2014 they matter',
            'Engage with conflict constructively instead of avoiding it',
            'Recognise your own importance and take initiative',
        ],
    },
};

/** Fraction of questions that must be answered for a confident result (70%) */
export const ENNEAGRAM_MIN_ANSWERED_PCT = 0.7;

/** Default total question count for legacy results missing totalQuestions */
export const ENNEAGRAM_DEFAULT_TOTAL = 144;
