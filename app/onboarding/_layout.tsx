import { useTheme } from '@/contexts/ThemeContext';
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
    const { colors } = useTheme();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                gestureEnabled: false,
            }}
        >
            <Stack.Screen name="Welcome" />
            <Stack.Screen name="ProfileSetup" />
            <Stack.Screen name="AgencyInfo" />
            <Stack.Screen name="OnboardingComplete" />
        </Stack>
    );
}
