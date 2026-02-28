import { useTheme } from '@/contexts/ThemeContext';
import { ACTIVITY_ICONS, type LeadActivity } from '@/types/lead';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface LeadActivityItemProps {
    activity: LeadActivity;
    isLast?: boolean;
}

function formatActivityTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;

    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;

    return date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: '2-digit' });
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
            return 'Phone call logged';
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

export default function LeadActivityItem({ activity, isLast }: LeadActivityItemProps) {
    const { colors } = useTheme();
    const iconConfig = ACTIVITY_ICONS[activity.type];

    return (
        <View style={styles.container}>
            {/* Timeline line + dot */}
            <View style={styles.timeline}>
                <View style={[styles.dot, { backgroundColor: iconConfig.color }]}>
                    <Ionicons name={iconConfig.icon as any} size={12} color="#FFFFFF" />
                </View>
                {!isLast && <View style={[styles.line, { backgroundColor: colors.borderLight }]} />}
            </View>

            {/* Content */}
            <View style={[styles.content, { paddingBottom: isLast ? 0 : 16 }]}>
                <Text style={[styles.description, { color: colors.textPrimary }]}>
                    {getActivityDescription(activity)}
                </Text>
                <Text style={[styles.time, { color: colors.textTertiary }]}>
                    {formatActivityTime(activity.created_at)}
                </Text>
            </View>
        </View>
    );
}

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
