import { useTheme } from '@/contexts/ThemeContext';
import { CANDIDATE_STATUSES, CANDIDATE_STATUS_CONFIG, type CandidateStatus } from '@/types/recruitment';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface PipelineStepperProps {
    currentStatus: CandidateStatus;
}

export default function PipelineStepper({ currentStatus }: PipelineStepperProps) {
    const { colors } = useTheme();
    const currentIndex = CANDIDATE_STATUSES.indexOf(currentStatus);

    return (
        <View style={styles.container}>
            {CANDIDATE_STATUSES.map((status, index) => {
                const config = CANDIDATE_STATUS_CONFIG[status];
                const isCompleted = index < currentIndex;
                const isCurrent = index === currentIndex;
                const isActive = isCompleted || isCurrent;

                return (
                    <View key={status} style={styles.stepWrapper}>
                        {/* Connector line (before) */}
                        {index > 0 && (
                            <View
                                style={[
                                    styles.connector,
                                    { backgroundColor: isActive ? config.color : colors.borderLight },
                                ]}
                            />
                        )}

                        {/* Step dot */}
                        <View
                            style={[
                                styles.dot,
                                {
                                    backgroundColor: isActive ? config.color : colors.surfacePrimary,
                                    borderColor: isActive ? config.color : colors.border,
                                },
                            ]}
                        >
                            {isCompleted ? (
                                <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                            ) : isCurrent ? (
                                <Ionicons name={config.icon as any} size={10} color="#FFFFFF" />
                            ) : null}
                        </View>

                        {/* Label */}
                        <Text
                            style={[
                                styles.label,
                                {
                                    color: isActive ? config.color : colors.textTertiary,
                                    fontWeight: isCurrent ? '700' : '400',
                                },
                            ]}
                            numberOfLines={1}
                        >
                            {config.label}
                        </Text>
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    stepWrapper: {
        alignItems: 'center',
        flex: 1,
        position: 'relative',
    },
    connector: {
        position: 'absolute',
        top: 10,
        left: -50 + '%' as any,
        right: 50 + '%' as any,
        height: 2,
        width: '100%',
        zIndex: -1,
    },
    dot: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: 9,
        marginTop: 4,
        textAlign: 'center',
    },
});
