/**
 * Lyfe App — Tropic Office typography tokens
 *
 * Central place to reference font families. Use these EVERYWHERE instead of
 * hard-coding fontFamily strings in components.
 *
 * Font loading is done once in app/_layout.tsx via expo-font useFonts.
 * See handoff/fonts.md for exact asset filenames and loader code.
 *
 * Usage:
 *   import { Fonts, Type } from '@/constants/type';
 *   <Text style={[Type.display, { color: colors.textPrimary }]}>…</Text>
 *   <Text style={{ fontFamily: Fonts.serifItalic, fontSize: 24 }}>…</Text>
 */

import { Platform } from 'react-native';
import type { TextStyle } from 'react-native';

// ── Family names (match the names registered in useFonts) ─────────
export const Fonts = {
    // Editorial serif — used for greetings, section titles, big numbers,
    // and the ONE italic accent word per screen. Never use for body copy.
    serif: 'Fraunces',
    serifItalic: 'Fraunces-Italic',

    // Workhorse sans — used for ALL body, UI labels, navigation, form fields.
    sans: 'Inter',
    sansMedium: 'Inter-Medium',
    sansSemibold: 'Inter-SemiBold',
    sansBold: 'Inter-Bold',

    // Tabular mono — used for IDs, phone numbers, amounts in tables, timestamps.
    // Numbers feel "receipt-y" and scannable in lists. Do not use for body.
    mono: 'JetBrainsMono',
    monoMedium: 'JetBrainsMono-Medium',
} as const;

// ── Tracking (letter-spacing) helper — iOS needs real values, Android needs 0 ──
const track = (v: number): number => (Platform.OS === 'ios' ? v : 0);

// ── Ready-made text styles for common patterns ────────────────────
export const Type = {
    // Big editorial display — greetings, hero numbers
    display: {
        fontFamily: Fonts.serif,
        fontSize: 36,
        fontWeight: '400' as const,
        lineHeight: 38,
        letterSpacing: track(-0.8),
    } satisfies TextStyle,

    // Section headings ("Nudges, not nags.") — use <SectionHeading> atom
    section: {
        fontFamily: Fonts.serif,
        fontSize: 20,
        fontWeight: '500' as const,
        lineHeight: 24,
        letterSpacing: track(-0.3),
    } satisfies TextStyle,

    // Item titles in lists
    title: {
        fontFamily: Fonts.serif,
        fontSize: 16,
        fontWeight: '500' as const,
        lineHeight: 20,
        letterSpacing: track(-0.2),
    } satisfies TextStyle,

    // Body UI text
    body: {
        fontFamily: Fonts.sans,
        fontSize: 14,
        fontWeight: '400' as const,
        lineHeight: 20,
    } satisfies TextStyle,

    // Small UI meta
    meta: {
        fontFamily: Fonts.sans,
        fontSize: 12,
        fontWeight: '500' as const,
        lineHeight: 16,
    } satisfies TextStyle,

    // Eyebrow caps (uppercase tracked labels above sections)
    eyebrow: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 11,
        fontWeight: '600' as const,
        lineHeight: 14,
        letterSpacing: track(1),
        textTransform: 'uppercase' as const,
    } satisfies TextStyle,

    // Numbers in tables/lists (tabular)
    num: {
        fontFamily: Fonts.mono,
        fontSize: 14,
        fontWeight: '500' as const,
        lineHeight: 18,
    } satisfies TextStyle,

    // Large KPI numbers (serif, prominent)
    kpi: {
        fontFamily: Fonts.serif,
        fontSize: 28,
        fontWeight: '500' as const,
        letterSpacing: track(-0.8),
    } satisfies TextStyle,
} as const;
