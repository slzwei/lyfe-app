/**
 * Lyfe App — Tropic Office color system
 *
 * Warm, editorial, humane. Terracotta-forward accent on a cream base.
 * Maintains the EXACT SAME SHAPE as the previous Colors object so every
 * existing consumer (colors.cardBackground, colors.accent, etc.) keeps
 * working without code changes.
 *
 * Philosophy:
 * - Cream base (#F5F0E6) instead of iOS #F2F2F7
 * - Terracotta (#D6552B) accent, evolved from the original orange
 * - Soft tinted surfaces (sage, pink, butter) for categorical stats
 * - Hairline rules visible — we keep card borders now (1px #E6E0D1)
 * - True-dark mode is warm-dark, not pure black (#141310 base)
 */

const terracotta = {
    primary: '#D6552B',
    light: '#F7E7DC',
    dark: '#A53F1E',
    muted: '#E89574',
};

export const Colors = {
    light: {
        // ── Backgrounds ────────────────────────────────
        background: '#F5F0E6', // cream
        surfacePrimary: '#FBF7EE', // paper (elevated above cream)
        surfaceSecondary: '#F5F0E6',
        surfaceElevated: '#FFFFFF',

        // ── Text ───────────────────────────────────────
        textPrimary: '#1B1A17', // warm near-black
        textSecondary: '#4A4640',
        textTertiary: '#8B857A',
        textInverse: '#FBF7EE',

        // ── Accent ─────────────────────────────────────
        accent: terracotta.primary,
        accentLight: terracotta.light,
        accentDark: terracotta.dark,
        accentMuted: terracotta.muted,

        // ── Semantic ───────────────────────────────────
        success: '#7A8C6B', // sage
        successLight: '#E8EDE0',
        warning: '#C89B3C', // butter/ochre
        warningLight: '#F7ECCF',
        danger: '#B33A2E',
        dangerLight: '#F7DDD6',
        info: '#5C7A9E', // dusty slate-blue
        infoLight: '#DFE6EF',

        // ── Borders & Dividers ─────────────────────────
        border: '#E6E0D1', // visible hairline (intentional — Tropic keeps rules)
        borderLight: '#EFEADB',
        divider: '#D8D1BE',

        // ── Cards & Components ─────────────────────────
        cardBackground: '#FBF7EE',
        cardBorder: '#E6E0D1', // ← was 'transparent' — now visible
        tabBar: '#FBF7EE',
        tabBarBorder: '#E6E0D1',
        inputBackground: '#FFFFFF',
        inputBorder: '#E6E0D1',

        // ── Manager role ───────────────────────────────
        managerColor: '#5C7A9E',
        managerColorLight: '#DFE6EF',

        // ── Status pills ───────────────────────────────
        statusNew: '#5C7A9E',
        statusContacted: '#C89B3C',
        statusQualified: '#7A8C6B',
        statusProposed: '#B27AAE', // dusty pink/rose
        statusWon: '#7A8C6B',
        statusLost: '#B33A2E',

        // ── WebView ────────────────────────────────────
        webViewBg: '#FBF7EE',
        webViewText: '#1B1A17',

        // ── Shadows ────────────────────────────────────
        shadow: 'rgba(27, 26, 23, 0.06)',

        // ── Live status ────────────────────────────────
        statusLive: '#7A8C6B', // sage live dot

        // ── Roadmap programme branding ─────────────────
        seedLyfe: '#7A8C6B',
        sproutLyfe: '#8FA377',

        // ── Roadmap module type colors ─────────────────
        roadmapTraining: '#5C7A9E',
        roadmapExam: '#D6552B',
        roadmapResource: '#7A8C6B',

        // ── Tab bar icons ──────────────────────────────
        tabIconDefault: '#8B857A',
        tabIconSelected: terracotta.primary,

        // ── NEW Tropic-specific tokens ─────────────────
        // (additive — no existing code references these, safe to ignore until you need them)
        paperElevated: '#FFFFFF',
        tintSage: '#EAEFE1',
        tintTerra: '#F7E7DC',
        tintPink: '#F2E0E7',
        tintButter: '#F7ECCF',
        inkWarm: '#1B1A17',
        hairline: '#EFEADB',
    },

    dark: {
        // ── Backgrounds — warm-dark, not pure black ───
        background: '#141310',
        surfacePrimary: '#1F1D18',
        surfaceSecondary: '#141310',
        surfaceElevated: '#2A2721',

        // ── Text ───────────────────────────────────────
        textPrimary: '#F5F0E6',
        textSecondary: '#D6CFBD',
        textTertiary: '#8B857A',
        textInverse: '#141310',

        // ── Accent ─────────────────────────────────────
        accent: '#E27A4E', // warmer in dark
        accentLight: '#3A2419',
        accentDark: terracotta.primary,
        accentMuted: '#B5603F',

        // ── Semantic ───────────────────────────────────
        success: '#9CAE8C',
        successLight: '#1E261A',
        warning: '#E5B858',
        warningLight: '#2D2516',
        danger: '#D85547',
        dangerLight: '#2D1714',
        info: '#87A3C4',
        infoLight: '#16202D',

        // ── Borders & Dividers ─────────────────────────
        border: '#2F2B24',
        borderLight: '#24211B',
        divider: '#3A362E',

        // ── Cards & Components ─────────────────────────
        cardBackground: '#1F1D18',
        cardBorder: '#2F2B24',
        tabBar: '#1F1D18',
        tabBarBorder: '#2F2B24',
        inputBackground: '#2A2721',
        inputBorder: '#3A362E',

        // ── Manager role ───────────────────────────────
        managerColor: '#87A3C4',
        managerColorLight: '#16202D',

        // ── Status pills ───────────────────────────────
        statusNew: '#87A3C4',
        statusContacted: '#E5B858',
        statusQualified: '#9CAE8C',
        statusProposed: '#C79BC3',
        statusWon: '#9CAE8C',
        statusLost: '#D85547',

        // ── WebView ────────────────────────────────────
        webViewBg: '#1F1D18',
        webViewText: '#F5F0E6',

        // ── Shadows ────────────────────────────────────
        shadow: 'rgba(0, 0, 0, 0.5)',

        // ── Live status ────────────────────────────────
        statusLive: '#9CAE8C',

        // ── Roadmap programme branding ─────────────────
        seedLyfe: '#9CAE8C',
        sproutLyfe: '#ADBF9B',

        // ── Roadmap module type colors ─────────────────
        roadmapTraining: '#87A3C4',
        roadmapExam: '#E27A4E',
        roadmapResource: '#9CAE8C',

        // ── Tab bar icons ──────────────────────────────
        tabIconDefault: '#8B857A',
        tabIconSelected: '#E27A4E',

        // ── NEW Tropic-specific tokens ─────────────────
        paperElevated: '#2A2721',
        tintSage: '#1E261A',
        tintTerra: '#3A2419',
        tintPink: '#2F1E28',
        tintButter: '#2D2516',
        inkWarm: '#F5F0E6',
        hairline: '#24211B',
    },
};

// ── Pixel art palettes (retained — used by seedling/sprout illustrations) ──
export const SEEDLING_PALETTE = {
    light: '#9FB585',
    medium: '#7A8C6B',
    dark: '#5E6F51',
    darkest: '#3D4A32',
};

export const SPROUT_PALETTE = {
    stem: '#5E6F51',
    leafDark: '#3D4A32',
    leafPrimary: '#7A8C6B',
    leafLight: '#9FB585',
    leafHighlight: '#C2D2AB',
    soilDark: '#6D563A',
    soilLight: '#8B6F47',
    soilMedium: '#A08060',
};
