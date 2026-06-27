/**
 * Rich lead activity timeline (mktr-leads UI/UX adoption · Option B).
 *
 * NEW leads-local component — replaces the flat shared `LeadActivityItem` on the
 * detail screen WITHOUT touching it (it stays in place, used by nothing else).
 * Rail + bubble, with an outcome chip + next-step when the activity metadata
 * carries them (MKTR/Hustle-logged touchpoints); plain title otherwise.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from './ui/Txt';
import { useLeadsTheme, alpha, spacing, radius } from '@/lib/leads/theme';
import { timeAgo } from '@/lib/dateTime';
import { formatSgPhone } from '@/lib/phone';
import type { LeadActivity, LeadActivityType } from '@/types/lead';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function str(v: unknown): string | null {
    return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

function deriveTitle(a: LeadActivity): string {
    const m = (a.metadata ?? {}) as Record<string, unknown>;
    switch (a.type) {
        case 'created':
            return a.description || 'Lead created';
        case 'status_change':
            return `Status: ${str(m.from_status) ?? '?'} → ${str(m.to_status) ?? '?'}`;
        case 'reassignment':
            return `Reassigned to ${str(m.to_agent_name) ?? 'another agent'}`;
        case 'call':
            return a.description || (str(m.phone) ? `Called ${formatSgPhone(str(m.phone)!)}` : 'Call logged');
        case 'whatsapp':
            return a.description || 'WhatsApp sent';
        case 'email':
            return a.description || 'Email sent';
        case 'meeting':
            return a.description || 'Meeting';
        case 'follow_up':
            return a.description || 'Follow-up scheduled';
        default:
            // includes server-only types not in the shared union (e.g. 'unassignment')
            return a.description || 'Note';
    }
}

export function ActivityFeed({ activities }: { activities: LeadActivity[] }) {
    const { colors, statusColors } = useLeadsTheme();
    const styles = useStyles();

    const META: Record<string, { icon: IconName; color: string; squircle?: boolean }> = {
        call: { icon: 'call', color: colors.accent, squircle: true },
        whatsapp: { icon: 'logo-whatsapp', color: colors.whatsapp, squircle: true },
        meeting: { icon: 'people', color: colors.secondary },
        email: { icon: 'mail-outline', color: statusColors.proposed },
        note: { icon: 'create-outline', color: colors.textMuted },
        created: { icon: 'flash', color: colors.accent, squircle: true },
        status_change: { icon: 'flag-outline', color: colors.textMuted },
        reassignment: { icon: 'swap-horizontal', color: colors.accent, squircle: true },
        follow_up: { icon: 'notifications-outline', color: colors.accent },
        unassignment: { icon: 'arrow-undo-outline', color: colors.warning },
    };

    return (
        <View testID="lead-activity-list">
            {activities.map((a, i) => {
                const m = (a.metadata ?? {}) as Record<string, unknown>;
                const meta = META[a.type as LeadActivityType] ?? META.note;
                const title = deriveTitle(a);
                const outcome = str(m.outcome);
                const nextStep = str(m.next_step);
                const last = i === activities.length - 1;
                const rich = !!(outcome || nextStep);
                return (
                    <View key={a.id} testID={`activity-item-${a.id}`} style={styles.row}>
                        <View style={styles.rail}>
                            <View
                                style={[
                                    styles.bubble,
                                    { backgroundColor: alpha(meta.color, 0.16), borderRadius: meta.squircle ? 10 : 99 },
                                ]}
                            >
                                <Ionicons name={meta.icon} size={16} color={meta.color} />
                            </View>
                            {!last ? <View style={styles.line} /> : null}
                        </View>

                        <View style={styles.content}>
                            <View style={styles.titleRow}>
                                <Txt role="body" weight="semibold" size={14.5} color={colors.text} style={styles.title}>
                                    {title}
                                </Txt>
                                <Txt role="mono" size={12} color={colors.textFaint}>
                                    {timeAgo(a.created_at)}
                                </Txt>
                            </View>
                            {a.actor_name ? (
                                <Txt role="body" size={12.5} color={colors.accent} style={styles.actor}>
                                    {a.actor_name}
                                </Txt>
                            ) : null}
                            {rich ? (
                                <View style={styles.subCard}>
                                    {outcome ? (
                                        <View
                                            style={[styles.outcome, { backgroundColor: alpha(colors.success, 0.16) }]}
                                        >
                                            <Txt role="body" weight="bold" size={11.5} color={colors.success}>
                                                {outcome}
                                            </Txt>
                                        </View>
                                    ) : null}
                                    {nextStep ? (
                                        <View style={styles.nextRow}>
                                            <Ionicons name="flag-outline" size={13} color={colors.accent} />
                                            <Txt role="body" size={12.5} color={colors.textMuted} style={{ flex: 1 }}>
                                                {nextStep}
                                            </Txt>
                                        </View>
                                    ) : null}
                                </View>
                            ) : null}
                        </View>
                    </View>
                );
            })}
        </View>
    );
}

function useStyles() {
    const { colors } = useLeadsTheme();
    return StyleSheet.create({
        row: { flexDirection: 'row', gap: 12 },
        rail: { width: 34, alignItems: 'center', flexShrink: 0 },
        bubble: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
        line: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: 5, minHeight: 14 },
        content: { flex: 1, minWidth: 0, paddingBottom: spacing.lg },
        titleRow: {
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 8,
            marginTop: 6,
        },
        title: { flex: 1 },
        actor: { marginTop: 2 },
        subCard: {
            marginTop: 8,
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.chip + 3,
            padding: 12,
            gap: 9,
        },
        outcome: {
            flexDirection: 'row',
            alignSelf: 'flex-start',
            paddingVertical: 3,
            paddingHorizontal: 9,
            borderRadius: 99,
        },
        nextRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    });
}
