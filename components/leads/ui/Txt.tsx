/**
 * Leads-scoped typography primitive (ported from mktr-leads `Typography.tsx`,
 * re-skinned to lyfe's `Fonts`). Three roles:
 *   display → Albert Sans bold/semibold  (lead names, screen titles)
 *   body    → Albert Sans                (everything readable)
 *   mono    → JetBrains Mono             (phone, MKTR-XXXXXX ids, timestamps)
 *
 * IMPORTANT (brand rule, enforced in `typography-tokens.ts`): Fraunces/serif is
 * for greetings + one hero number only — NEVER list-row names or activity items.
 * So `display` maps to SANS here, not serif. Per RN custom-font guidance we set
 * the weighted family name explicitly and never also set `fontWeight` (Android
 * would otherwise synthesize a weight).
 */
import React from 'react';
import { Text as RNText, TextProps, StyleProp, TextStyle } from 'react-native';
import { Fonts } from '@/constants/type';
import { useLeadsTheme } from '@/lib/leads/theme';

type Role = 'display' | 'body' | 'mono';
type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

const FAMILY: Record<Role, Record<Weight, string>> = {
    display: {
        regular: Fonts.sansMedium,
        medium: Fonts.sansMedium,
        semibold: Fonts.sansSemibold,
        bold: Fonts.sansBold,
    },
    body: {
        regular: Fonts.sans,
        medium: Fonts.sansMedium,
        semibold: Fonts.sansSemibold,
        bold: Fonts.sansBold,
    },
    mono: {
        regular: Fonts.mono,
        medium: Fonts.monoMedium,
        semibold: Fonts.monoMedium,
        bold: Fonts.monoMedium,
    },
};

const DEFAULT_WEIGHT: Record<Role, Weight> = { display: 'semibold', body: 'regular', mono: 'medium' };

// Omit RN's accessibility `role` so our typographic `role` is free.
export interface TxtProps extends Omit<TextProps, 'role'> {
    role?: Role;
    weight?: Weight;
    size?: number;
    color?: string;
    /** Letter-spacing in px (display titles read tighter). */
    tracking?: number;
    /** Line height in px. */
    leading?: number;
    uppercase?: boolean;
    center?: boolean;
}

export function Txt({
    role = 'body',
    weight,
    size = 15,
    color,
    tracking,
    leading,
    uppercase,
    center,
    style,
    ...rest
}: TxtProps) {
    const { colors } = useLeadsTheme();
    const w = weight ?? DEFAULT_WEIGHT[role];
    const base: StyleProp<TextStyle> = {
        fontFamily: FAMILY[role][w],
        fontSize: size,
        color: color ?? colors.text,
        ...(tracking != null ? { letterSpacing: tracking } : null),
        ...(leading != null ? { lineHeight: leading } : null),
        ...(uppercase ? { textTransform: 'uppercase' } : null),
        ...(center ? { textAlign: 'center' } : null),
    };
    return <RNText {...rest} style={[base, style]} />;
}

/** UPPERCASE meta label ("STATUS", "ACTIVITY", section heads). 13pt floor (CLAUDE.md a11y). */
export function Eyebrow({ color, size = 13, weight = 'bold', tracking = 1.1, style, ...rest }: TxtProps) {
    const { colors } = useLeadsTheme();
    return (
        <Txt
            role="body"
            weight={weight}
            size={size}
            color={color ?? colors.textFaint}
            tracking={tracking}
            uppercase
            style={style}
            {...rest}
        />
    );
}
