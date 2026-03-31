import { useTheme } from '@/contexts/ThemeContext';
import { useRequireRole } from '@/hooks/useRequireRole';
import { Stack } from 'expo-router';
import React from 'react';

export default function CandidatesLayout() {
    const { colors } = useTheme();
    const authorized = useRequireRole('admin', 'director', 'manager', 'pa');
    if (!authorized) return null;

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="[candidateId]" />
            <Stack.Screen name="progress/[candidateId]" options={{ presentation: 'card' }} />
        </Stack>
    );
}
