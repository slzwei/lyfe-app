import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function OnboardingCompleteScreen() {
    const { colors } = useTheme();
    const { user, refreshUser } = useAuth();
    const router = useRouter();
    const hasMarkedComplete = useRef(false);

    useEffect(() => {
        const markComplete = async () => {
            if (hasMarkedComplete.current || !user?.id) return;
            hasMarkedComplete.current = true;

            await supabase.from('users').update({ onboarding_complete: true }).eq('id', user.id);
            await refreshUser();
        };

        markComplete();
    }, [user?.id, refreshUser]);

    // Navigate only after local state confirms onboarding is complete
    useEffect(() => {
        if (user?.onboarding_complete !== true) return;

        const timer = setTimeout(() => {
            router.replace('/(tabs)/home');
        }, 2000);

        return () => clearTimeout(timer);
    }, [user?.onboarding_complete, router]);

    const handleGoToDashboard = async () => {
        if (user?.onboarding_complete === true) {
            router.replace('/(tabs)/home');
            return;
        }
        // If the effect hasn't finished yet, do it now
        if (user?.id) {
            await supabase.from('users').update({ onboarding_complete: true }).eq('id', user.id);
            await refreshUser();
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.content}>
                <View style={[styles.iconCircle, { backgroundColor: colors.successLight }]}>
                    <Ionicons name="trophy-outline" size={64} color={colors.success} />
                </View>

                <Text style={[styles.title, { color: colors.textPrimary }]}>You're all set!</Text>

                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Your onboarding is complete. Welcome to Lyfe.
                </Text>

                <View style={styles.spacer} />

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.accent }]}
                    onPress={handleGoToDashboard}
                    testID="go-to-dashboard-button"
                >
                    <Text style={[styles.buttonText, { color: colors.textInverse }]}>Go to Dashboard</Text>
                </TouchableOpacity>

                <Text style={[styles.redirectText, { color: colors.textTertiary }]}>Redirecting automatically...</Text>
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
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    iconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 18,
        textAlign: 'center',
        lineHeight: 26,
    },
    spacer: {
        flex: 1,
        minHeight: 40,
    },
    button: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: '100%',
        marginBottom: 16,
    },
    buttonText: {
        fontSize: 18,
        fontWeight: '600',
    },
    redirectText: {
        fontSize: 14,
        marginBottom: 40,
    },
});
