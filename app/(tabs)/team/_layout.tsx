import { CandidateProgressionProvider } from '@/contexts/CandidateProgressionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useRequireRole } from '@/hooks/useRequireRole';
import { Stack, useGlobalSearchParams } from 'expo-router';
import React from 'react';

export default function TeamLayout() {
    const { colors } = useTheme();
    const authorized = useRequireRole('admin', 'director', 'manager');
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
                <Stack.Screen name="agent/[agentId]" options={{ presentation: 'card' }} />
                <Stack.Screen name="candidate/[candidateId]" options={{ presentation: 'card' }} />
                <Stack.Screen name="lead/[leadId]" options={{ presentation: 'card' }} />
                <Stack.Screen name="add-candidate" options={{ presentation: 'modal' }} />
                <Stack.Screen name="invite-member" options={{ presentation: 'modal' }} />
                <Stack.Screen name="candidate/progress/[candidateId]" options={{ presentation: 'card' }} />
                <Stack.Screen name="candidate/papers/[candidateId]/[code]" options={{ presentation: 'card' }} />
            </Stack>
        </CandidateProgressionProvider>
    );
}
