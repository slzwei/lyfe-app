import { useTheme } from '@/contexts/ThemeContext';
import { Stack } from 'expo-router';
import React from 'react';

export default function PaLayout() {
    const { colors } = useTheme();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="candidate/[candidateId]" options={{ presentation: 'card' }} />
            <Stack.Screen name="event/[eventId]" options={{ presentation: 'card' }} />
            <Stack.Screen name="event/create" options={{ presentation: 'modal' }} />
            <Stack.Screen name="add-candidate" options={{ presentation: 'modal' }} />
        </Stack>
    );
}
