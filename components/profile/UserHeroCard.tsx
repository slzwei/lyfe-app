import Avatar from '@/components/Avatar';
import { letterSpacing } from '@/constants/platform';
import { ROLE_LABELS } from '@/constants/ui';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ThemeColors } from '@/types/theme';

interface UserHeroCardProps {
    colors: ThemeColors;
    fullName: string | undefined;
    role: string | undefined;
    phone: string | null | undefined;
    email: string | null | undefined;
    avatarUrl: string | null | undefined;
    avatarUploading: boolean;
    onAvatarPress: () => void;
    testID?: string;
}

export default function UserHeroCard({
    colors,
    fullName,
    role,
    phone,
    email,
    avatarUrl,
    avatarUploading,
    onAvatarPress,
    testID,
}: UserHeroCardProps) {
    return (
        <View
            testID={testID}
            style={[
                styles.card,
                styles.userCard,
                { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary },
            ]}
        >
            <View style={styles.userCardRow}>
                {/* Avatar -- tappable */}
                <TouchableOpacity
                    onPress={onAvatarPress}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Change profile photo"
                    style={[styles.avatarOuter, { borderColor: colors.accent + '30' }]}
                >
                    {avatarUploading ? (
                        <View style={[styles.avatarCircle, { backgroundColor: colors.accentLight }]}>
                            <ActivityIndicator color={colors.accent} />
                        </View>
                    ) : (
                        <Avatar
                            name={fullName || '?'}
                            avatarUrl={avatarUrl}
                            size={66}
                            backgroundColor={colors.accentLight}
                            textColor={colors.accent}
                        />
                    )}
                    <View
                        style={[
                            styles.avatarEditBadge,
                            { backgroundColor: colors.accent, borderColor: colors.cardBackground },
                        ]}
                    >
                        <Ionicons name="camera" size={10} color={colors.textInverse} />
                    </View>
                </TouchableOpacity>

                {/* User Info */}
                <View style={styles.userInfo}>
                    <Text
                        testID={testID ? `${testID}-name` : undefined}
                        style={[styles.userName, { color: colors.textPrimary }]}
                        numberOfLines={1}
                    >
                        {fullName || 'Unknown User'}
                    </Text>
                    <View style={[styles.roleBadge, { backgroundColor: colors.accentLight }]}>
                        <Text style={[styles.roleText, { color: colors.accent }]}>{ROLE_LABELS[role || 'agent']}</Text>
                    </View>
                </View>
            </View>

            {/* Contact Info -- inline in user card */}
            <View style={[styles.contactDivider, { backgroundColor: colors.border }]} />
            <View style={styles.contactSection}>
                {phone && (
                    <View style={styles.contactRow}>
                        <Ionicons name="call-outline" size={16} color={colors.textTertiary} />
                        <Text style={[styles.contactText, { color: colors.textSecondary }]}>{phone}</Text>
                    </View>
                )}
                {email && (
                    <View style={styles.contactRow}>
                        <Ionicons name="mail-outline" size={16} color={colors.textTertiary} />
                        <Text style={[styles.contactText, { color: colors.textSecondary }]}>{email}</Text>
                    </View>
                )}
            </View>
        </View>
    );
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
    userCard: {
        padding: 20,
    },
    userCardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    avatarOuter: {
        width: 76,
        height: 76,
        borderRadius: 38,
        borderWidth: 2.5,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    avatarCircle: {
        width: 66,
        height: 66,
        borderRadius: 33,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarEditBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
    },
    userInfo: {
        flex: 1,
        gap: 8,
    },
    userName: {
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: letterSpacing(-0.3),
    },
    roleBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    roleText: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    contactDivider: {
        height: StyleSheet.hairlineWidth,
        marginTop: 16,
        marginBottom: 12,
    },
    contactSection: {
        gap: 8,
    },
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    contactText: {
        fontSize: 14,
    },
});
