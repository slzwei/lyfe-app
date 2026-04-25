import { letterSpacing } from '@/constants/platform';
import { Fonts } from '@/constants/type';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Onboarding step 5/5 — the celebration beat. Warm-but-not-loud per design context:
 * terracotta accents (not sage), spring entrance, no confetti. The "consistent
 * playful + celebratory" register lives here.
 */
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
        if (user?.id) {
            await supabase.from('users').update({ onboarding_complete: true }).eq('id', user.id);
            await refreshUser();
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <View style={styles.contentWrap}>
                <Animated.View entering={FadeInDown.springify().duration(500)}>
                    <Text style={[styles.eyebrow, { color: colors.accent }]}>ALL SET</Text>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                        You're <Text style={[styles.titleItalic, { color: colors.accent }]}>in.</Text>
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Welcome to Lyfe. Let's get to work.
                    </Text>
                </Animated.View>

                {/* Celebratory hero — accent-tinted circle with trophy, asymmetric left-anchor. */}
                <Animated.View style={styles.heroBlock} entering={FadeIn.delay(250).duration(700)}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                        <Ionicons name="sparkles" size={56} color={colors.accent} />
                    </View>
                </Animated.View>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.accent }]}
                    onPress={handleGoToDashboard}
                    activeOpacity={0.85}
                    testID="go-to-dashboard-button"
                >
                    <Text style={[styles.buttonText, { color: colors.textInverse }]}>Go to dashboard</Text>
                    <Ionicons name="arrow-forward" size={20} color={colors.textInverse} />
                </TouchableOpacity>

                <Text style={[styles.redirectText, { color: colors.textTertiary }]}>Redirecting automatically…</Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    contentWrap: {
        flex: 1,
        paddingLeft: 24,
        paddingRight: 32,
        paddingTop: 24,
    },
    eyebrow: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 20,
    },
    title: {
        fontFamily: Fonts.sansBold,
        fontSize: 32,
        fontWeight: '700',
        lineHeight: 38,
        letterSpacing: letterSpacing(-0.5),
        marginBottom: 10,
    },
    titleItalic: {
        fontFamily: Fonts.serifItalic,
        fontWeight: '500',
    },
    subtitle: {
        fontFamily: Fonts.sans,
        fontSize: 16,
        lineHeight: 24,
        maxWidth: 440,
    },
    heroBlock: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingLeft: 32, // asymmetric indent — more than other screens, adds rhythm variation
    },
    iconCircle: {
        width: 112,
        height: 112,
        borderRadius: 56,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 32,
        paddingTop: 12,
        alignItems: 'center',
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 14,
        width: '100%',
        gap: 8,
    },
    buttonText: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 17,
        fontWeight: '600',
    },
    redirectText: {
        fontFamily: Fonts.sans,
        fontSize: 13,
        marginTop: 16,
    },
});
