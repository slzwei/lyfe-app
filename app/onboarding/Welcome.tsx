import { letterSpacing } from '@/constants/platform';
import { Fonts } from '@/constants/type';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Onboarding step 1 / 5. Sets the editorial tone for the whole flow.
 *
 * Layout pattern (shared across all onboarding screens):
 *   - Eyebrow step counter (top-left, warm grey caps)
 *   - Left-anchored title with ONE italic serif accent word
 *   - Subtitle with maxWidth for readability
 *   - Hero visual block centered in the remaining space
 *   - Footer-anchored primary CTA
 *   - FadeInDown spring entrance on hero + delayed fade-in on content
 */
export default function WelcomeScreen() {
    const { colors } = useTheme();
    const router = useRouter();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <View style={styles.contentWrap}>
                <Animated.View entering={FadeInDown.springify().duration(500)}>
                    <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>STEP 1 OF 5</Text>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                        Welcome to <Text style={[styles.titleItalic, { color: colors.accent }]}>Lyfe.</Text>
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Your insurance career starts here — with the tools, training, and team to back you up.
                    </Text>
                </Animated.View>

                {/* Hero visual — left-anchored to align with title */}
                <Animated.View style={styles.heroBlock} entering={FadeInDown.delay(120).springify().duration(600)}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                        <Ionicons name="shield-checkmark" size={64} color={colors.accent} />
                    </View>
                </Animated.View>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.accent }]}
                    onPress={() => router.push('/onboarding/ProfileSetup')}
                    activeOpacity={0.85}
                    testID="get-started-button"
                >
                    <Text style={[styles.buttonText, { color: colors.textInverse }]}>Get started</Text>
                    <Ionicons name="arrow-forward" size={20} color={colors.textInverse} />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentWrap: {
        flex: 1,
        paddingLeft: 24,
        paddingRight: 24,
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
        marginBottom: 12,
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
    },
    iconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 32,
        paddingTop: 12,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 14,
        gap: 8,
    },
    buttonText: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 17,
        fontWeight: '600',
    },
});
