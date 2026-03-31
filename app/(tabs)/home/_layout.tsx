import { useTheme } from '@/contexts/ThemeContext';
import { Stack } from 'expo-router';
import React from 'react';

export default function HomeLayout() {
    const { colors } = useTheme();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="analytics" />
            <Stack.Screen name="pipeline" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="candidates" />
            <Stack.Screen name="candidate/[candidateId]" />
            <Stack.Screen name="lead/[leadId]" />
            <Stack.Screen name="event/[eventId]" options={{ presentation: 'card' }} />
            <Stack.Screen name="add-candidate" options={{ presentation: 'modal' }} />
            <Stack.Screen name="invite-member" options={{ presentation: 'modal' }} />
        </Stack>
    );
}
