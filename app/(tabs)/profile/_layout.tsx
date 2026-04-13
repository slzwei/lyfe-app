import { useTheme } from '@/contexts/ThemeContext';
import { Stack } from 'expo-router';
import React from 'react';

export default function ProfileLayout() {
    const { colors } = useTheme();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="face-test" />
            <Stack.Screen name="face-register" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="privacy" />
            <Stack.Screen name="terms" />
            <Stack.Screen name="take/[paperId]" />
            <Stack.Screen name="results/[attemptId]" />
            <Stack.Screen name="results/vark/[attemptId]" />
            <Stack.Screen name="results/enneagram/[attemptId]" />
            <Stack.Screen name="results/disc/[attemptId]" />
        </Stack>
    );
}
