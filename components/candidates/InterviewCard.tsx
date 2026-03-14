import type { Interview } from '@/types/recruitment';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const STATUS_COLORS: Record<string, string> = {
    scheduled: '#007AFF',
    completed: '#34C759',
    cancelled: '#FF3B30',
    rescheduled: '#FF9500',
};

const STATUS_LABELS: Record<string, string> = {
    scheduled: 'Scheduled',
    completed: 'Completed',
    cancelled: 'Cancelled',
    rescheduled: 'Rescheduled',
};

interface InterviewCardProps {
    interview: Interview;
    colors: {
        cardBackground: string;
        textPrimary: string;
        textSecondary: string;
        textTertiary: string;
        border: string;
        background: string;
        [key: string]: string | undefined;
    };
}

function formatInterviewDate(datetime: string): string {
    const d = new Date(datetime);
    return d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatInterviewTime(datetime: string): string {
    const d = new Date(datetime);
    return d.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function InterviewCard({ interview, colors }: InterviewCardProps) {
    const statusColor = STATUS_COLORS[interview.status] ?? colors.textTertiary;
    const isZoom = interview.type === 'zoom';

    return (
        <View style={[styles.card, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.header}>
                <Text style={[styles.round, { color: colors.textPrimary }]}>Round {interview.round_number}</Text>
                <Text style={[styles.status, { color: statusColor }]}>
                    {STATUS_LABELS[interview.status] ?? interview.status}
                </Text>
            </View>
            <View style={styles.row}>
                <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
                <Text style={[styles.detail, { color: colors.textSecondary }]}>
                    {formatInterviewDate(interview.datetime)} at {formatInterviewTime(interview.datetime)}
                </Text>
            </View>
            <View style={styles.row}>
                <Ionicons
                    name={isZoom ? 'videocam-outline' : 'location-outline'}
                    size={14}
                    color={colors.textTertiary}
                />
                <Text style={[styles.detail, { color: colors.textSecondary }]}>
                    {isZoom ? 'Zoom' : (interview.location ?? 'In-person')}
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 10,
        borderWidth: 0.5,
        padding: 12,
        marginTop: 8,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    round: { fontSize: 14, fontWeight: '600' },
    status: { fontSize: 12, fontWeight: '600' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    detail: { fontSize: 13 },
});
