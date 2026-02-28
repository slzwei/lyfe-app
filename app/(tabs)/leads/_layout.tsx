import { useTheme } from '@/contexts/ThemeContext';
import { Stack } from 'expo-router';
import React from 'react';

export default function LeadsLayout() {
    const { colors } = useTheme();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="[leadId]" />
            <Stack.Screen name="add" options={{ presentation: 'modal' }} />
        </Stack>
    );
}
