/**
 * Platform-aware UI constants.
 *
 * GUARDRAIL: Every value here returns the EXISTING iOS value by default.
 * Android overrides are opt-in via Platform.OS checks.
 * If you need a new Android adjustment, add it HERE — never inline in screens.
 *
 * Usage:
 *   import { P } from '@/constants/platform';
 *   style={{ letterSpacing: P.letterSpacing(-0.3), height: P.TAB_BAR_HEIGHT }}
 */
import { Platform, StyleSheet } from 'react-native';

const isAndroid = Platform.OS === 'android';

// ── Tab bar ─────────────────────────────────────────────────────
/** Tab bar total height (iOS has taller bar for home indicator) */
export const TAB_BAR_HEIGHT = isAndroid ? 60 : 72;

/** Tab bar bottom padding (iOS needs room for home indicator) */
export const TAB_BAR_PADDING_BOTTOM = isAndroid ? 8 : 20;

/** Tab bar top padding */
export const TAB_BAR_PADDING_TOP = 6;

// ── Typography ──────────────────────────────────────────────────
/**
 * Negative letter-spacing works well on SF Pro (iOS) but causes
 * character overlap on Roboto (Android). This helper returns 0
 * on Android and the original value on iOS.
 */
export function letterSpacing(iosValue: number): number {
    if (!isAndroid) return iosValue;
    // Only zero-out negative values; positive spacing is fine on Android
    return iosValue < 0 ? 0 : iosValue;
}

/**
 * Font weight adjustment — '800' (ExtraBold) looks chunky on Roboto
 * at display sizes. Step down to '700' on Android.
 */
export function displayWeight(iosWeight: '800' | '700' | '600'): '800' | '700' | '600' {
    if (!isAndroid) return iosWeight;
    return iosWeight === '800' ? '700' : iosWeight;
}

// ── KeyboardAvoidingView ────────────────────────────────────────
/** iOS → 'padding', Android → 'height' */
export const KAV_BEHAVIOR: 'padding' | 'height' = isAndroid ? 'height' : 'padding';

// ── Shadows / Elevation ─────────────────────────────────────────
/**
 * Creates platform-appropriate shadow styles.
 * iOS: standard shadow* properties.
 * Android: elevation + faint border to compensate for weak elevation rendering.
 */
export function shadow(level: 'sm' | 'md' | 'lg') {
    const config = {
        sm: { ios: { h: 2, opacity: 0.03, radius: 8 }, android: { elevation: 2 } },
        md: { ios: { h: 4, opacity: 0.04, radius: 12 }, android: { elevation: 4 } },
        lg: { ios: { h: 8, opacity: 0.15, radius: 16 }, android: { elevation: 8 } },
    }[level];

    if (!isAndroid) {
        return {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: config.ios.h },
            shadowOpacity: config.ios.opacity,
            shadowRadius: config.ios.radius,
        };
    }

    return {
        elevation: config.android.elevation,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    };
}

// ── Modals ──────────────────────────────────────────────────────
/** Bottom-sheet modals: slide on iOS, fade on Android */
export const MODAL_ANIM_SHEET: 'slide' | 'fade' = isAndroid ? 'fade' : 'slide';

/** Center dialogs: fade on both */
export const MODAL_ANIM_DIALOG: 'fade' = 'fade';

/** Android modals should extend behind the status bar */
export const MODAL_STATUS_BAR_TRANSLUCENT = isAndroid;

// ── Borders ─────────────────────────────────────────────────────
/** Hairline width that's visible even on low-DPI Android screens */
export const HAIRLINE = isAndroid ? 1 : StyleSheet.hairlineWidth;

// ── Convenience namespace ───────────────────────────────────────
export const P = {
    TAB_BAR_HEIGHT,
    TAB_BAR_PADDING_BOTTOM,
    TAB_BAR_PADDING_TOP,
    KAV_BEHAVIOR,
    MODAL_ANIM_SHEET,
    MODAL_ANIM_DIALOG,
    MODAL_STATUS_BAR_TRANSLUCENT,
    HAIRLINE,
    letterSpacing,
    displayWeight,
    shadow,
};
