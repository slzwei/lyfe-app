import { useTheme } from '@/contexts/ThemeContext';
import { timeAgo } from '@/lib/dateTime';
import { ACTIVITY_ICONS, type LeadActivity } from '@/types/lead';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface LeadActivityItemProps {
    activity: LeadActivity;
    isLast?: boolean;
}

function getActivityDescription(activity: LeadActivity): string {
    if (activity.description) return activity.description;

    switch (activity.type) {
        case 'created':
            return 'Lead created';
        case 'status_change': {
            const from = activity.metadata?.from_status || '?';
            const to = activity.metadata?.to_status || '?';
            return `Status changed: ${from} → ${to}`;
        }
        case 'reassignment': {
            const to = activity.metadata?.to_agent_name || 'another agent';
            return `Reassigned to ${to}`;
        }
        case 'call':
            return activity.metadata?.phone ? `Called ${activity.metadata.phone}` : 'Phone call logged';
        case 'whatsapp':
            return activity.metadata?.phone ? `Sent WhatsApp to ${activity.metadata.phone}` : 'WhatsApp message sent';
        case 'email':
            return 'Email sent';
        case 'meeting':
            return 'Meeting scheduled';
        case 'follow_up':
            return 'Follow-up scheduled';
        default:
            return 'Activity logged';
    }
}

function LeadActivityItem({ activity, isLast }: LeadActivityItemProps) {
    const { colors } = useTheme();
    const iconConfig = ACTIVITY_ICONS[activity.type];

    return (
        <View style={styles.container}>
            {/* Timeline track */}
            <View style={styles.track}>
                <View style={[styles.dot, { backgroundColor: iconConfig.color }]}>
                    <Ionicons name={iconConfig.icon} size={11} color="#fff" />
                </View>
                {!isLast && <View style={[styles.line, { backgroundColor: colors.border }]} />}
            </View>

            {/* Content bubble */}
            <View style={[styles.bubble, { backgroundColor: colors.surfaceSecondary }, !isLast && styles.bubbleGap]}>
                <Text style={[styles.description, { color: colors.textPrimary }]}>
                    {getActivityDescription(activity)}
                </Text>
                <View style={styles.metaRow}>
                    {activity.actor_name && (
                        <>
                            <Text style={[styles.actor, { color: colors.accent }]}>{activity.actor_name}</Text>
                            <View style={[styles.metaDot, { backgroundColor: colors.textTertiary }]} />
                        </>
                    )}
                    <Text style={[styles.time, { color: colors.textTertiary }]}>{timeAgo(activity.created_at)}</Text>
                </View>
            </View>
        </View>
    );
}

export default React.memo(LeadActivityItem);

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        gap: 12,
    },

    // ── Timeline ──
    track: {
        width: 28,
        alignItems: 'center',
        paddingTop: 2,
    },
    dot: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    line: {
        width: 2,
        flex: 1,
        marginTop: 6,
        borderRadius: 1,
    },

    // ── Content ──
    bubble: {
        flex: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 8,
    },
    bubbleGap: {
        marginBottom: 8,
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '500',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    actor: {
        fontSize: 11,
        fontWeight: '600',
    },
    metaDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        opacity: 0.5,
    },
    time: {
        fontSize: 11,
    },
});
