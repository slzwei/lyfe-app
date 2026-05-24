import Avatar from '@/components/Avatar';
import AvatarPickerSheet, { type AvatarAction } from '@/components/profile/AvatarPickerSheet';
import { letterSpacing } from '@/constants/platform';
import { Fonts } from '@/constants/type';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { pickAndUploadAvatar, removeAvatar, takeAndUploadAvatar } from '@/lib/storage';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Onboarding step 3/5. Upload or skip a profile photo. */
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
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
            <View style={styles.contentWrap}>
                <Animated.View entering={FadeInDown.springify().duration(500)}>
                    <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>STEP 3 OF 5</Text>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                        A <Text style={[styles.titleItalic, { color: colors.accent }]}>photo</Text> for your team.
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Help your team recognise you at a glance.
                    </Text>
                </Animated.View>

                {/* Avatar visual — left-anchored to align with title */}
                <Animated.View style={styles.heroBlock} entering={FadeInDown.delay(120).springify().duration(600)}>
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
                                    <Ionicons name="checkmark" size={16} color={colors.textInverse} />
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

                        <View style={styles.tapHint}>
                            <Ionicons
                                name={
                                    uploading
                                        ? 'cloud-upload-outline'
                                        : hasAvatar
                                          ? 'swap-horizontal-outline'
                                          : 'camera-outline'
                                }
                                size={16}
                                color={hasAvatar ? colors.textSecondary : colors.accent}
                            />
                            <Text
                                style={[
                                    styles.tapHintText,
                                    { color: hasAvatar ? colors.textSecondary : colors.accent },
                                ]}
                            >
                                {uploading ? 'Uploading…' : hasAvatar ? 'Change photo' : 'Tap to add'}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </Animated.View>
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
                    activeOpacity={0.85}
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
    container: { flex: 1 },
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
        fontFamily: Fonts.sansSemibold,
        fontSize: 14,
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
        borderRadius: 14,
    },
    buttonText: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 17,
        fontWeight: '600',
    },
});
