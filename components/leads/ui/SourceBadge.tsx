/**
 * Source badge pinned to the lead monogram — a small, favicon-style acquisition-source mark
 * (ported from mktr-leads · components/SourceBadge.tsx). Per-platform brand glyphs (Facebook /
 * Instagram / TikTok / Google / Meta) plus neutral chips for QR / referral / voice / web /
 * walk-in / event / MKTR. Glyphs come from @expo/vector-icons (Ionicons + FontAwesome6 for the
 * Meta loop mark) — no new native module / asset, so it OTAs to released builds.
 *
 * Source resolution (notes `Source:` → MKTR identity → manual enum) lives in
 * lib/leads/sourceBadge.ts; this component owns only the kind → glyph/color/visual mapping.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons, FontAwesome6 } from '@expo/vector-icons';
import { useLeadsTheme } from '@/lib/leads/theme';
import { resolveLeadSource, type SourceKind } from '@/lib/leads/sourceBadge';
import type { Lead } from '@/types/lead';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type FA6Name = React.ComponentProps<typeof FontAwesome6>['name'];
/** A badge glyph from one of two icon families: most are Ionicons, but the Meta kind uses
 *  the real Meta loop mark, which only exists in the FontAwesome6 brands set. */
type Glyph = { set: 'ion'; name: IoniconName } | { set: 'fa6'; name: FA6Name };

export function SourceBadge({
    lead,
    size = 18,
    /** Card background behind the badge — drives the separating ring (Won cards differ). */
    ringColor,
}: {
    lead: Pick<Lead, 'source' | 'source_name'> & { notes?: string | null };
    size?: number;
    ringColor?: string;
}) {
    const { colors } = useLeadsTheme();
    /** Kind → glyph (icon family + name) + chip background + glyph color. Brand fills are
     * constant (a Facebook mark is always blue); the neutral chips track the theme. */
    const VISUAL: Record<SourceKind, { glyph: Glyph; bg: string; fg: string }> = {
        // The real Meta corporate mark (FontAwesome6 brands "meta" loop). Audience Network (a
        // Meta ad inside a third-party app) + Messenger + bare "meta" all resolve here, so it
        // must read as Meta — NOT the Facebook "f" below, which is its own platform.
        meta: { glyph: { set: 'fa6', name: 'meta' }, bg: '#0866FF', fg: '#FFFFFF' },
        facebook: { glyph: { set: 'ion', name: 'logo-facebook' }, bg: '#0866FF', fg: '#FFFFFF' },
        instagram: { glyph: { set: 'ion', name: 'logo-instagram' }, bg: '#E4405F', fg: '#FFFFFF' },
        // TikTok's mark is black; a white chip keeps it visible on either surface.
        tiktok: { glyph: { set: 'ion', name: 'logo-tiktok' }, bg: '#FFFFFF', fg: '#000000' },
        google: { glyph: { set: 'ion', name: 'logo-google' }, bg: '#FFFFFF', fg: '#4285F4' },
        qr: { glyph: { set: 'ion', name: 'qr-code' }, bg: colors.surfaceAlt, fg: colors.textMuted },
        referral: { glyph: { set: 'ion', name: 'people' }, bg: colors.surfaceAlt, fg: colors.accent },
        call: { glyph: { set: 'ion', name: 'call' }, bg: colors.surfaceAlt, fg: colors.accent },
        web: { glyph: { set: 'ion', name: 'globe-outline' }, bg: colors.surfaceAlt, fg: colors.textMuted },
        ad: { glyph: { set: 'ion', name: 'megaphone-outline' }, bg: colors.surfaceAlt, fg: colors.textMuted },
        // An MKTR lead with no derivable platform — the external/delivered identity.
        mktr: { glyph: { set: 'ion', name: 'megaphone-outline' }, bg: colors.surfaceAlt, fg: colors.accent },
        walk_in: { glyph: { set: 'ion', name: 'walk-outline' }, bg: colors.surfaceAlt, fg: colors.textMuted },
        event: { glyph: { set: 'ion', name: 'calendar-outline' }, bg: colors.surfaceAlt, fg: colors.textMuted },
        unknown: { glyph: { set: 'ion', name: 'globe-outline' }, bg: colors.surfaceAlt, fg: colors.textFaint },
    };
    const { kind } = resolveLeadSource(lead);
    const v = VISUAL[kind];
    const glyphSize = Math.round(size * 0.62);
    const ringBg = ringColor ?? colors.surface;
    const ringWidth = Math.max(2, Math.round(size * 0.12));
    return (
        <View
            // Decorative — the source is announced via the card's accessibilityLabel.
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
                styles.badge,
                {
                    width: size,
                    height: size,
                    borderRadius: Math.round(size * 0.32),
                    backgroundColor: v.bg,
                    borderWidth: ringWidth,
                    borderColor: ringBg,
                },
            ]}
        >
            {v.glyph.set === 'fa6' ? (
                <FontAwesome6 name={v.glyph.name} size={glyphSize} color={v.fg} />
            ) : (
                <Ionicons name={v.glyph.name} size={glyphSize} color={v.fg} />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    badge: { alignItems: 'center', justifyContent: 'center' },
});
