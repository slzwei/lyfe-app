import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
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
            setError('Name is required');
            return;
        }
        setError('');

        if (user?.id) {
            await supabase.from('users').update({ full_name: name.trim() }).eq('id', user.id);
            await refreshUser();
        }

        router.push('/onboarding/AgencyInfo');
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView
                    style={styles.flex}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Set Up Your Profile</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Tell us a bit about yourself</Text>

                    {/* Profile Photo Placeholder */}
                    <TouchableOpacity
                        style={[styles.photoPlaceholder, { backgroundColor: colors.surfacePrimary }]}
                        testID="photo-placeholder"
                    >
                        <Ionicons name="camera-outline" size={32} color={colors.textTertiary} />
                        <Text style={[styles.photoText, { color: colors.textTertiary }]}>Add Photo</Text>
                    </TouchableOpacity>

                    {/* Name Field */}
                    <View style={styles.fieldContainer}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Full Name</Text>
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
                            onChangeText={setName}
                            placeholder="Enter your full name"
                            placeholderTextColor={colors.textTertiary}
                            testID="name-input"
                        />
                        {error ? <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}
                    </View>

                    {/* Phone Field (read-only) */}
                    <View style={styles.fieldContainer}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Phone Number</Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: colors.surfaceSecondary,
                                    borderColor: colors.inputBorder,
                                    color: colors.textTertiary,
                                },
                            ]}
                            value={user?.phone ?? ''}
                            editable={false}
                            testID="phone-input"
                        />
                    </View>
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
        paddingTop: 48,
        paddingBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        marginBottom: 32,
    },
    photoPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 32,
    },
    photoText: {
        fontSize: 12,
        marginTop: 4,
    },
    fieldContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
    },
    errorText: {
        fontSize: 13,
        marginTop: 4,
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
