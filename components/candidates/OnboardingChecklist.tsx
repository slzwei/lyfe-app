import type { CandidateDocument, RecruitmentCandidate } from '@/types/recruitment';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ChecklistItem {
    label: string;
    completed: boolean;
    icon: keyof typeof Ionicons.glyphMap;
}

interface Props {
    candidate: RecruitmentCandidate;
    documents: CandidateDocument[];
    colors: ThemeColors;
}

function deriveChecklist(candidate: RecruitmentCandidate, documents: CandidateDocument[]): ChecklistItem[] {
    const { profile_details, disc_results, interviews, status } = candidate;
    const hasResume = documents.some((d) => d.label === 'Resume');
    const hasCompletedInterview = interviews.some((i) => i.status === 'completed');
    const approvedStatuses = ['approved', 'eapp_done', 'exam_prep', 'licensed', 'active_agent'];
    const licensedStatuses = ['licensed', 'active_agent'];

    return [
        { label: 'Profile submitted', completed: profile_details?.completed ?? false, icon: 'person-outline' },
        { label: 'DISC completed', completed: disc_results !== null, icon: 'analytics-outline' },
        { label: 'Resume uploaded', completed: hasResume, icon: 'document-attach-outline' },
        { label: 'Interview scheduled', completed: interviews.length > 0, icon: 'calendar-outline' },
        { label: 'Interview completed', completed: hasCompletedInterview, icon: 'checkmark-circle-outline' },
        { label: 'Approved', completed: approvedStatuses.includes(status), icon: 'shield-checkmark-outline' },
        { label: 'Licensed', completed: licensedStatuses.includes(status), icon: 'ribbon-outline' },
    ];
}

export default function OnboardingChecklist({ candidate, documents, colors }: Props) {
    const items = useMemo(() => deriveChecklist(candidate, documents), [candidate, documents]);
    const completedCount = items.filter((i) => i.completed).length;

    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Ionicons name="checkbox-outline" size={16} color={colors.accent} />
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Onboarding</Text>
                </View>
                <Text style={[styles.progress, { color: colors.accent }]}>
                    {completedCount}/{items.length}
                </Text>
            </View>

            <View style={[styles.progressBar, { backgroundColor: colors.surfaceSecondary }]}>
                <View
                    style={[
                        styles.progressFill,
                        {
                            backgroundColor: colors.accent,
                            width: `${(completedCount / items.length) * 100}%`,
                        },
                    ]}
                />
            </View>

            {items.map((item) => (
                <View key={item.label} style={styles.row}>
                    <Ionicons
                        name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={item.completed ? colors.success : colors.textTertiary}
                    />
                    <Text
                        style={[
                            styles.label,
                            {
                                color: item.completed ? colors.textSecondary : colors.textPrimary,
                                textDecorationLine: item.completed ? 'line-through' : 'none',
                            },
                        ]}
                    >
                        {item.label}
                    </Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 12,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
    },
    progress: {
        fontSize: 13,
        fontWeight: '700',
    },
    progressBar: {
        height: 4,
        borderRadius: 2,
        marginBottom: 12,
    },
    progressFill: {
        height: 4,
        borderRadius: 2,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 7,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
    },
});
