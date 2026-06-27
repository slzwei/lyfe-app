/**
 * Leads list state primitives (ported from mktr-leads, re-skinned): a "live"
 * pill, a card-shaped skeleton, and empty-state blocks with personality.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from './Txt';
import { useLeadsTheme, radius, spacing } from '@/lib/leads/theme';
import type { IconName } from '@/types/ui';

/** "Listening for new leads…" pill with a live dot. */
export function LivePill({ label }: { label: string }) {
    const { colors } = useLeadsTheme();
    return (
        <View style={[styles.pill, { backgroundColor: colors.surfaceAlt }]}>
            <View style={[styles.dot, { backgroundColor: colors.success }]} />
            <Txt role="mono" size={12.5} color={colors.textMuted}>
                {label}
            </Txt>
        </View>
    );
}

/** Card-shaped placeholder, matching LeadListCard's silhouette. */
export function LeadCardSkeleton({ opacity = 1 }: { opacity?: number }) {
    const { colors } = useLeadsTheme();
    return (
        <View style={[styles.skeleton, { backgroundColor: colors.surface, borderColor: colors.border, opacity }]}>
            <View style={styles.skelRow}>
                <View style={[styles.skelAvatar, { backgroundColor: colors.surfaceAlt }]} />
                <View style={{ flex: 1, gap: 8 }}>
                    <View style={[styles.skelBar, { width: '55%', backgroundColor: colors.surfaceAlt }]} />
                    <View style={[styles.skelBar, { width: '40%', height: 11, backgroundColor: colors.surfaceAlt }]} />
                </View>
                <View style={[styles.skelChip, { backgroundColor: colors.surfaceAlt }]} />
            </View>
            <View style={[styles.skelDivider, { backgroundColor: colors.border }]} />
            <View style={[styles.skelBar, { width: '70%', height: 11, backgroundColor: colors.surfaceAlt }]} />
        </View>
    );
}

/** Full empty state with optional footer (e.g. a LivePill). */
export function LeadsEmptyState({
    icon,
    title,
    body,
    footer,
}: {
    icon: IconName;
    title: string;
    body?: string;
    footer?: React.ReactNode;
}) {
    const { colors } = useLeadsTheme();
    return (
        <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name={icon} size={26} color={colors.textFaint} />
            </View>
            <Txt role="display" weight="semibold" size={20} color={colors.text} center tracking={-0.3}>
                {title}
            </Txt>
            {body ? (
                <Txt role="body" size={14.5} color={colors.textMuted} center leading={21} style={{ maxWidth: 300 }}>
                    {body}
                </Txt>
            ) : null}
            {footer ? <View style={{ marginTop: spacing.sm }}>{footer}</View> : null}
        </View>
    );
}

/** Compact "no results for this filter" block. */
export function CompactEmpty({ icon, text }: { icon: IconName; text: string }) {
    const { colors } = useLeadsTheme();
    return (
        <View style={styles.compact}>
            <Ionicons name={icon} size={26} color={colors.textFaint} />
            <Txt role="body" size={14.5} color={colors.textMuted} center>
                {text}
            </Txt>
        </View>
    );
}

const styles = StyleSheet.create({
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 99,
    },
    dot: { width: 8, height: 8, borderRadius: 99 },
    skeleton: {
        borderRadius: radius.card,
        borderWidth: 1,
        paddingVertical: 14,
        paddingHorizontal: spacing.lg,
        marginBottom: 11,
    },
    skelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    skelAvatar: { width: 42, height: 42, borderRadius: 21 },
    skelBar: { height: 14, borderRadius: 6 },
    skelChip: { width: 56, height: 22, borderRadius: 99 },
    skelDivider: { height: 1, marginTop: 12, marginBottom: 11 },
    empty: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.xl },
    emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
    compact: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.xxl },
});
