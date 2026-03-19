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
            {/* Timeline line + dot */}
            <View style={styles.timeline}>
                <View style={[styles.dot, { backgroundColor: iconConfig.color }]}>
                    <Ionicons name={iconConfig.icon} size={12} color={colors.textInverse} />
                </View>
                {!isLast && <View style={[styles.line, { backgroundColor: colors.borderLight }]} />}
            </View>

            {/* Content */}
            <View style={[styles.content, { paddingBottom: isLast ? 0 : 16 }]}>
                <Text style={[styles.description, { color: colors.textPrimary }]}>
                    {getActivityDescription(activity)}
                </Text>
                <Text style={[styles.time, { color: colors.textTertiary }]}>
                    {activity.actor_name ? `${activity.actor_name} · ` : ''}
                    {timeAgo(activity.created_at)}
                </Text>
            </View>
        </View>
    );
}

export default React.memo(LeadActivityItem);

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
    },
    timeline: {
        width: 30,
        alignItems: 'center',
    },
    dot: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    line: {
        width: 2,
        flex: 1,
        marginTop: 4,
    },
    content: {
        flex: 1,
        marginLeft: 10,
        paddingTop: 2,
    },
    description: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '500',
    },
    time: {
        fontSize: 11,
        marginTop: 2,
    },
});
