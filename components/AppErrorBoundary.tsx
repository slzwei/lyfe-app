import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
}

class AppErrorBoundaryInner extends React.Component<InnerProps, InnerState> {
    state: InnerState = { hasError: false };

    static getDerivedStateFromError(): InnerState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        Sentry.withScope((scope) => {
            scope.setExtra('componentStack', errorInfo.componentStack);
            Sentry.captureException(error);
        });
    }

    handleReset = () => {
        this.setState({ hasError: false });
    };

    render() {
        const { colors } = this.props;

        if (this.state.hasError) {
            return (
                <View style={[styles.container, { backgroundColor: colors.background }]}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Something went wrong</Text>
                    <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                        An unexpected error occurred. Please try again.
                    </Text>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: colors.accent }]}
                        onPress={this.handleReset}
                    >
                        <Text style={[styles.buttonText, { color: colors.textInverse }]}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return this.props.children;
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
});
