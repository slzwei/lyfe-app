import Avatar from '@/components/Avatar';
import { KAV_BEHAVIOR, MODAL_ANIM_SHEET, MODAL_STATUS_BAR_TRANSLUCENT } from '@/constants/platform';
import { ATTENDEE_ROLES, getAvatarColor } from '@/constants/ui';
import { useTheme } from '@/contexts/ThemeContext';
import type { SelectedAttendee } from '@/hooks/useAttendeePicker';
import type { SimpleUser } from '@/lib/events';
import type { AttendeeRole, ExternalAttendee } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export interface AttendeePickerModalProps {
    visible: boolean;
    onClose: () => void;
    pickerTab: 'team' | 'external';
    onTabChange: (tab: 'team' | 'external') => void;
    /* Team tab */
    userSearch: string;
    onUserSearchChange: (v: string) => void;
    loadingUsers: boolean;
    usersError: string | null;
    filteredUsers: SimpleUser[];
    selectedAttendees: SelectedAttendee[];
    onToggleAttendee: (u: SimpleUser) => void;
    onRetryLoadUsers: () => void;
    /* External tab */
    externalName: string;
    onExternalNameChange: (v: string) => void;
    externalRole: AttendeeRole;
    onExternalRoleChange: (r: AttendeeRole) => void;
    externalAttendees: (ExternalAttendee & { _key: string })[];
    onAddExternal: () => void;
    onRemoveExternal: (key: string) => void;
}

export default function AttendeePickerModal({
    visible,
    onClose,
    pickerTab,
    onTabChange,
    userSearch,
    onUserSearchChange,
    loadingUsers,
    usersError,
    filteredUsers,
    selectedAttendees,
    onToggleAttendee,
    onRetryLoadUsers,
    externalName,
    onExternalNameChange,
    externalRole,
    onExternalRoleChange,
    externalAttendees,
    onAddExternal,
    onRemoveExternal,
}: AttendeePickerModalProps) {
    const { colors } = useTheme();

    return (
        <Modal
            visible={visible}
            animationType={MODAL_ANIM_SHEET}
            statusBarTranslucent={MODAL_STATUS_BAR_TRANSLUCENT}
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <SafeAreaView style={[styles.pickerScreen, { backgroundColor: colors.background }]}>
                <View style={[styles.pickerSheetHeader, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.pickerSheetTitle, { color: colors.textPrimary }]}>Add Attendees</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Text style={[styles.pickerDone, { color: colors.accent }]}>Done</Text>
                    </TouchableOpacity>
                </View>

                {/* Tabs */}
                <View style={[styles.pickerTabs, { borderBottomColor: colors.border }]}>
                    {(['team', 'external'] as const).map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            style={[
                                styles.pickerTab,
                                pickerTab === tab && { borderBottomColor: colors.accent, borderBottomWidth: 2 },
                            ]}
                            onPress={() => onTabChange(tab)}
                        >
                            <Text
                                style={[
                                    styles.pickerTabText,
                                    { color: pickerTab === tab ? colors.accent : colors.textSecondary },
                                ]}
                            >
                                {tab === 'team' ? 'Team' : 'External'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {pickerTab === 'team' ? (
                    <TeamTab
                        colors={colors}
                        userSearch={userSearch}
                        onUserSearchChange={onUserSearchChange}
                        loadingUsers={loadingUsers}
                        usersError={usersError}
                        filteredUsers={filteredUsers}
                        selectedAttendees={selectedAttendees}
                        onToggleAttendee={onToggleAttendee}
                        onRetryLoadUsers={onRetryLoadUsers}
                    />
                ) : (
                    <ExternalTab
                        colors={colors}
                        externalName={externalName}
                        onExternalNameChange={onExternalNameChange}
                        externalRole={externalRole}
                        onExternalRoleChange={onExternalRoleChange}
                        externalAttendees={externalAttendees}
                        onAddExternal={onAddExternal}
                        onRemoveExternal={onRemoveExternal}
                    />
                )}
            </SafeAreaView>
        </Modal>
    );
}

/* ── Team tab (internal) ─────────────────────────────────── */

interface TeamTabProps {
    colors: ReturnType<typeof useTheme>['colors'];
    userSearch: string;
    onUserSearchChange: (v: string) => void;
    loadingUsers: boolean;
    usersError: string | null;
    filteredUsers: SimpleUser[];
    selectedAttendees: SelectedAttendee[];
    onToggleAttendee: (u: SimpleUser) => void;
    onRetryLoadUsers: () => void;
}

function TeamTab({
    colors,
    userSearch,
    onUserSearchChange,
    loadingUsers,
    usersError,
    filteredUsers,
    selectedAttendees,
    onToggleAttendee,
    onRetryLoadUsers,
}: TeamTabProps) {
    return (
        <>
            <View style={[styles.searchBar, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <Ionicons name="search" size={16} color={colors.textTertiary} />
                <TextInput
                    style={[styles.searchInput, { color: colors.textPrimary }]}
                    placeholder="Search by name or role..."
                    placeholderTextColor={colors.textTertiary}
                    value={userSearch}
                    onChangeText={onUserSearchChange}
                />
            </View>

            {loadingUsers ? (
                <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
            ) : usersError ? (
                <TouchableOpacity
                    style={[styles.retryBtn, { backgroundColor: colors.cardBackground }]}
                    onPress={onRetryLoadUsers}
                >
                    <Ionicons name="refresh" size={20} color={colors.accent} />
                    <Text style={[styles.retryText, { color: colors.accent }]}>{usersError}</Text>
                </TouchableOpacity>
            ) : (
                <FlatList
                    data={filteredUsers}
                    keyExtractor={(u) => u.id}
                    contentContainerStyle={{ padding: 16 }}
                    removeClippedSubviews={true}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    initialNumToRender={10}
                    renderItem={({ item }) => {
                        const isSelected = selectedAttendees.some((a) => a.user_id === item.id);
                        const avatarColor = getAvatarColor(item.full_name);
                        return (
                            <TouchableOpacity
                                style={[
                                    styles.userRow,
                                    {
                                        backgroundColor: isSelected ? colors.accentLight : colors.cardBackground,
                                        borderColor: isSelected ? colors.accent : 'transparent',
                                    },
                                ]}
                                onPress={() => onToggleAttendee(item)}
                                activeOpacity={0.7}
                            >
                                <Avatar
                                    name={item.full_name}
                                    avatarUrl={item.avatar_url}
                                    size={36}
                                    backgroundColor={avatarColor + '18'}
                                    textColor={avatarColor}
                                />
                                <View style={styles.userInfo}>
                                    <Text style={[styles.userName, { color: colors.textPrimary }]}>
                                        {item.full_name}
                                    </Text>
                                    <Text style={[styles.userRole, { color: colors.textTertiary }]}>
                                        {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
                                    </Text>
                                </View>
                                {isSelected && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
                            </TouchableOpacity>
                        );
                    }}
                />
            )}
        </>
    );
}

/* ── External tab (guests) ───────────────────────────────── */

interface ExternalTabProps {
    colors: ReturnType<typeof useTheme>['colors'];
    externalName: string;
    onExternalNameChange: (v: string) => void;
    externalRole: AttendeeRole;
    onExternalRoleChange: (r: AttendeeRole) => void;
    externalAttendees: (ExternalAttendee & { _key: string })[];
    onAddExternal: () => void;
    onRemoveExternal: (key: string) => void;
}

function ExternalTab({
    colors,
    externalName,
    onExternalNameChange,
    externalRole,
    onExternalRoleChange,
    externalAttendees,
    onAddExternal,
    onRemoveExternal,
}: ExternalTabProps) {
    return (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={KAV_BEHAVIOR}>
            <ScrollView contentContainerStyle={styles.externalTab}>
                <Text style={[styles.externalHint, { color: colors.textTertiary }]}>
                    Add guests not in the system — clients, prospects, or external partners.
                </Text>

                <View style={[styles.externalForm, { backgroundColor: colors.cardBackground }]}>
                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: colors.inputBackground,
                                borderColor: colors.inputBorder,
                                color: colors.textPrimary,
                            },
                        ]}
                        placeholder="Full name"
                        placeholderTextColor={colors.textTertiary}
                        value={externalName}
                        onChangeText={onExternalNameChange}
                        returnKeyType="done"
                    />
                    <View style={styles.roleRow}>
                        {ATTENDEE_ROLES.map((r) => {
                            const active = externalRole === r.key;
                            return (
                                <TouchableOpacity
                                    key={r.key}
                                    style={[
                                        styles.roleChip,
                                        {
                                            backgroundColor: active ? colors.accent : colors.surfaceSecondary,
                                        },
                                    ]}
                                    onPress={() => onExternalRoleChange(r.key)}
                                >
                                    <Text
                                        style={[
                                            styles.roleChipText,
                                            { color: active ? '#FFFFFF' : colors.textTertiary },
                                        ]}
                                    >
                                        {r.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    <TouchableOpacity
                        style={[
                            styles.externalAddBtn,
                            { backgroundColor: externalName.trim() ? colors.accent : colors.border },
                        ]}
                        disabled={!externalName.trim()}
                        onPress={onAddExternal}
                    >
                        <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.externalAddBtnText}>Add Guest</Text>
                    </TouchableOpacity>
                </View>

                {externalAttendees.length > 0 && (
                    <View style={{ gap: 8, marginTop: 4 }}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Added guests</Text>
                        {externalAttendees.map((a) => {
                            const aColor = getAvatarColor(a.name);
                            return (
                                <View
                                    key={a._key}
                                    style={[
                                        styles.userRow,
                                        { backgroundColor: colors.cardBackground, borderColor: 'transparent' },
                                    ]}
                                >
                                    <Avatar
                                        name={a.name}
                                        avatarUrl={null}
                                        size={36}
                                        backgroundColor={aColor + '18'}
                                        textColor={aColor}
                                    />
                                    <View style={styles.userInfo}>
                                        <Text style={[styles.userName, { color: colors.textPrimary }]}>{a.name}</Text>
                                        <Text style={[styles.userRole, { color: colors.textTertiary }]}>
                                            {ATTENDEE_ROLES.find((r) => r.key === a.attendee_role)?.label ??
                                                a.attendee_role}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => onRemoveExternal(a._key)}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Ionicons name="close-circle" size={22} color={colors.textTertiary} />
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    pickerScreen: { flex: 1 },
    pickerSheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    pickerSheetTitle: { fontSize: 17, fontWeight: '700' },
    pickerDone: { fontSize: 16, fontWeight: '600' },
    pickerTabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
    pickerTab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
    pickerTabText: { fontSize: 14, fontWeight: '600' },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        margin: 16,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    searchInput: { flex: 1, fontSize: 15, padding: 0 },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1.5,
    },
    userInfo: { flex: 1 },
    userName: { fontSize: 15, fontWeight: '600' },
    userRole: { fontSize: 12, marginTop: 1 },
    retryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        margin: 32,
        borderRadius: 12,
        padding: 16,
    },
    retryText: { fontSize: 14, fontWeight: '600' },
    label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
    roleRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    roleChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    roleChipText: { fontSize: 11, fontWeight: '600' },
    externalTab: { padding: 16, gap: 16 },
    externalHint: { fontSize: 13, lineHeight: 19 },
    externalForm: { borderRadius: 12, padding: 14, gap: 12 },
    externalAddBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 10,
        paddingVertical: 11,
    },
    externalAddBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
