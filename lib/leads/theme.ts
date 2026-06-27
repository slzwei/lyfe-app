/**
 * Leads-scoped design bridge (UI/UX adoption from mktr-leads · Option B).
 *
 * This is the ONE place that translates lyfe-app's shared theme
 * (`useTheme().colors`, the Tropic palette in `design/colors.ts`) into the
 * token shape the ported mktr-leads components expect — PLUS a few leads-only
 * tokens lyfe's palette doesn't carry (status pill fills, won surface, warm
 * secondary). Everything here is leads-local: no shared file is touched, and the
 * rest of the app keeps reading `useTheme()` directly.
 *
 * Why a bridge instead of editing the shared theme: zero blast radius. Other
 * modules (Team, Home, …) render lead UI via shared components; we must not move
 * their tokens. See LYFE_LEADS_UIUX_PLAN.md §1.
 */
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export type LeadStatusKey = 'new' | 'contacted' | 'qualified' | 'proposed' | 'won' | 'lost';

/** 4pt scale + radii ported from mktr (leads-only — does not alter lyfe's global SPACING). */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { chip: 9, btn: 14, card: 18, hero: 20 } as const;

/**
 * Filled status-pill colors — leads-only, warm Tropic remap of the brand-violating
 * `STATUS_CONFIG` (#007AFF/#EAB308). Theme-invariant vivid fills (mktr's own pattern),
 * every fill/text pair verified ≥4.5:1 (WCAG AA).
 */
export const statusColors: Record<LeadStatusKey, string> = {
    new: '#C24A22', // terracotta — white text ≈4.9:1
    contacted: '#E7B84E', // butter — dark text ≈7.4:1
    qualified: '#5E6F51', // leaf — white text ≈5.4:1
    proposed: '#7B5A94', // deep mauve — white text ≈5.6:1
    won: '#2F7A49', // deep green — white text ≈5.3:1
    lost: '#6E655C', // warm grey — white text ≈5.8:1
};

export const pillText: Record<LeadStatusKey, string> = {
    new: '#FFFFFF',
    contacted: '#3A2A08',
    qualified: '#FFFFFF',
    proposed: '#FFFFFF',
    won: '#FFFFFF',
    lost: '#FFFFFF',
};

/** `#RRGGBB` + opacity (0–1) → `rgba()`. Used for tints (rails, chip backgrounds). */
export function alpha(hex: string, a: number): string {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a))})`;
}

/** Display labels for lead statuses — the single source for the leads module. */
export const STATUS_LABELS: Record<LeadStatusKey, string> = {
    new: 'New',
    contacted: 'Contacted',
    qualified: 'Qualified',
    proposed: 'Proposed',
    won: 'Won',
    lost: 'Lost',
};

/**
 * Leads `colors` = lyfe's live theme colors + aliases under mktr's token names,
 * so ported mktr components (which read `surfaceAlt`/`textMuted`/`accentText`/…)
 * compile unchanged while staying theme-aware (light/dark flows through lyfe's
 * ThemeContext). Leads-only additions: `secondary`, `wonSurface`.
 */
function bridgeColors(base: ReturnType<typeof useTheme>['colors']) {
    return {
        ...base,
        // mktr-named aliases → lyfe tokens
        bg: base.background,
        surface: base.cardBackground,
        surfaceAlt: base.surfaceSecondary,
        text: base.textPrimary,
        textMuted: base.textSecondary,
        textFaint: base.textTertiary,
        accentText: base.textInverse,
        accentSoft: base.accentLight,
        whatsapp: base.whatsappGreen,
        // leads-only additions
        secondary: base.accentMuted,
        wonSurface: base.successLight,
        // Fixed dark ink for text/icons on bright brand-color fills (WhatsApp green) —
        // contrast-verified in both themes; replaces hardcoded screen hex.
        inkOnBrand: '#10110F',
    };
}

export type LeadsThemeColors = ReturnType<typeof bridgeColors>;

export interface LeadsTheme {
    colors: LeadsThemeColors;
    statusColors: Record<LeadStatusKey, string>;
    pillText: Record<LeadStatusKey, string>;
    spacing: typeof spacing;
    radius: typeof radius;
    isDark: boolean;
}

/** Memoized leads theme. Stable per resolved light/dark theme (no style churn). */
export function useLeadsTheme(): LeadsTheme {
    const { colors, isDark } = useTheme();
    return useMemo(
        () => ({ colors: bridgeColors(colors), statusColors, pillText, spacing, radius, isDark }),
        [colors, isDark],
    );
}

/**
 * mktr-style `makeStyles(theme)` factory hook, memoized on the leads theme.
 * The factory itself should return `StyleSheet.create({...})` so style literals
 * (e.g. `position: 'relative'`) keep their RN types — this hook just memoizes it.
 */
export function useLeadsThemedStyles<T extends StyleSheet.NamedStyles<T>>(make: (t: LeadsTheme) => T): T {
    const theme = useLeadsTheme();
    return useMemo(() => make(theme), [theme, make]);
}
