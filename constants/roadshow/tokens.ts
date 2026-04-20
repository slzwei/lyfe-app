import { Colors } from '@/constants/Colors';

export const RoadshowStageColors = {
    light: {
        sitdowns: Colors.light.accent,
        pitches: '#8A6F1C',
        closes: Colors.light.success,
        live: Colors.light.accent,
        setup: '#8A6F1C',
        late: '#D88A93',
        on: Colors.light.success,
        closed: Colors.light.textTertiary,
    },
    dark: {
        sitdowns: Colors.dark.accent,
        pitches: '#E5B858',
        closes: Colors.dark.success,
        live: Colors.dark.accent,
        setup: '#E5B858',
        late: '#E8A7B0',
        on: Colors.dark.success,
        closed: Colors.dark.textTertiary,
    },
} as const;

export const RoadshowRadii = {
    hero: 18,
    card: 14,
    sheet: 22,
} as const;

export const RoadshowMotion = {
    sheetMs: 320,
    backdropMs: 240,
    ease: [0.22, 0.9, 0.28, 1] as const,
    bouncyOvershoot: -0.02,
    backdropOpacity: 0.45,
    shimmer: 3000,
    fadeUp: 600,
    confetti: 1800,
} as const;

export const RoadshowBounds = {
    afycMax: 9_999_999,
    afycQuickPicks: [1000, 1800, 2400, 3600, 6000] as const,
    minPledge: 0,
    maxPledge: 99,
} as const;

export const RoadshowMasks = {
    faceCaptureBg: 'rgba(0,0,0,0.55)',
} as const;

/** Sort predicate: cases × 10000 + AFYC, descending. Matches PRD. */
export function leaderboardSort(a: { cases: number; afyc: number }, b: { cases: number; afyc: number }): number {
    return b.cases * 10000 + b.afyc - (a.cases * 10000 + a.afyc);
}

/** Resolve stage colors for the current theme. */
export function getRoadshowColors(resolved: 'light' | 'dark') {
    return RoadshowStageColors[resolved];
}
