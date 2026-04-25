/**
 * RN-only: Platform-aware Type ready-mades built on top of the platform-free
 * typography primitives. Only import this from React Native consumers.
 */

import { Platform } from 'react-native';
import type { TextStyle } from 'react-native';

// IMPORTANT: import from ./typography-tokens (NOT ./typography). Metro's
// `.native.ts` resolution makes `./typography` resolve to THIS file, yielding
// a require cycle + `Fonts is undefined` crash at startup. Always import the
// primitives from typography-tokens (no .native sibling, safe to resolve).
import { Fonts, FontSize, LineHeight, LetterSpacing } from './typography-tokens';

// iOS needs real tracking values, Android (Roboto) needs 0 to avoid overlap.
const track = (v: number): number => (Platform.OS === 'ios' ? v : 0);

export const Type = {
    display: {
        fontFamily: Fonts.serif,
        fontSize: FontSize.display,
        fontWeight: '400' as const,
        lineHeight: LineHeight.display,
        letterSpacing: track(LetterSpacing.display),
    } satisfies TextStyle,

    section: {
        fontFamily: Fonts.serif,
        fontSize: FontSize.section,
        fontWeight: '500' as const,
        lineHeight: LineHeight.section,
        letterSpacing: track(LetterSpacing.section),
    } satisfies TextStyle,

    // NOTE: lyfe-app currently uses the pre-Tropic definition (Fraunces + 16/20/500 -0.2).
    // Keeping this shape for visual parity with HEAD. The canonical Tropic rule is
    // sans-semibold for list-row titles — run /impeccable:typeset to migrate.
    title: {
        fontFamily: Fonts.serif,
        fontSize: FontSize.title,
        fontWeight: '500' as const,
        lineHeight: 20,
        letterSpacing: track(-0.2),
    } satisfies TextStyle,

    // NOTE: lyfe-app currently uses 14/20 (not the canonical Tropic 15/23).
    // Preserved for visual parity — run /impeccable:typeset to graduate to the target scale.
    body: {
        fontFamily: Fonts.sans,
        fontSize: 14,
        fontWeight: '400' as const,
        lineHeight: 20,
    } satisfies TextStyle,

    meta: {
        fontFamily: Fonts.sans,
        fontSize: FontSize.meta,
        fontWeight: '500' as const,
        lineHeight: LineHeight.meta,
    } satisfies TextStyle,

    eyebrow: {
        fontFamily: Fonts.sansSemibold,
        fontSize: FontSize.eyebrow,
        fontWeight: '600' as const,
        lineHeight: LineHeight.eyebrow,
        letterSpacing: track(LetterSpacing.eyebrow),
        textTransform: 'uppercase' as const,
    } satisfies TextStyle,

    num: {
        fontFamily: Fonts.mono,
        fontSize: FontSize.num,
        fontWeight: '500' as const,
        lineHeight: LineHeight.num,
    } satisfies TextStyle,

    kpi: {
        fontFamily: Fonts.serif,
        fontSize: FontSize.kpi,
        fontWeight: '500' as const,
        letterSpacing: track(LetterSpacing.kpi),
    } satisfies TextStyle,
} as const;

// Re-export the primitives so `@/design/typography` has the same public surface
// on native as it does on web. Without this, Metro's `.native.ts` resolution
// swaps typography.ts for this file and callers lose Fonts/FontSize/etc.
export { Fonts, FontStacks, FontSize, FontWeight, LetterSpacing, LineHeight } from './typography-tokens';
