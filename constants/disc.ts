/**
 * DISC Personality Assessment — static content, question data, and scoring config.
 *
 * Circumplex model with 12 types + Balanced override:
 *   D (Drive)     = Active + Skeptical     (angle 120-150°)
 *   I (Influence)  = Active + Agreeable     (angle 30-60°)
 *   S (Support)    = Receptive + Agreeable  (angle 300-330°)
 *   C (Clarity)    = Receptive + Skeptical  (angle 210-240°)
 *
 * Circumplex axes:
 *   0°   = Agreeable (I+S, positive x)
 *   90°  = Active (D+I, positive y)
 *   180° = Skeptical (D+C, negative x)
 *   270° = Receptive (S+C, negative y)
 */
import type { IconName } from '@/types/ui';

// ── Types ────────────────────────────────────────────────────────

export type DiscType = 'D' | 'I' | 'S' | 'C';

export type DiscSubtype = 'Di' | 'Dc' | 'Id' | 'Is' | 'Si' | 'Sc' | 'Cs' | 'Cd';

export type DiscResultType = DiscType | DiscSubtype | 'Balanced';

export type AxisCode = 'n' | 's' | 'e' | 'w';

export interface DiscTypeInfo {
    label: string;
    name: string;
    fullName: string;
    motto: string;
    icon: IconName;
    color: string;
    descriptors: [string, string, string];
    description: string;
    strengths: [string, string, string, string];
    blindSpots: [string, string, string, string];
}

export interface DiscResults {
    quizType: 'disc';
    d_raw: number;
    i_raw: number;
    s_raw: number;
    c_raw: number;
    d_pct: number;
    i_pct: number;
    s_pct: number;
    c_pct: number;
    disc_type: DiscResultType;
    angle: number;
    profile_strength: 'strong' | 'moderate' | 'balanced';
    strength_pct: number;
    priorities: string[];
    totalQuestions: number;
}

export interface PriorityDef {
    name: string;
    angle: number;
    dimension: DiscType;
    description: string;
}

// ── Type Info ────────────────────────────────────────────────────

export const DISC_TYPES: DiscType[] = ['D', 'I', 'S', 'C'];

/** Axis effects for Format C scenario scoring */
export const AXIS_EFFECTS: Record<AxisCode, [DiscType, DiscType]> = {
    n: ['D', 'I'], // Active (north)
    s: ['S', 'C'], // Receptive (south)
    e: ['D', 'C'], // Skeptical (east)
    w: ['I', 'S'], // Agreeable (west)
};

export const DISC_TYPE_INFO: Record<DiscResultType, DiscTypeInfo> = {
    D: {
        label: 'D',
        name: 'Drive',
        fullName: 'Drive',
        motto: 'Let\u2019s get results.',
        icon: 'flash-outline',
        color: '#2B8C8C',
        descriptors: ['Results-oriented', 'Decisive', 'Competitive'],
        description:
            'Takes charge to get things done. Makes decisions and takes action. At work: Results-oriented and decisive; a competitive risk-taker; confident and a natural leader.',
        strengths: [
            'Makes quick, confident decisions under pressure',
            'Drives projects forward and holds people accountable',
            'Tackles challenges head-on without hesitation',
            'Sets ambitious goals and delivers results efficiently',
        ],
        blindSpots: [
            'May come across as impatient or dismissive of others\u2019 input',
            'Can prioritise speed over people\u2019s feelings',
            'Tendency to take over instead of delegating',
            'May overlook details when focused on the big picture',
        ],
    },
    I: {
        label: 'I',
        name: 'Influence',
        fullName: 'Influence',
        motto: 'Let\u2019s do this together!',
        icon: 'people-outline',
        color: '#7B5EA7',
        descriptors: ['Enthusiastic', 'Collaborative', 'Optimistic'],
        description:
            'Engages others and shares enthusiasm. Inspires and persuades others. At work: Enthusiastic and optimistic; a natural communicator; collaborative and people-focused.',
        strengths: [
            'Energises teams and creates a positive atmosphere',
            'Builds rapport quickly and connects people together',
            'Generates creative ideas and inspires new directions',
            'Communicates persuasively and rallies support for initiatives',
        ],
        blindSpots: [
            'May struggle with follow-through on routine tasks',
            'Can over-commit by saying yes to too many things',
            'Tendency to talk more than listen in discussions',
            'May avoid detailed planning or structured processes',
        ],
    },
    S: {
        label: 'S',
        name: 'Support',
        fullName: 'Support',
        motto: 'How can I help?',
        icon: 'heart-outline',
        color: '#D4876C',
        descriptors: ['Patient', 'Dependable', 'Supportive'],
        description:
            'Is helpful and shows care for others. Looks for ways to assist and serve. At work: Patient and dependable; a steady team player; warm and supportive.',
        strengths: [
            'Creates a stable, supportive environment for the team',
            'Listens carefully and makes others feel heard',
            'Follows through consistently \u2014 people can count on them',
            'Keeps calm during stressful or chaotic situations',
        ],
        blindSpots: [
            'May agree to things they\u2019re not comfortable with to avoid conflict',
            'Can be slow to adapt when plans or priorities shift',
            'Tendency to put others\u2019 needs ahead of their own too often',
            'May hold back opinions even when their input is valuable',
        ],
    },
    C: {
        label: 'C',
        name: 'Clarity',
        fullName: 'Clarity',
        motto: 'Let\u2019s get this right.',
        icon: 'analytics-outline',
        color: '#4A7FB5',
        descriptors: ['Detail-oriented', 'Analytical', 'Thorough'],
        description:
            'Works steadily within systems. Focuses on order, accuracy, and precision. At work: Detail-oriented and thorough; a quality-focused thinker; careful and systematic.',
        strengths: [
            'Catches errors and inconsistencies others miss',
            'Produces high-quality, well-researched work',
            'Brings logical structure to complex problems',
            'Maintains high standards and ensures compliance',
        ],
        blindSpots: [
            'May spend too long perfecting when \u2018good enough\u2019 would do',
            'Can come across as overly critical or nitpicky',
            'Tendency to delay decisions while gathering more data',
            'May struggle to delegate when others\u2019 standards differ',
        ],
    },
    Di: {
        label: 'Di',
        name: 'Drive',
        fullName: 'Drive/influence',
        motto: 'Let\u2019s make it happen!',
        icon: 'flash-outline',
        color: '#2B8C8C',
        descriptors: ['Charismatic', 'Resourceful', 'Action-oriented'],
        description:
            'Resourceful and charismatic. Takes charge of social situations. Builds rapport and brings people together while driving toward results.',
        strengths: [
            'Inspires confidence and gets people on board quickly',
            'Takes initiative and leads by example in high-pressure moments',
            'Balances people skills with a strong results focus',
            'Adapts approach to win support from different personalities',
        ],
        blindSpots: [
            'May dominate conversations or push ideas too forcefully',
            'Can lose patience with slower, more methodical colleagues',
            'Tendency to move on before fully completing current tasks',
            'May underestimate risks when enthusiasm runs high',
        ],
    },
    Dc: {
        label: 'Dc',
        name: 'Drive',
        fullName: 'Drive/clarity',
        motto: 'Let\u2019s do this the right way \u2014 fast.',
        icon: 'flash-outline',
        color: '#2B8C8C',
        descriptors: ['Focused', 'Efficient', 'High-standards'],
        description:
            'Focused on realistic results more than relationships. Maintains efficiency and continuous improvement. Has high expectations.',
        strengths: [
            'Combines speed with precision \u2014 gets quality results fast',
            'Sets and maintains very high standards for output',
            'Works independently and stays focused without oversight',
            'Identifies inefficiencies and streamlines processes',
        ],
        blindSpots: [
            'Can come across as cold or unapproachable',
            'May dismiss others\u2019 ideas if they seem impractical',
            'Tendency to be blunt in feedback, hurting team morale',
            'May resist collaborative approaches, preferring to work alone',
        ],
    },
    Id: {
        label: 'Id',
        name: 'Influence',
        fullName: 'Influence/drive',
        motto: 'Let\u2019s try something new!',
        icon: 'people-outline',
        color: '#7B5EA7',
        descriptors: ['Adventurous', 'Energetic', 'Big-picture'],
        description:
            'Approaches relationships and tasks with equal energy. Discusses big-picture ideas. Adventurous and able to create novel solutions.',
        strengths: [
            'Brings infectious energy that motivates the whole team',
            'Sees opportunities and possibilities others overlook',
            'Moves quickly from idea to action with enthusiasm',
            'Creates an exciting, dynamic work environment',
        ],
        blindSpots: [
            'May jump between ideas without finishing what was started',
            'Can overlook practical details and logistics',
            'Tendency to act on impulse rather than careful analysis',
            'May underestimate timelines and overcommit resources',
        ],
    },
    Is: {
        label: 'Is',
        name: 'Influence',
        fullName: 'Influence/support',
        motto: 'Everyone belongs here.',
        icon: 'people-outline',
        color: '#7B5EA7',
        descriptors: ['Inclusive', 'Adaptable', 'Collaborative'],
        description:
            'Fosters a collaborative environment where everyone belongs. Adapts easily to different work styles. Involves people in discussions.',
        strengths: [
            'Makes everyone feel included and valued in the team',
            'Reads the room well and adapts communication style',
            'Builds strong, trusting relationships across the organisation',
            'Creates psychological safety that encourages open dialogue',
        ],
        blindSpots: [
            'May avoid giving direct feedback to preserve harmony',
            'Can struggle with making unpopular but necessary decisions',
            'Tendency to prioritise consensus over speed',
            'May take criticism personally and dwell on it',
        ],
    },
    Si: {
        label: 'Si',
        name: 'Support',
        fullName: 'Support/influence',
        motto: 'I\u2019m here for you.',
        icon: 'heart-outline',
        color: '#D4876C',
        descriptors: ['Empathetic', 'Encouraging', 'Team-oriented'],
        description:
            'Shows support and empathy. Helps people achieve their goals. Easily adapts to difficult situations. Promotes teamwork.',
        strengths: [
            'Naturally empathetic \u2014 understands what people need',
            'Encourages and uplifts teammates during tough times',
            'Adapts smoothly to changing situations and group dynamics',
            'Builds strong team cohesion through genuine care',
        ],
        blindSpots: [
            'May agree too readily to keep everyone happy',
            'Can avoid raising issues until they become serious',
            'Tendency to absorb others\u2019 stress and burn out quietly',
            'May hesitate to take the lead even when it\u2019s needed',
        ],
    },
    Sc: {
        label: 'Sc',
        name: 'Support',
        fullName: 'Support/clarity',
        motto: 'Let\u2019s be thorough and steady.',
        icon: 'heart-outline',
        color: '#D4876C',
        descriptors: ['Careful', 'Consistent', 'Organized'],
        description:
            'Seeks predictability and consistency. Makes decisions carefully. Organized and attentive to details. Accommodates others.',
        strengths: [
            'Brings order and reliability to every project they touch',
            'Plans carefully and anticipates potential issues early',
            'Delivers consistent, high-quality work without drama',
            'Creates stable systems and processes the team can rely on',
        ],
        blindSpots: [
            'May resist change even when it\u2019s clearly beneficial',
            'Can get stuck in analysis paralysis on decisions',
            'Tendency to play it safe rather than take calculated risks',
            'May struggle to speak up in fast-moving group settings',
        ],
    },
    Cs: {
        label: 'Cs',
        name: 'Clarity',
        fullName: 'Clarity/support',
        motto: 'Let\u2019s do this properly.',
        icon: 'analytics-outline',
        color: '#4A7FB5',
        descriptors: ['Responsible', 'Reliable', 'Exacting'],
        description:
            'Responsible, reliable and accountable. Exacting in their work. Considers many factors when deciding. Appreciates guidance.',
        strengths: [
            'Takes full ownership and follows through on commitments',
            'Produces meticulous, well-considered work every time',
            'Balances quality standards with consideration for the team',
            'Documents processes and ensures knowledge is shared',
        ],
        blindSpots: [
            'May be overly cautious and miss time-sensitive opportunities',
            'Can get rigid about procedures when flexibility is needed',
            'Tendency to need reassurance before making decisions',
            'May struggle to push back on unreasonable requests',
        ],
    },
    Cd: {
        label: 'Cd',
        name: 'Clarity',
        fullName: 'Clarity/drive',
        motto: 'Let\u2019s improve the process.',
        icon: 'analytics-outline',
        color: '#4A7FB5',
        descriptors: ['Purposeful', 'Efficient', 'Rational'],
        description:
            'Purposeful, efficient and focused. Focused on goals rather than relationships. Extremely rational. Strives to improve performance.',
        strengths: [
            'Combines analytical rigour with drive to execute',
            'Identifies the most efficient path to any goal',
            'Makes tough, data-driven decisions without hesitation',
            'Continuously improves systems and raises the performance bar',
        ],
        blindSpots: [
            'May come across as emotionally detached or aloof',
            'Can be overly critical of others\u2019 work and methods',
            'Tendency to undervalue relationship-building and team morale',
            'May push too hard for efficiency at the expense of people',
        ],
    },
    Balanced: {
        label: 'Balanced',
        name: 'Balanced',
        fullName: 'Balanced',
        motto: 'Versatile across all styles.',
        icon: 'options-outline',
        color: '#78716c',
        descriptors: ['Adaptable', 'Flexible', 'Perceptive'],
        description:
            'Your scores are closely balanced across all four DISC styles. You naturally adapt your approach to fit different situations \u2014 drawing on Drive, Influence, Support, or Clarity as needed. This versatility is a rare and valuable quality.',
        strengths: [
            'Adapts naturally to different work situations and team dynamics',
            'Relates effectively with all personality types',
            'Can fill multiple roles and switch between leadership and support',
            'Brings a balanced perspective to problem-solving',
        ],
        blindSpots: [
            'May find it harder to identify a single strongest contribution',
            'Can experience indecision about which approach to use',
            'Others may find it difficult to predict your communication style',
            'May spread energy across too many areas rather than specialising',
        ],
    },
};

// ── Subtype Display Codes (Everything DiSC convention) ──────────

/** Everything DiSC display code for each result type (I is always lowercase 'i'). */
export const DISC_SUBTYPE_DISPLAY: Record<Exclude<DiscResultType, 'Balanced'>, string> = {
    D: 'D',
    Di: 'Di',
    Dc: 'DC',
    I: 'i',
    Id: 'iD',
    Is: 'iS',
    S: 'S',
    Si: 'Si',
    Sc: 'SC',
    C: 'C',
    Cs: 'CS',
    Cd: 'CD',
};

// ── Question Formats ─────────────────────────────────────────────

export interface DiscWordPairQuestion {
    id: number;
    left: string;
    right: string;
    leftType: DiscType;
    rightType: DiscType;
}

export interface DiscSingleWordQuestion {
    id: number;
    word: string;
    discType: DiscType;
}

export interface DiscScenarioQuestion {
    id: number;
    stem: string;
    optionA: { text: string; axis: AxisCode };
    optionB: { text: string; axis: AxisCode };
}

// ── Step Definitions ─────────────────────────────────────────────

export interface DiscStep {
    stepNumber: number;
    title: string;
    instructions: string;
    format: 'word_pair' | 'single_word' | 'scenario';
}

export const DISC_STEPS: DiscStep[] = [
    {
        stepNumber: 1,
        title: 'Word Pairs',
        instructions:
            'In each pair, mark the circle near the word that describes you best. If neither word describes you or both describe you equally well, mark the circle in the centre.',
        format: 'word_pair',
    },
    {
        stepNumber: 2,
        title: 'Word Pairs',
        instructions:
            'In each pair, mark the circle near the word that describes you best. If neither word describes you or both describe you equally well, mark the circle in the centre.',
        format: 'word_pair',
    },
    {
        stepNumber: 3,
        title: 'Word Pairs',
        instructions:
            'In each pair, mark the circle near the word that describes you best. If neither word describes you or both describe you equally well, mark the circle in the centre.',
        format: 'word_pair',
    },
    {
        stepNumber: 4,
        title: 'Self-Rating',
        instructions:
            'For each word, rate how well each word describes you, from \u2018Not Like Me\u2019 to \u2018Like Me\u2019.',
        format: 'single_word',
    },
    {
        stepNumber: 5,
        title: 'Scenarios',
        instructions: 'Read each scenario and choose the option that best describes you.',
        format: 'scenario',
    },
];

export const DISC_TOTAL_STEPS = 5;
export const DISC_TOTAL_QUESTIONS = 39;

// ── Question Data ────────────────────────────────────────────────

export const DISC_WORD_PAIR_QUESTIONS: Record<number, DiscWordPairQuestion[]> = {
    1: [
        { id: 1, left: 'Open', right: 'Discerning', leftType: 'I', rightType: 'C' },
        { id: 2, left: 'Spontaneous', right: 'Methodical', leftType: 'I', rightType: 'C' },
        { id: 3, left: 'Reserved', right: 'Dynamic', leftType: 'C', rightType: 'D' },
        { id: 4, left: 'Energetic', right: 'Calm', leftType: 'I', rightType: 'S' },
        { id: 5, left: 'Generous', right: 'Strict', leftType: 'S', rightType: 'C' },
        { id: 6, left: 'Focused', right: 'Cheerful', leftType: 'D', rightType: 'I' },
        { id: 7, left: 'Vibrant', right: 'Steady', leftType: 'I', rightType: 'S' },
        { id: 8, left: 'Reliable', right: 'Confident', leftType: 'S', rightType: 'D' },
    ],
    2: [
        { id: 9, left: 'Supportive', right: 'Resolute', leftType: 'S', rightType: 'D' },
        { id: 10, left: 'Enthusiastic', right: 'Objective', leftType: 'I', rightType: 'C' },
        { id: 11, left: 'Compliant', right: 'Enterprising', leftType: 'C', rightType: 'D' },
        { id: 12, left: 'Diplomatic', right: 'Direct', leftType: 'S', rightType: 'D' },
        { id: 13, left: 'Upbeat', right: 'Grounded', leftType: 'I', rightType: 'S' },
        { id: 14, left: 'Independent', right: 'Engaging', leftType: 'D', rightType: 'I' },
        { id: 15, left: 'Purposeful', right: 'Charming', leftType: 'D', rightType: 'I' },
        { id: 16, left: 'Even-Tempered', right: 'Driven', leftType: 'S', rightType: 'D' },
        { id: 39, left: 'Warm', right: 'Logical', leftType: 'S', rightType: 'C' },
    ],
    3: [
        { id: 17, left: 'Accepting', right: 'Matter-of-Fact', leftType: 'S', rightType: 'C' },
        { id: 18, left: 'Persuasive', right: 'Meticulous', leftType: 'I', rightType: 'C' },
        { id: 19, left: 'Reflective', right: 'Expressive', leftType: 'C', rightType: 'I' },
        { id: 20, left: 'Cooperative', right: 'Assertive', leftType: 'S', rightType: 'D' },
        { id: 21, left: 'Outgoing', right: 'Measured', leftType: 'I', rightType: 'C' },
        { id: 22, left: 'Animated', right: 'Precise', leftType: 'I', rightType: 'C' },
        { id: 23, left: 'Cautious', right: 'Adventurous', leftType: 'C', rightType: 'D' },
        { id: 24, left: 'Receptive', right: 'Proactive', leftType: 'S', rightType: 'D' },
    ],
};

export const DISC_SINGLE_WORD_QUESTIONS: DiscSingleWordQuestion[] = [
    { id: 25, word: 'Agreeable', discType: 'S' },
    { id: 26, word: 'Daring', discType: 'D' },
    { id: 27, word: 'Sociable', discType: 'I' },
    { id: 28, word: 'Optimistic', discType: 'I' },
    { id: 29, word: 'Patient', discType: 'S' },
    { id: 30, word: 'Systematic', discType: 'C' },
    { id: 31, word: 'Detail-Oriented', discType: 'C' },
    { id: 32, word: 'Determined', discType: 'D' },
];

export const DISC_SCENARIO_QUESTIONS: DiscScenarioQuestion[] = [
    {
        id: 33,
        stem: 'In a group, I am\u2026',
        optionA: { text: 'Likely to share my ideas first', axis: 'n' },
        optionB: { text: 'Likely to listen to others first', axis: 's' },
    },
    {
        id: 34,
        stem: 'On a team project, I am most concerned with\u2026',
        optionA: { text: 'Getting things done correctly and efficiently', axis: 'e' },
        optionB: { text: 'Making sure the people involved are engaged and supported', axis: 'w' },
    },
    {
        id: 35,
        stem: 'I am most comfortable\u2026',
        optionA: { text: 'Making the call when a decision is needed', axis: 'n' },
        optionB: { text: 'Building consensus before deciding', axis: 's' },
    },
    {
        id: 36,
        stem: 'When giving feedback to someone, I focus on\u2026',
        optionA: {
            text: 'Motivating the person and letting them know they\u2019re appreciated',
            axis: 'w',
        },
        optionB: {
            text: 'Being accurate and factual about the person\u2019s performance',
            axis: 'e',
        },
    },
    {
        id: 37,
        stem: 'I am most attracted to\u2026',
        optionA: { text: 'Work I can do alone', axis: 'e' },
        optionB: { text: 'Work that requires lots of interaction with others', axis: 'w' },
    },
    {
        id: 38,
        stem: 'When someone presents a plan, I\u2019m more likely to\u2026',
        optionA: { text: 'Evaluate the plan\u2019s risks and gaps', axis: 'e' },
        optionB: { text: 'Think about how to support the plan\u2019s success', axis: 'w' },
    },
];

/** Get all question IDs for a given step (1-based) */
export function getStepQuestionIds(step: number): number[] {
    if (step >= 1 && step <= 3) {
        return DISC_WORD_PAIR_QUESTIONS[step].map((q) => q.id);
    }
    if (step === 4) return DISC_SINGLE_WORD_QUESTIONS.map((q) => q.id);
    if (step === 5) return DISC_SCENARIO_QUESTIONS.map((q) => q.id);
    return [];
}

// ── Priorities ───────────────────────────────────────────────────

export const DISC_PRIORITIES: PriorityDef[] = [
    {
        name: 'Collaboration',
        angle: 0,
        dimension: 'I',
        description: 'You value working together, building relationships, and inclusivity.',
    },
    {
        name: 'Enthusiasm',
        angle: 45,
        dimension: 'I',
        description: 'You bring energy, positivity, and excitement to every interaction.',
    },
    {
        name: 'Action',
        angle: 90,
        dimension: 'D',
        description: 'You focus on starting quickly and making things happen.',
    },
    {
        name: 'Results',
        angle: 135,
        dimension: 'D',
        description: 'You focus on outcomes, efficiency, and achieving goals quickly.',
    },
    {
        name: 'Challenge',
        angle: 180,
        dimension: 'C',
        description: 'You question assumptions, drive improvement, and hold high standards.',
    },
    {
        name: 'Accuracy',
        angle: 225,
        dimension: 'C',
        description: 'You value precision, quality, and getting the details right.',
    },
    {
        name: 'Stability',
        angle: 270,
        dimension: 'S',
        description: 'You prefer consistency, careful processes, and reliable outcomes.',
    },
    {
        name: 'Support',
        angle: 315,
        dimension: 'S',
        description: 'You focus on helping others, creating stability, and being dependable.',
    },
];

// ── Secondary Type Content ──────────────────────────────────────

/** One-line bridge text keyed by "Primary-Secondary" (e.g. "C-S"). */
export const DISC_BRIDGE_TEXT: Record<string, string> = {
    'D-I': 'As a Drive type with strong Influence traits, you combine decisive action with people skills.',
    'D-S': 'As a Drive type with strong Support traits, you combine results-focus with steady reliability.',
    'D-C': 'As a Drive type with strong Clarity traits, you combine decisiveness with analytical precision.',
    'I-D': 'As an Influence type with strong Drive traits, you combine enthusiasm with decisive action.',
    'I-S': 'As an Influence type with strong Support traits, you combine social energy with genuine care for others.',
    'I-C': 'As an Influence type with strong Clarity traits, you combine creativity with thoughtful analysis.',
    'S-D': 'As a Support type with strong Drive traits, you combine patience with purposeful action.',
    'S-I': 'As a Support type with strong Influence traits, you combine dependability with warm engagement.',
    'S-C': 'As a Support type with strong Clarity traits, you combine steady reliability with careful precision.',
    'C-D': 'As a Clarity type with strong Drive traits, you combine analytical depth with decisive execution.',
    'C-I': 'As a Clarity type with strong Influence traits, you combine precision with persuasive communication.',
    'C-S': 'As a Clarity type with strong Support traits, you combine analytical rigour with reliability.',
};

/** Single secondary-influenced strength per DISC type. */
export const DISC_SECONDARY_STRENGTHS: Record<DiscType, string> = {
    D: 'Brings purposeful drive and accountability when the team needs direction',
    I: 'Adds warmth and enthusiasm that energises team collaborations',
    S: 'Provides steady, dependable support to team processes',
    C: 'Brings careful attention to detail that elevates work quality',
};

/** Single secondary-influenced blind spot per DISC type. */
export const DISC_SECONDARY_BLIND_SPOTS: Record<DiscType, string> = {
    D: 'May push for change faster than the team is comfortable with',
    I: 'May prioritise social harmony over addressing tough issues directly',
    S: 'May resist change even when current systems need updating',
    C: 'May over-analyse situations where quick action would be more effective',
};
