import { useTheme } from '@/contexts/ThemeContext';
import { useRequireRole } from '@/hooks/useRequireRole';
import { Stack } from 'expo-router';

export default function RoadmapLayout() {
    const { colors } = useTheme();
    const authorized = useRequireRole('candidate');
    if (!authorized) return null;

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="module/[moduleId]" options={{ presentation: 'card' }} />
            <Stack.Screen
                name="exam/[paperId]"
                options={{
                    gestureEnabled: false,
                    animation: 'slide_from_bottom',
                }}
            />
            <Stack.Screen name="results/[attemptId]" />
            <Stack.Screen name="results/vark/[attemptId]" />
            <Stack.Screen name="results/enneagram/[attemptId]" />
            <Stack.Screen name="results/disc/[attemptId]" />
        </Stack>
    );
}
