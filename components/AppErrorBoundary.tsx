import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Sentry } from '@/lib/sentry';
import { useTheme } from '@/contexts/ThemeContext';
import type { Colors } from '@/constants/Colors';

type ThemeColors = (typeof Colors)['light'];

interface InnerProps {
    children: React.ReactNode;
    colors: ThemeColors;
}

interface InnerState {
    hasError: boolean;
    /** Increments on every successful retry. Used as the React key on the
     *  children subtree so a retry forces a clean remount instead of just
     *  toggling hasError — that way persistent state corruption (a bad
     *  cached object in a context provider, for instance) gets cleared
     *  on the way through. */
    resetKey: number;
    /** Number of times the user has hit "Try Again" without leaving the
     *  error screen. After 2 we offer the nuclear option. */
    retryCount: number;
}

/** Keys we own in SecureStore. AsyncStorage gets `clear()` wholesale because
 *  there's no per-key inventory and the app namespace is its own anyway. */
const SECURE_STORE_KEYS = [
    'lyfe_session',
    'lyfe_biometrics_enabled',
    'lyfe_biometrics_prompt_shown',
    'lyfe_biometric_refresh_token',
    'lyfe_face_registered_at',
];

class AppErrorBoundaryInner extends React.Component<InnerProps, InnerState> {
    state: InnerState = { hasError: false, resetKey: 0, retryCount: 0 };

    static getDerivedStateFromError(): Partial<InnerState> {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        Sentry.withScope((scope) => {
            scope.setExtra('componentStack', errorInfo.componentStack);
            scope.setExtra('retryCount', this.state.retryCount);
            Sentry.captureException(error);
        });
    }

    handleReset = () => {
        // Bump resetKey so children remount fresh; bump retryCount so we know
        // when to show the nuclear option.
        this.setState((prev) => ({
            hasError: false,
            resetKey: prev.resetKey + 1,
            retryCount: prev.retryCount + 1,
        }));
    };

    handleClearAndRestart = async () => {
        try {
            await Promise.all([
                AsyncStorage.clear().catch(() => {
                    /* best effort */
                }),
                ...SECURE_STORE_KEYS.map((k) =>
                    SecureStore.deleteItemAsync(k).catch(() => {
                        /* best effort */
                    }),
                ),
            ]);
        } finally {
            // Force a full remount and reset the retry counter — the user
            // will land back on the auth gate, sign in fresh, and start over.
            this.setState({ hasError: false, resetKey: this.state.resetKey + 1, retryCount: 0 });
        }
    };

    render() {
        const { colors } = this.props;

        if (this.state.hasError) {
            const showNuclear = this.state.retryCount >= 2;
            return (
                <View style={[styles.container, { backgroundColor: colors.background }]}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Something went wrong</Text>
                    <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                        {showNuclear
                            ? "Still hitting the same error. Clearing local data and signing you out should fix it — you'll need to sign in again."
                            : 'An unexpected error occurred. Please try again.'}
                    </Text>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: colors.accent }]}
                        onPress={this.handleReset}
                    >
                        <Text style={[styles.buttonText, { color: colors.textInverse }]}>Try Again</Text>
                    </TouchableOpacity>
                    {showNuclear ? (
                        <TouchableOpacity
                            style={[styles.secondaryButton, { borderColor: colors.cardBorder }]}
                            onPress={this.handleClearAndRestart}
                        >
                            <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>
                                Clear data and restart
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            );
        }

        // Children remount on every retry — this clears any in-context state
        // that may have caused the error in the first place.
        return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
    }
}

export default function AppErrorBoundary({ children }: { children: React.ReactNode }) {
    const { colors } = useTheme();
    return <AppErrorBoundaryInner colors={colors}>{children}</AppErrorBoundaryInner>;
}

// Export inner class for testing (can pass colors directly)
export { AppErrorBoundaryInner };

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        textAlign: 'center',
        marginBottom: 24,
    },
    button: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButton: {
        marginTop: 12,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
    },
    secondaryButtonText: {
        fontSize: 14,
        fontWeight: '500',
    },
});
