import { useFonts } from 'expo-font';
import { Stack, useNavigationContainerRef, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import AppErrorBoundary from '@/components/AppErrorBoundary';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { NetworkProvider } from '@/contexts/NetworkContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ViewModeProvider } from '@/contexts/ViewModeContext';
import { initSentry, navigationIntegration, Sentry } from '@/lib/sentry';

export { ErrorBoundary } from 'expo-router';

initSentry();

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading, user } = useAuth();
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === '(auth)';
        const inOnboarding = segments[0] === 'onboarding';

        if (!isAuthenticated && !inAuthGroup) {
            // Not authenticated → redirect to login
            router.replace('/(auth)/login');
        } else if (isAuthenticated && inAuthGroup) {
            // Already authenticated → check onboarding status
            if (user && user.onboarding_complete === false) {
                router.replace('/onboarding/Welcome');
            } else {
                router.replace('/(tabs)/home');
            }
        } else if (isAuthenticated && !inOnboarding && user && user.onboarding_complete === false) {
            // Authenticated but needs onboarding
            router.replace('/onboarding/Welcome');
        }
    }, [isAuthenticated, isLoading, segments, router, user]);

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
        Pacifico: require('../assets/fonts/Pacifico-Regular.ttf'),
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
    );
}

export default Sentry.wrap(RootLayout);
