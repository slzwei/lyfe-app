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
            <Stack.Screen name="notifications" />
            <Stack.Screen name="privacy" />
            <Stack.Screen name="help" />
            <Stack.Screen name="terms" />
        </Stack>
    );
}
