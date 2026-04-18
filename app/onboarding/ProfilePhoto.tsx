import Avatar from '@/components/Avatar';
import AvatarPickerSheet, { type AvatarAction } from '@/components/profile/AvatarPickerSheet';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { pickAndUploadAvatar, removeAvatar, takeAndUploadAvatar } from '@/lib/storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfilePhotoScreen() {
    const { colors } = useTheme();
    const { user, updateAvatarUrl } = useAuth();
    const router = useRouter();

    const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatar_url ?? null);
    const [showSheet, setShowSheet] = useState(false);
    const [uploading, setUploading] = useState(false);

    const hasAvatar = !!avatarUrl;
    const displayName = user?.full_name || '?';

    const handleAvatarAction = useCallback(
        async (action: AvatarAction) => {
            setShowSheet(false);
            if (!user?.id) return;

            setUploading(true);
            let result: { url?: string | null; error: string | null };

            if (action === 'remove') {
                result = await removeAvatar(user.id);
                if (!result.error) {
                    setAvatarUrl(null);
                    updateAvatarUrl(null);
                }
            } else if (action === 'camera') {
                result = await takeAndUploadAvatar(user.id);
                if (!result.error && result.url) {
                    setAvatarUrl(result.url);
                    updateAvatarUrl(result.url);
                }
            } else {
                result = await pickAndUploadAvatar(user.id);
                if (!result.error && result.url) {
                    setAvatarUrl(result.url);
                    updateAvatarUrl(result.url);
                }
            }

            setUploading(false);
            if (result.error) {
                Alert.alert('Upload Failed', result.error);
            }
        },
        [user?.id, updateAvatarUrl],
    );

    const handleContinue = () => {
        router.push('/onboarding/AgencyInfo');
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.content}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Add a profile photo</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Help your team recognize you</Text>

                {/* Avatar area */}
                <TouchableOpacity
                    style={styles.avatarArea}
                    onPress={() => setShowSheet(true)}
                    activeOpacity={0.7}
                    disabled={uploading}
                    testID="avatar-button"
                >
                    {uploading ? (
                        <View style={[styles.avatarCircle, { backgroundColor: colors.surfacePrimary }]}>
                            <ActivityIndicator size="large" color={colors.accent} />
                        </View>
                    ) : hasAvatar ? (
                        <View>
                            <Avatar
                                name={displayName}
                                avatarUrl={avatarUrl}
                                size={140}
                                backgroundColor={colors.accentLight}
                                textColor={colors.accent}
                            />
                            <View style={[styles.checkBadge, { backgroundColor: colors.success }]}>
                                <Ionicons name="checkmark" size={16} color="#fff" />
                            </View>
                        </View>
                    ) : (
                        <View style={[styles.avatarCircle, styles.dashedBorder, { borderColor: colors.accent }]}>
                            <Avatar
                                name={displayName}
                                size={134}
                                backgroundColor={colors.accentLight}
                                textColor={colors.accent}
                            />
                        </View>
                    )}

                    {!uploading && (
                        <View style={styles.tapHint}>
                            <Ionicons
                                name={hasAvatar ? 'swap-horizontal-outline' : 'camera-outline'}
                                size={16}
                                color={hasAvatar ? colors.textSecondary : colors.accent}
                            />
                            <Text
                                style={[
                                    styles.tapHintText,
                                    { color: hasAvatar ? colors.textSecondary : colors.accent },
                                ]}
                            >
                                {hasAvatar ? 'Change photo' : 'Tap to add'}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[
                        styles.button,
                        hasAvatar
                            ? { backgroundColor: colors.accent }
                            : { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.accent },
                    ]}
                    onPress={handleContinue}
                    testID="continue-button"
                >
                    <Text style={[styles.buttonText, { color: hasAvatar ? colors.textInverse : colors.accent }]}>
                        {hasAvatar ? 'Continue' : 'Skip for now'}
                    </Text>
                </TouchableOpacity>
            </View>

            <AvatarPickerSheet
                visible={showSheet}
                colors={colors}
                hasAvatar={hasAvatar}
                onAction={handleAvatarAction}
                onClose={() => setShowSheet(false)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 60,
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 48,
    },
    avatarArea: {
        alignItems: 'center',
    },
    avatarCircle: {
        width: 140,
        height: 140,
        borderRadius: 70,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    dashedBorder: {
        borderWidth: 2,
        borderStyle: 'dashed',
    },
    checkBadge: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tapHint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 16,
    },
    tapHintText: {
        fontSize: 15,
        fontWeight: '600',
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
