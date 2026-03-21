import { useTheme } from '@/contexts/ThemeContext';
import { Stack } from 'expo-router';

export default function ExamsLayout() {
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
            <Stack.Screen name="study" />
            <Stack.Screen
                name="take/[paperId]"
                options={{
                    gestureEnabled: false, // Prevent swipe-back during exam
                    animation: 'slide_from_bottom',
                }}
            />
            <Stack.Screen name="results/[attemptId]" />
            <Stack.Screen name="results/vark/[attemptId]" />
            <Stack.Screen name="results/enneagram/[attemptId]" />
            <Stack.Screen
                name="disc"
                options={{
                    gestureEnabled: false,
                    animation: 'slide_from_bottom',
                }}
            />
            <Stack.Screen name="results/disc/[attemptId]" />
        </Stack>
    );
}
