import { useFonts } from 'expo-font';
import {
    AlbertSans_400Regular,
    AlbertSans_500Medium,
    AlbertSans_600SemiBold,
    AlbertSans_700Bold,
} from '@expo-google-fonts/albert-sans';
import { Stack, useNavigationContainerRef, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import 'react-native-reanimated';

import AppErrorBoundary from '@/components/AppErrorBoundary';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { NetworkProvider } from '@/contexts/NetworkContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ViewModeProvider } from '@/contexts/ViewModeContext';
import { useLastSeen } from '@/hooks/useLastSeen';
import { initSentry, navigationIntegration, Sentry } from '@/lib/sentry';
import { KeyboardProvider } from 'react-native-keyboard-controller';

// Supabase's internal auto-refresh fires a fetch at module-load time (before
// React error boundaries exist). On flaky networks the first request can fail,
// surfacing a harmless unhandled rejection in the dev overlay. Suppress it —
// initAuth's try/catch already handles the session-restore failure gracefully.
LogBox.ignoreLogs(['Network request failed']);

export { ErrorBoundary } from 'expo-router';

initSentry();

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading, invitationStatus, user } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useLastSeen();

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === '(auth)';
        const inOnboarding = segments[0] === 'onboarding';

        if (!isAuthenticated && segments[1] !== 'login') {
            // Not authenticated → redirect to login (from any screen, including rejected)
            router.replace('/(auth)/login');
        } else if (isAuthenticated && invitationStatus === 'rejected') {
            // Authenticated but no invitation → rejection screen
            if (segments[1] !== 'rejected') {
                router.replace('/(auth)/rejected');
            }
        } else if (isAuthenticated && inAuthGroup && invitationStatus !== 'rejected') {
            // Authenticated with valid invitation → proceed
            if (user?.role === 'candidate' && user.email_verified !== true) {
                router.replace('/onboarding/EmailVerification');
            } else if (user && user.onboarding_complete !== true) {
                router.replace('/onboarding/Welcome');
            } else {
                router.replace('/(tabs)/home');
            }
        } else if (isAuthenticated && !inOnboarding && user?.role === 'candidate' && user.email_verified !== true) {
            // Candidate needs email verification
            router.replace('/onboarding/EmailVerification');
        } else if (isAuthenticated && !inOnboarding && user && user.onboarding_complete !== true) {
            // Authenticated but needs onboarding
            router.replace('/onboarding/Welcome');
        }
    }, [isAuthenticated, isLoading, invitationStatus, segments, router, user]);

    // Block all rendering until auth state is resolved.
    // This prevents any protected screen from flashing before the redirect fires.
    if (isLoading) return null;

    return <>{children}</>;
}

function RootLayoutContent() {
    const { colors, isDark } = useTheme();

    return (
        <AuthGate>
            <StatusBar style={isDark ? 'light' : 'dark'} />
            <Stack
                screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.background },
                }}
            >
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="(tabs)" />
            </Stack>
        </AuthGate>
    );
}

function RootLayout() {
    const ref = useNavigationContainerRef();

    useEffect(() => {
        if (ref?.current) {
            navigationIntegration.registerNavigationContainer(ref);
        }
    }, [ref]);

    const [fontsLoaded, fontError] = useFonts({
        // Editorial serif (Tropic Office) — greetings, one hero number, one italic accent per screen
        Fraunces: require('../assets/fonts/Fraunces-Regular.ttf'),
        'Fraunces-Italic': require('../assets/fonts/Fraunces-Italic.ttf'),

        // Sans UI workhorse — Albert Sans (humanist, warm; replaces Inter per impeccable teach 2026-04-22)
        AlbertSans_400Regular,
        AlbertSans_500Medium,
        AlbertSans_600SemiBold,
        AlbertSans_700Bold,

        // Inter retained for backwards compat with any leftover direct 'Inter' references.
        // Remove once grep shows zero direct Inter usage outside constants/type.ts.
        Inter: require('../assets/fonts/Inter-Regular.ttf'),
        'Inter-Medium': require('../assets/fonts/Inter-Medium.ttf'),
        'Inter-SemiBold': require('../assets/fonts/Inter-SemiBold.ttf'),
        'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),

        // Tabular mono — timestamps and IDs only; never counts/values/labels
        JetBrainsMono: require('../assets/fonts/JetBrainsMono-Regular.ttf'),
        'JetBrainsMono-Medium': require('../assets/fonts/JetBrainsMono-Medium.ttf'),

        // Retained for existing SpaceMono consumers (phased out as Tropic sweeps complete)
        SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    });

    useEffect(() => {
        if (fontError) throw fontError;
    }, [fontError]);

    useEffect(() => {
        if (fontsLoaded) {
            SplashScreen.hideAsync();
        }
    }, [fontsLoaded]);

    if (!fontsLoaded) return null;

    return (
        <KeyboardProvider>
            <ThemeProvider>
                <AppErrorBoundary>
                    <NetworkProvider>
                        <AuthProvider>
                            <ViewModeProvider>
                                <NotificationProvider>
                                    <RootLayoutContent />
                                </NotificationProvider>
                            </ViewModeProvider>
                        </AuthProvider>
                    </NetworkProvider>
                </AppErrorBoundary>
            </ThemeProvider>
        </KeyboardProvider>
    );
}

export default Sentry.wrap(RootLayout);
