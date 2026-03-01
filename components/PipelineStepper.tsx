import { useTheme } from '@/contexts/ThemeContext';
import { CANDIDATE_STATUS_CONFIG, type CandidateStatus } from '@/types/recruitment';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface PipelineStepperProps {
    currentStatus: CandidateStatus;
}

const ORDERED_STATUSES: CandidateStatus[] = [
    'applied',
    'interview_scheduled',
    'interviewed',
    'approved',
    'exam_prep',
    'licensed',
    'active_agent',
];

export default function PipelineStepper({ currentStatus }: PipelineStepperProps) {
    const { colors } = useTheme();
    const currentIndex = ORDERED_STATUSES.indexOf(currentStatus);

    return (
        <View style={styles.container}>
            <View style={styles.stepsRow}>
                {ORDERED_STATUSES.map((status, index) => {
                    const config = CANDIDATE_STATUS_CONFIG[status];
                    const isCompleted = index < currentIndex;
                    const isCurrent = index === currentIndex;
                    const isUpcoming = index > currentIndex;

                    return (
                        <React.Fragment key={status}>
                            {index > 0 && (
                                <View
                                    style={[
                                        styles.connector,
                                        {
                                            backgroundColor: isCompleted || isCurrent
                                                ? colors.accent
                                                : colors.border,
                                        },
                                    ]}
                                />
                            )}
                            <View style={styles.stepContainer}>
                                <View
                                    style={[
                                        styles.dot,
                                        isCompleted && { backgroundColor: colors.accent },
                                        isCurrent && { backgroundColor: colors.accent, transform: [{ scale: 1.3 }] },
                                        isUpcoming && { backgroundColor: colors.border },
                                    ]}
                                />
                                <Text
                                    style={[
                                        styles.stepLabel,
                                        {
                                            color: isCurrent
                                                ? colors.accent
                                                : isCompleted
                                                    ? colors.textSecondary
                                                    : colors.textTertiary,
                                            fontWeight: isCurrent ? '600' : '400',
                                        },
                                    ]}
                                    numberOfLines={1}
                                >
                                    {config.label}
                                </Text>
                            </View>
                        </React.Fragment>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 8,
    },
    stepsRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    stepContainer: {
        alignItems: 'center',
        width: 48,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginBottom: 6,
    },
    connector: {
        height: 2,
        flex: 1,
        marginTop: 4,
    },
    stepLabel: {
        fontSize: 10,
        textAlign: 'center',
    },
});
