import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RejectedScreen() {
    const { colors } = useTheme();
    const { signOut, recheckInvitation } = useAuth();
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);

    const handleSignOut = async () => {
        setIsSigningOut(true);
        await signOut();
    };

    const handleRetry = async () => {
        setIsRetrying(true);
        await recheckInvitation();
        setIsRetrying(false);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.content}>
                <View style={[styles.iconCircle, { backgroundColor: colors.danger + '15' }]}>
                    <Ionicons name="shield-outline" size={48} color={colors.danger} />
                </View>

                <Text style={[styles.title, { color: colors.textPrimary }]}>Access Denied</Text>

                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Your phone number does not have an active invitation. Please contact your manager or agency
                    administrator to request an invite.
                </Text>

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.primaryButton, { backgroundColor: colors.accent }]}
                        onPress={handleSignOut}
                        disabled={isSigningOut}
                    >
                        {isSigningOut ? (
                            <ActivityIndicator color={colors.textInverse} size="small" />
                        ) : (
                            <Text style={[styles.primaryButtonText, { color: colors.textInverse }]}>Sign Out</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.secondaryButton, { borderColor: colors.border }]}
                        onPress={handleRetry}
                        disabled={isRetrying}
                    >
                        {isRetrying ? (
                            <ActivityIndicator color={colors.accent} size="small" />
                        ) : (
                            <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>Try Again</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    iconCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 40,
    },
    actions: {
        width: '100%',
        gap: 12,
    },
    primaryButton: {
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // color applied inline via theme token (colors.textInverse)
    primaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    secondaryButton: {
        height: 50,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    secondaryButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
});
