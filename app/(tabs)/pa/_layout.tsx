import { useTheme } from '@/contexts/ThemeContext';
import { useRequireRole } from '@/hooks/useRequireRole';
import { Stack } from 'expo-router';
import React from 'react';

export default function PaLayout() {
    const { colors } = useTheme();
    const authorized = useRequireRole('admin', 'pa');
    if (!authorized) return null;

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
            <Stack.Screen name="event/create" />
            <Stack.Screen name="add-candidate" options={{ presentation: 'modal' }} />
            <Stack.Screen name="invite-member" options={{ presentation: 'modal' }} />
            <Stack.Screen name="candidate/progress/[candidateId]" options={{ presentation: 'card' }} />
        </Stack>
    );
}
