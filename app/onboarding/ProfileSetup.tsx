import { KAV_BEHAVIOR, letterSpacing } from '@/constants/platform';
import { Fonts } from '@/constants/type';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Onboarding step 2/5. Ask for the user's full name. */
export default function ProfileSetupScreen() {
    const { colors } = useTheme();
    const { user, refreshUser } = useAuth();
    const router = useRouter();

    const [name, setName] = useState(user?.full_name === 'New User' ? '' : (user?.full_name ?? ''));
    const [error, setError] = useState('');
    const [focused, setFocused] = useState(false);

    const handleContinue = async () => {
        if (!name.trim()) {
            setError('Please enter your name');
            return;
        }
        setError('');

        if (user?.id) {
            await supabase.from('users').update({ full_name: name.trim() }).eq('id', user.id);
            await refreshUser();
        }

        router.push('/onboarding/ProfilePhoto');
    };

    // Focus state border: accent when focused, danger if error, border otherwise
    const inputBorderColor = error ? colors.danger : focused ? colors.accent : colors.inputBorder;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <KeyboardAvoidingView style={styles.flex} behavior={KAV_BEHAVIOR}>
                <ScrollView
                    style={styles.flex}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <Animated.View entering={FadeInDown.springify().duration(500)}>
                        <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>STEP 2 OF 5</Text>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>
                            Your <Text style={[styles.titleItalic, { color: colors.accent }]}>name</Text>, please.
                        </Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            This is how your team will see you.
                        </Text>
                    </Animated.View>

                    <Animated.View style={styles.inputBlock} entering={FadeInDown.delay(120).springify().duration(500)}>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: colors.inputBackground,
                                    borderColor: inputBorderColor,
                                    color: colors.textPrimary,
                                },
                            ]}
                            value={name}
                            onChangeText={(text) => {
                                setName(text);
                                if (error) setError('');
                            }}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            placeholder="e.g. Sarah Lim"
                            placeholderTextColor={colors.textTertiary}
                            autoFocus
                            autoCapitalize="words"
                            returnKeyType="done"
                            onSubmitEditing={handleContinue}
                            testID="name-input"
                        />
                        {error ? <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}
                    </Animated.View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: colors.accent }]}
                        onPress={handleContinue}
                        activeOpacity={0.85}
                        testID="continue-button"
                    >
                        <Text style={[styles.buttonText, { color: colors.textInverse }]}>Continue</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    flex: { flex: 1 },
    scrollContent: {
        paddingLeft: 24,
        paddingRight: 32,
        paddingTop: 24,
        paddingBottom: 24,
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
        marginBottom: 36,
    },
    inputBlock: {
        marginTop: 0,
    },
    input: {
        fontFamily: Fonts.sans,
        borderWidth: 1.5,
        borderRadius: 14,
        paddingHorizontal: 18,
        paddingVertical: 16,
        fontSize: 17,
    },
    errorText: {
        fontFamily: Fonts.sans,
        fontSize: 13,
        marginTop: 8,
        marginLeft: 4,
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 32,
        paddingTop: 12,
    },
    button: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 14,
    },
    buttonText: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 17,
        fontWeight: '600',
    },
});
