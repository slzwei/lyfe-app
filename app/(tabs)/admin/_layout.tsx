import { useTheme } from '@/contexts/ThemeContext';
import { useRequireRole } from '@/hooks/useRequireRole';
import { Stack } from 'expo-router';
import React from 'react';

export default function AdminLayout() {
    const { colors } = useTheme();
    const authorized = useRequireRole('admin');
    if (!authorized) return null;

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
            }}
        >
            <Stack.Screen name="index" />
        </Stack>
    );
}
