import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function ProfileSetupScreen() {
    const { colors } = useTheme();
    const { user, refreshUser } = useAuth();
    const router = useRouter();

    const [name, setName] = useState(user?.full_name === 'New User' ? '' : (user?.full_name ?? ''));
    const [error, setError] = useState('');

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

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView
                    style={styles.flex}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text style={[styles.title, { color: colors.textPrimary }]}>What's your name?</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        This is how your team will see you
                    </Text>

                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: colors.inputBackground,
                                borderColor: error ? colors.danger : colors.inputBorder,
                                color: colors.textPrimary,
                            },
                        ]}
                        value={name}
                        onChangeText={(text) => {
                            setName(text);
                            if (error) setError('');
                        }}
                        placeholder="Full name"
                        placeholderTextColor={colors.textTertiary}
                        autoFocus
                        autoCapitalize="words"
                        returnKeyType="done"
                        onSubmitEditing={handleContinue}
                        testID="name-input"
                    />
                    {error ? <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: colors.accent }]}
                        onPress={handleContinue}
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
    container: {
        flex: 1,
    },
    flex: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        marginBottom: 36,
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 16,
        fontSize: 18,
    },
    errorText: {
        fontSize: 13,
        marginTop: 6,
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
        borderRadius: 12,
    },
    buttonText: {
        fontSize: 18,
        fontWeight: '600',
    },
});
