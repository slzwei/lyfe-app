import type { TextStyle } from 'react-native';

export const TropicFonts = {
    serif: 'Fraunces',
    serifItalic: 'Fraunces-Italic',
    ui: 'Inter',
    uiMedium: 'Inter-Medium',
    uiSemiBold: 'Inter-SemiBold',
    uiBold: 'Inter-Bold',
    mono: 'JetBrainsMono',
} as const;

export const RoadshowType = {
    eyebrow: {
        fontFamily: TropicFonts.uiSemiBold,
        fontSize: 10.5,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    } satisfies TextStyle,

    eyebrowSm: {
        fontFamily: TropicFonts.uiSemiBold,
        fontSize: 9.5,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    } satisfies TextStyle,

    titleXL: {
        fontFamily: TropicFonts.serif,
        fontSize: 32,
        fontWeight: '400',
        letterSpacing: -0.7,
        lineHeight: 33,
    } satisfies TextStyle,

    titleLg: {
        fontFamily: TropicFonts.serif,
        fontSize: 28,
        fontWeight: '400',
        letterSpacing: -0.7,
        lineHeight: 29,
    } satisfies TextStyle,

    titleMd: {
        fontFamily: TropicFonts.serif,
        fontSize: 22,
        fontWeight: '500',
        letterSpacing: -0.4,
        lineHeight: 24,
    } satisfies TextStyle,

    heroNumber: {
        fontFamily: TropicFonts.serif,
        fontSize: 44,
        fontWeight: '500',
        letterSpacing: -1.4,
        lineHeight: 44,
    } satisfies TextStyle,

    statLg: {
        fontFamily: TropicFonts.serif,
        fontSize: 22,
        fontWeight: '500',
        letterSpacing: -0.4,
    } satisfies TextStyle,

    statMd: {
        fontFamily: TropicFonts.serif,
        fontSize: 16,
        fontWeight: '500',
    } satisfies TextStyle,

    serifAccent: {
        fontFamily: TropicFonts.serifItalic,
        fontWeight: '500',
    } satisfies TextStyle,

    body: {
        fontFamily: TropicFonts.ui,
        fontSize: 12.5,
        lineHeight: 18,
    } satisfies TextStyle,

    bodyMd: {
        fontFamily: TropicFonts.uiMedium,
        fontSize: 13,
    } satisfies TextStyle,

    caption: {
        fontFamily: TropicFonts.ui,
        fontSize: 11,
    } satisfies TextStyle,

    tabular: {
        fontVariant: ['tabular-nums'],
    } satisfies TextStyle,
} as const;
