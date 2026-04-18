import { CandidateProgressionProvider } from '@/contexts/CandidateProgressionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Stack, useGlobalSearchParams } from 'expo-router';
import React from 'react';

export default function HomeLayout() {
    const { colors } = useTheme();
    const { candidateId } = useGlobalSearchParams<{ candidateId?: string }>();

    return (
        <CandidateProgressionProvider candidateId={candidateId}>
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
                <Stack.Screen name="candidate/progress/[candidateId]" options={{ presentation: 'card' }} />
                <Stack.Screen name="candidate/papers/[candidateId]/[code]" options={{ presentation: 'card' }} />
                <Stack.Screen name="lead/[leadId]" />
                <Stack.Screen name="event/[eventId]" options={{ presentation: 'card' }} />
                <Stack.Screen name="add-candidate" options={{ presentation: 'modal' }} />
                <Stack.Screen name="invite-member" options={{ presentation: 'modal' }} />
            </Stack>
        </CandidateProgressionProvider>
    );
}
