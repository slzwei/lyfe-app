import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

interface Props {
    displayCode: string;
    currentIndex: number;
    totalQuestions: number;
    timeLeft: number;
    isPersonalityQuiz: boolean;
    colors: ThemeColors;
    onBack: () => void;
}

function ExamTopBar({
    displayCode,
    currentIndex,
    totalQuestions,
    timeLeft,
    isPersonalityQuiz,
    colors,
    onBack,
}: Props) {
    const isTimeLow = timeLeft < 300;

    return (
        <View style={[styles.topBar, { borderBottomColor: colors.borderLight }]}>
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.topCenter}>
                <Text style={[styles.paperCode, { color: colors.accent }]}>{displayCode}</Text>
                <Text style={[styles.questionCount, { color: colors.textSecondary }]}>
                    {currentIndex + 1} / {totalQuestions}
                </Text>
            </View>
            {isPersonalityQuiz ? (
                <View style={styles.timerBadge} />
            ) : (
                <View
                    style={[
                        styles.timerBadge,
                        { backgroundColor: isTimeLow ? colors.dangerLight : colors.surfacePrimary },
                    ]}
                >
                    <Ionicons
                        name="time-outline"
                        size={16}
                        color={isTimeLow ? colors.danger : colors.textSecondary}
                    />
                    <Text style={[styles.timerText, { color: isTimeLow ? colors.danger : colors.textPrimary }]}>
                        {formatTime(timeLeft)}
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 0.5,
    },
    backButton: {
        padding: 8,
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topCenter: { alignItems: 'center' },
    paperCode: { fontSize: 14, fontWeight: '700' },
    questionCount: { fontSize: 12, marginTop: 2 },
    timerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    timerText: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
});

export default React.memo(ExamTopBar);
