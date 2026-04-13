import { useAuth } from '@/contexts/AuthContext';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface FaceIdCardProps {
    colors: ThemeColors;
    testID?: string;
}

/**
 * Profile card that surfaces face registration state and lets users set up
 * or re-register their face reference. Tapping the whole card navigates to
 * the production face-register screen (app/(tabs)/profile/face-register.tsx),
 * which wraps FaceCaptureFlow and calls registerFace on success.
 *
 * Reads face_registered_at off the user object — that field is populated by
 * the verify-face edge function's register action and optimistically updated
 * by the register screen via AuthContext.updateFaceRegisteredAt.
 */
export default function FaceIdCard({ colors, testID }: FaceIdCardProps) {
    const { user } = useAuth();
    const router = useRouter();

    const registeredAt = user?.face_registered_at ?? null;
    const isRegistered = !!registeredAt;

    const handlePress = useCallback(() => {
        router.push('/(tabs)/profile/face-register' as never);
    }, [router]);

    const subtitle = isRegistered ? `Registered ${formatRegisteredAt(registeredAt)}` : 'Not set up — tap to register';

    return (
        <View
            testID={testID}
            style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}
        >
            <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>FACE ID</Text>
            <Pressable
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                onPress={handlePress}
                accessibilityRole="button"
                accessibilityLabel={isRegistered ? 'Re-register Face ID' : 'Set up Face ID'}
                accessibilityHint="Opens the face registration camera"
            >
                <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                    <Ionicons name="scan" size={18} color={colors.accent} />
                </View>
                <View style={styles.textCol}>
                    <Text style={[styles.label, { color: colors.textPrimary }]}>Face ID</Text>
                    <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{subtitle}</Text>
                </View>
                {isRegistered ? (
                    <View style={[styles.statusPill, { backgroundColor: '#34C75920' }]}>
                        <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                        <Text style={[styles.statusPillText, { color: '#34C759' }]}>Active</Text>
                    </View>
                ) : (
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                )}
            </Pressable>
        </View>
    );
}

function formatRegisteredAt(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
        return '';
    }
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 16,
        padding: 16,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
    },
    sectionLabel: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.8,
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 12,
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textCol: { flex: 1 },
    label: { fontSize: 15, fontWeight: '500' },
    subtitle: { fontSize: 12, marginTop: 1 },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusPillText: {
        fontSize: 12,
        fontWeight: '600',
    },
});
