/**
 * Hook encapsulating attendee selection state for event creation.
 * Manages team member list, search, external attendees, and role assignment.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAllUsers, type SimpleUser } from '@/lib/events';
import type { AttendeeRole, ExternalAttendee } from '@/types/event';

export interface SelectedAttendee {
    user_id: string;
    full_name: string;
    role: string;
    attendee_role: AttendeeRole;
    avatar_url?: string | null;
}

interface AttendeePickerState {
    selectedAttendees: SelectedAttendee[];
    setSelectedAttendees: React.Dispatch<React.SetStateAction<SelectedAttendee[]>>;
    showAttendeePicker: boolean;
    setShowAttendeePicker: (v: boolean) => void;
    pickerTab: 'team' | 'external';
    setPickerTab: (v: 'team' | 'external') => void;
    allUsers: SimpleUser[];
    userSearch: string;
    setUserSearch: (v: string) => void;
    loadingUsers: boolean;
    usersError: string | null;
    filteredUsers: SimpleUser[];
    externalAttendees: (ExternalAttendee & { _key: string })[];
    setExternalAttendees: React.Dispatch<React.SetStateAction<(ExternalAttendee & { _key: string })[]>>;
    externalName: string;
    setExternalName: (v: string) => void;
    externalRole: AttendeeRole;
    setExternalRole: (v: AttendeeRole) => void;
    loadUsers: () => Promise<void>;
    toggleAttendee: (u: SimpleUser) => void;
    updateAttendeeRole: (userId: string, role: AttendeeRole) => void;
    addExternal: () => void;
    removeExternal: (key: string) => void;
}

export function useAttendeePicker(): AttendeePickerState {
    const [selectedAttendees, setSelectedAttendees] = useState<SelectedAttendee[]>([]);
    const [showAttendeePicker, setShowAttendeePicker] = useState(false);
    const [pickerTab, setPickerTab] = useState<'team' | 'external'>('team');
    const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [usersError, setUsersError] = useState<string | null>(null);
    const [externalAttendees, setExternalAttendees] = useState<(ExternalAttendee & { _key: string })[]>([]);
    const [externalName, setExternalName] = useState('');
    const [externalRole, setExternalRole] = useState<AttendeeRole>('attendee');

    const loadUsers = useCallback(async () => {
        setLoadingUsers(true);
        setUsersError(null);
        const { data, error } = await fetchAllUsers();
        if (error) setUsersError('Failed to load users. Tap to retry.');
        setAllUsers(data);
        setLoadingUsers(false);
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const filteredUsers = useMemo(
        () =>
            allUsers.filter(
                (u) =>
                    u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
                    u.role.toLowerCase().includes(userSearch.toLowerCase()),
            ),
        [allUsers, userSearch],
    );

    const toggleAttendee = useCallback((u: SimpleUser) => {
        setSelectedAttendees((prev) => {
            if (prev.find((a) => a.user_id === u.id)) {
                return prev.filter((a) => a.user_id !== u.id);
            }
            return [
                ...prev,
                {
                    user_id: u.id,
                    full_name: u.full_name,
                    role: u.role,
                    attendee_role: 'attendee' as AttendeeRole,
                    avatar_url: u.avatar_url,
                },
            ];
        });
    }, []);

    const updateAttendeeRole = useCallback((userId: string, role: AttendeeRole) => {
        setSelectedAttendees((prev) => prev.map((a) => (a.user_id === userId ? { ...a, attendee_role: role } : a)));
    }, []);

    const addExternal = useCallback(() => {
        if (!externalName.trim()) return;
        setExternalAttendees((prev) => [
            ...prev,
            { _key: `ext_${Date.now()}`, name: externalName.trim(), attendee_role: externalRole },
        ]);
        setExternalName('');
        setExternalRole('attendee');
    }, [externalName, externalRole]);

    const removeExternal = useCallback((key: string) => {
        setExternalAttendees((prev) => prev.filter((a) => a._key !== key));
    }, []);

    return {
        selectedAttendees,
        setSelectedAttendees,
        showAttendeePicker,
        setShowAttendeePicker,
        pickerTab,
        setPickerTab,
        allUsers,
        userSearch,
        setUserSearch,
        loadingUsers,
        usersError,
        filteredUsers,
        externalAttendees,
        setExternalAttendees,
        externalName,
        setExternalName,
        externalRole,
        setExternalRole,
        loadUsers,
        toggleAttendee,
        updateAttendeeRole,
        addExternal,
        removeExternal,
    };
}
