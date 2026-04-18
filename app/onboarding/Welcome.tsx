import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
    const { colors } = useTheme();
    const router = useRouter();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.content}>
                <View style={styles.logoContainer}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                        <Ionicons name="shield-checkmark" size={64} color={colors.accent} />
                    </View>
                </View>

                <Text style={[styles.title, { color: colors.textPrimary }]}>Welcome to Lyfe</Text>

                <Text style={[styles.tagline, { color: colors.textSecondary }]}>Your insurance career starts here</Text>

                <View style={styles.spacer} />

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.accent }]}
                    onPress={() => router.push('/onboarding/ProfileSetup')}
                    testID="get-started-button"
                >
                    <Text style={[styles.buttonText, { color: colors.textInverse }]}>Get Started</Text>
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
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    logoContainer: {
        marginBottom: 32,
    },
    iconCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        marginBottom: 12,
    },
    tagline: {
        fontSize: 18,
        textAlign: 'center',
        lineHeight: 26,
    },
    spacer: {
        flex: 1,
        minHeight: 40,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 12,
        width: '100%',
        gap: 8,
        marginBottom: 40,
    },
    buttonText: {
        fontSize: 18,
        fontWeight: '600',
    },
});
