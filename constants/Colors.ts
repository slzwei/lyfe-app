/**
 * Lyfe App — Tropic color system.
 *
 * The Colors object is the shared Tropic palette — sourced from the root
 * design system (`lyfe-design/src/colors.ts` → synced to `@/design/colors.ts`).
 * Do not redefine palette values here; edit `lyfe-design/src/colors.ts` and run
 * `npm run sync:design` from the lyfe-master root.
 *
 * This file re-exports `Colors` unchanged for every existing consumer
 * (`import { Colors } from '@/constants/Colors'`), and owns the lyfe-app-specific
 * pixel art palettes used by the seedling / sprout illustrations.
 */

export { Colors } from '@/design/colors';
export type { ColorScheme, ColorToken } from '@/design/colors';

// ── Pixel art palettes (lyfe-app only — used by seedling/sprout illustrations) ──
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
