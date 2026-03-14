import type { ThemeColors } from '@/types/theme';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
    currentIndex: number;
    totalQuestions: number;
    colors: ThemeColors;
}

function ExamProgressBar({ currentIndex, totalQuestions, colors }: Props) {
    return (
        <View style={[styles.progressBarOuter, { backgroundColor: colors.surfacePrimary }]}>
            <View
                style={[
                    styles.progressBarInner,
                    {
                        backgroundColor: colors.accent,
                        width: `${((currentIndex + 1) / totalQuestions) * 100}%`,
                    },
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    progressBarOuter: { height: 3 },
    progressBarInner: { height: 3 },
});

export default React.memo(ExamProgressBar);
