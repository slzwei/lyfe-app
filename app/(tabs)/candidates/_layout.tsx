import { CandidateProgressionProvider } from '@/contexts/CandidateProgressionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useRequireRole } from '@/hooks/useRequireRole';
import { Stack, useGlobalSearchParams } from 'expo-router';
import React from 'react';

export default function CandidatesLayout() {
    const { colors } = useTheme();
    const authorized = useRequireRole('admin', 'director', 'manager', 'pa');
    // useGlobalSearchParams reads the current URL's params. useLocalSearchParams
    // in a layout only exposes the layout's own dynamic segments — candidateId
    // lives on the child route, so we'd get undefined there.
    const { candidateId } = useGlobalSearchParams<{ candidateId?: string }>();
    if (!authorized) return null;

    return (
        <CandidateProgressionProvider candidateId={candidateId}>
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                }}
            >
                <Stack.Screen name="index" />
                <Stack.Screen name="[candidateId]" />
                <Stack.Screen name="progress/[candidateId]" options={{ presentation: 'card' }} />
                <Stack.Screen name="papers/[candidateId]/[code]" options={{ presentation: 'card' }} />
            </Stack>
        </CandidateProgressionProvider>
    );
}
