import { ERROR_BG, ERROR_TEXT } from '@/constants/ui';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ErrorBannerProps {
    message: string;
    onRetry?: () => void;
    onDismiss?: () => void;
}

export default function ErrorBanner({ message, onRetry, onDismiss }: ErrorBannerProps) {
    return (
        <View style={styles.container} accessibilityRole="alert" accessibilityLabel={message}>
            <TouchableOpacity
                style={styles.banner}
                onPress={onRetry}
                activeOpacity={onRetry ? 0.7 : 1}
                disabled={!onRetry}
                accessibilityRole={onRetry ? 'button' : undefined}
                accessibilityLabel={onRetry ? `Error: ${message}. Tap to retry` : undefined}
            >
                <Ionicons name="alert-circle" size={16} color={ERROR_TEXT} />
                <Text style={styles.errorText}>{message}</Text>
                {onRetry && <Text style={styles.retryText}>Tap to retry</Text>}
                {onDismiss && !onRetry && (
                    <TouchableOpacity
                        onPress={onDismiss}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel="Dismiss error"
                    >
                        <Ionicons name="close" size={16} color={ERROR_TEXT} />
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
            {onDismiss && onRetry && (
                <TouchableOpacity
                    style={styles.dismissButton}
                    onPress={onDismiss}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss error"
                >
                    <Ionicons name="close" size={16} color={ERROR_TEXT} />
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: ERROR_BG,
        padding: 12,
        borderRadius: 10,
        marginHorizontal: 16,
        marginBottom: 12,
    },
    banner: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    errorText: { flex: 1, fontSize: 13, color: ERROR_TEXT },
    retryText: { fontSize: 12, fontWeight: '600', color: ERROR_TEXT },
    dismissButton: {
        marginLeft: 8,
    },
});
