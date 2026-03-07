import Avatar from '@/components/Avatar';
import ScreenHeader from '@/components/ScreenHeader';
import WheelPicker, { WHEEL_ITEM_H } from '@/components/WheelPicker';
import { ATTENDEE_ROLES, AVATAR_COLORS, getAvatarColor, formatPickerTime, hhmm24ToPickerState, PICKER_AMPM, PICKER_HOURS, PICKER_MINUTES, pickerToHHMM24, TIME_PICKER_VISIBLE } from '@/constants/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { dateDiffDays, dateRange, formatDateLabel, isValidDate, todayStr } from '@/lib/dateTime';
import { createEvent, createRoadshowBulk, fetchAllUsers, fetchEventById, fetchRoadshowConfig, saveRoadshowConfig, updateEvent, type RoadshowConfigInput, type SimpleUser } from '@/lib/events';
import { MOCK_USERS } from '@/lib/mockData';
import { supabase } from '@/lib/supabase';
import { isMockMode } from '@/lib/mockMode';
import type { AttendeeRole, CreateEventInput, EventType, ExternalAttendee } from '@/types/event';
import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '@/types/event';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const EVENT_TYPES: EventType[] = ['team_meeting', 'training', 'agency_event', 'roadshow', 'other'];

interface SelectedAttendee {
    user_id: string;
    full_name: string;
    role: string;
    attendee_role: AttendeeRole;
    avatar_url?: string | null;
}

export default function CreateEventScreen() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useRouter();
    const MOCK_OTP = isMockMode();
    const { eventId } = useLocalSearchParams<{ eventId?: string }>();
    const isEditing = !!eventId;

    const [title, setTitle] = useState('');
    const [eventType, setEventType] = useState<EventType>('team_meeting');
    const [eventDate, setEventDate] = useState(todayStr());
    // Start time picker (default 9:00 AM)
    const [startHour, setStartHour] = useState(8);      // index 8 → '9'
    const [startMinIdx, setStartMinIdx] = useState(0);
    const [startAmPm, setStartAmPm] = useState(0);      // 0 = AM
    // End time picker (default 5:00 PM, optional)
    const [hasEndTime, setHasEndTime] = useState(false);
    const [endHour, setEndHour] = useState(4);           // index 4 → '5'
    const [endMinIdx, setEndMinIdx] = useState(0);
    const [endAmPm, setEndAmPm] = useState(1);           // 1 = PM
    const [showTimePicker, setShowTimePicker] = useState<'start' | 'end' | null>(null);
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [selectedAttendees, setSelectedAttendees] = useState<SelectedAttendee[]>([]);
    const [showAttendeePicker, setShowAttendeePicker] = useState(false);
    const [pickerTab, setPickerTab] = useState<'team' | 'external'>('team');
    const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [loadingEvent, setLoadingEvent] = useState(isEditing);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [usersError, setUsersError] = useState<string | null>(null);

    // Roadshow-specific state
    const [rsStartDate, setRsStartDate] = useState(todayStr());
    const [rsEndDate, setRsEndDate] = useState(todayStr());
    const [rsWeeklyCost, setRsWeeklyCost] = useState('');
    const [rsSlots, setRsSlots] = useState(3);
    const [rsGrace, setRsGrace] = useState(15);
    const [rsSitdowns, setRsSitdowns] = useState(5);
    const [rsPitches, setRsPitches] = useState(3);
    const [rsClosed, setRsClosed] = useState(1);
    const [rsConfigLocked, setRsConfigLocked] = useState(false);

    // External (non-user) attendees
    const [externalAttendees, setExternalAttendees] = useState<(ExternalAttendee & { _key: string })[]>([]);
    const [externalName, setExternalName] = useState('');
    const [externalRole, setExternalRole] = useState<AttendeeRole>('attendee');

    const loadUsers = useCallback(async () => {
        setLoadingUsers(true);
        setUsersError(null);
        if (MOCK_OTP) {
            setAllUsers(MOCK_USERS);
            setLoadingUsers(false);
            return;
        }
        const { data, error } = await fetchAllUsers();
        if (error) setUsersError('Failed to load users. Tap to retry.');
        setAllUsers(data);
        setLoadingUsers(false);
    }, []);

    useEffect(() => { loadUsers(); }, [loadUsers]);

    // Supabase returns time as "HH:MM:SS" — strip seconds for the form
    const toHHMM = (t: string | null | undefined) => (t ?? '').slice(0, 5);

    // Pre-populate form when editing
    useEffect(() => {
        if (!isEditing || !eventId) return;

        if (MOCK_OTP) {
            // Use a representative mock event so the edit flow is testable
            setTitle('Agency Kickoff 2026');
            setEventType('agency_event');
            setEventDate(new Date().toISOString().split('T')[0]);
            const sp = hhmm24ToPickerState('09:00');
            setStartHour(sp.hour); setStartMinIdx(sp.minIdx); setStartAmPm(sp.ampm);
            const ep = hhmm24ToPickerState('12:00');
            setEndHour(ep.hour); setEndMinIdx(ep.minIdx); setEndAmPm(ep.ampm);
            setHasEndTime(true);
            setLocation('Marina Bay Sands Convention Centre');
            setDescription('Annual agency kickoff event for all staff.');
            setSelectedAttendees([
                { user_id: 'u1', full_name: 'Alice Tan', role: 'agent', attendee_role: 'attendee' },
                { user_id: 'u2', full_name: 'David Lim', role: 'manager', attendee_role: 'duty_manager' },
            ]);
            setExternalAttendees([
                { _key: 'ext_0', name: 'John Smith (Client)', attendee_role: 'attendee' },
            ]);
            setLoadingEvent(false);
            return;
        }

        fetchEventById(eventId).then(async ({ data }) => {
            if (data) {
                setTitle(data.title);
                setEventType(data.event_type);
                setEventDate(data.event_date);
                const sp = hhmm24ToPickerState(toHHMM(data.start_time) || '09:00');
                setStartHour(sp.hour); setStartMinIdx(sp.minIdx); setStartAmPm(sp.ampm);
                if (data.end_time) {
                    const ep = hhmm24ToPickerState(toHHMM(data.end_time));
                    setEndHour(ep.hour); setEndMinIdx(ep.minIdx); setEndAmPm(ep.ampm);
                    setHasEndTime(true);
                }
                setLocation(data.location || '');
                setDescription(data.description || '');
                setSelectedAttendees(data.attendees.map(a => ({
                    user_id: a.user_id,
                    full_name: a.full_name ?? '',
                    role: '',
                    attendee_role: a.attendee_role,
                    avatar_url: a.avatar_url,
                })));
                setExternalAttendees((data.external_attendees || []).map((a, i) => ({
                    _key: `ext_${i}_${Date.now()}`,
                    name: a.name,
                    attendee_role: a.attendee_role,
                })));

                if (data.event_type === 'roadshow') {
                    const { data: cfg } = await fetchRoadshowConfig(eventId);
                    if (cfg) {
                        setRsWeeklyCost(String(cfg.weekly_cost));
                        setRsSlots(cfg.slots_per_day);
                        setRsGrace(cfg.late_grace_minutes);
                        setRsSitdowns(cfg.suggested_sitdowns);
                        setRsPitches(cfg.suggested_pitches);
                        setRsClosed(cfg.suggested_closed);
                        setRsStartDate(data.event_date);
                        setRsEndDate(data.event_date);
                    }
                    // Lock config if any attendance exists
                    const { data: att } = await supabase.from('roadshow_attendance').select('id').eq('event_id', eventId).limit(1);
                    setRsConfigLocked((att ?? []).length > 0);
                }
            }
            setLoadingEvent(false);
        });
    }, [isEditing, eventId]);

    const toggleAttendee = (u: SimpleUser) => {
        setSelectedAttendees(prev => {
            if (prev.find(a => a.user_id === u.id)) {
                return prev.filter(a => a.user_id !== u.id);
            }
            return [...prev, { user_id: u.id, full_name: u.full_name, role: u.role, attendee_role: 'attendee', avatar_url: u.avatar_url }];
        });
    };

    const updateAttendeeRole = (userId: string, role: AttendeeRole) => {
        setSelectedAttendees(prev =>
            prev.map(a => a.user_id === userId ? { ...a, attendee_role: role } : a)
        );
    };

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!title.trim()) e.title = 'Title is required';
        if (eventType === 'roadshow') {
            if (!isValidDate(rsStartDate)) e.rsStartDate = 'Enter a valid start date (YYYY-MM-DD)';
            if (!isValidDate(rsEndDate)) e.rsEndDate = 'Enter a valid end date (YYYY-MM-DD)';
            if (rsStartDate && rsEndDate && rsEndDate < rsStartDate) e.rsEndDate = 'End date must be on or after start date';
            const dayCount = rsStartDate && rsEndDate ? dateDiffDays(rsStartDate, rsEndDate) + 1 : 0;
            if (dayCount > 31) e.rsEndDate = 'Range cannot exceed 31 days';
            if (!rsWeeklyCost || isNaN(Number(rsWeeklyCost)) || Number(rsWeeklyCost) <= 0) e.rsWeeklyCost = 'Enter a valid weekly cost';
            if (rsSlots < 1) e.rsSlots = 'Slots must be at least 1';
        } else {
            if (!isValidDate(eventDate)) e.eventDate = 'Enter a valid date (YYYY-MM-DD)';
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        const startTime = pickerToHHMM24(startHour, startMinIdx, startAmPm);
        const endTime = hasEndTime ? pickerToHHMM24(endHour, endMinIdx, endAmPm) : null;

        setSubmitting(true);

        if (MOCK_OTP) {
            setSubmitting(false);
            Alert.alert('Success', isEditing ? 'Event updated (mock mode)' : 'Event created (mock mode)', [
                { text: 'OK', onPress: () => router.back() },
            ]);
            return;
        }

        // ── Roadshow bulk create ───────────────────────────────
        if (eventType === 'roadshow' && !isEditing) {
            const dates = dateRange(rsStartDate, rsEndDate);
            const dayCount = dates.length;

            if (dayCount > 14) {
                const confirmed = await new Promise<boolean>(resolve =>
                    Alert.alert(
                        'Large Roadshow',
                        `This will create ${dayCount} events. Continue?`,
                        [{ text: 'Cancel', onPress: () => resolve(false), style: 'cancel' }, { text: 'Create', onPress: () => resolve(true) }],
                    )
                );
                if (!confirmed) { setSubmitting(false); return; }
            }

            const rsConfig: RoadshowConfigInput = {
                weekly_cost: Number(rsWeeklyCost),
                slots_per_day: rsSlots,
                expected_start_time: startTime,
                late_grace_minutes: rsGrace,
                suggested_sitdowns: rsSitdowns,
                suggested_pitches: rsPitches,
                suggested_closed: rsClosed,
            };

            const events = dates.map(d => ({
                title: title.trim(),
                event_date: d,
                start_time: startTime,
                end_time: endTime ?? '',
                location: location.trim(),
            }));

            const { error } = await createRoadshowBulk(
                events,
                rsConfig,
                selectedAttendees.map(a => ({ user_id: a.user_id, attendee_role: a.attendee_role })),
                user!.id,
            );
            setSubmitting(false);
            if (error) {
                setErrors(e => ({ ...e, _submit: error }));
            } else {
                Alert.alert('Created', `${dayCount} roadshow event${dayCount > 1 ? 's' : ''} created.`, [
                    { text: 'OK', onPress: () => router.back() },
                ]);
            }
            return;
        }

        // ── Normal create/edit ─────────────────────────────────
        const input: CreateEventInput = {
            title: title.trim(),
            description: description.trim() || null,
            event_type: eventType,
            event_date: eventDate,
            start_time: startTime,
            end_time: endTime,
            location: location.trim() || null,
            attendees: selectedAttendees.map(a => ({
                user_id: a.user_id,
                attendee_role: a.attendee_role,
            })),
            external_attendees: externalAttendees.map(({ name, attendee_role }) => ({ name, attendee_role })),
        };

        const { error: eventError } = isEditing
            ? await updateEvent(eventId!, input)
            : await createEvent(input, user!.id);

        if (eventError) {
            setSubmitting(false);
            setErrors(e => ({ ...e, _submit: eventError }));
            return;
        }

        // Save roadshow config on edit
        if (eventType === 'roadshow' && isEditing && eventId) {
            const rsConfig: RoadshowConfigInput = {
                weekly_cost: Number(rsWeeklyCost),
                slots_per_day: rsSlots,
                expected_start_time: startTime,
                late_grace_minutes: rsGrace,
                suggested_sitdowns: rsSitdowns,
                suggested_pitches: rsPitches,
                suggested_closed: rsClosed,
            };
            const { error: cfgError } = await saveRoadshowConfig(eventId, rsConfig);
            setSubmitting(false);
            if (cfgError) {
                Alert.alert('Partial Save', 'Event saved, but roadshow config could not be updated. Please try again.');
                return;
            }
        } else {
            setSubmitting(false);
        }

        router.back();
    };

    const filteredUsers = allUsers.filter(u =>
        u.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.role.toLowerCase().includes(userSearch.toLowerCase())
    );

    const inputStyle = [styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.textPrimary }];
    const labelStyle = [styles.label, { color: colors.textSecondary }];

    if (loadingEvent) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <ScreenHeader title="Edit Event" showBack onBack={() => router.back()} />
                <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader
                title={isEditing ? 'Edit Event' : 'Create Event'}
                showBack
                onBack={() => router.back()}
                rightAction={
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={submitting}
                        style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: submitting ? 0.6 : 1 }]}
                    >
                        {submitting
                            ? <ActivityIndicator size="small" color="#FFFFFF" />
                            : <Text style={styles.saveBtnText}>
                                {isEditing ? 'Save' : (eventType === 'roadshow' && !isEditing && rsStartDate && rsEndDate && isValidDate(rsStartDate) && isValidDate(rsEndDate) && rsEndDate >= rsStartDate)
                                    ? `Create ${dateDiffDays(rsStartDate, rsEndDate) + 1}`
                                    : 'Create'}
                              </Text>
                        }
                    </TouchableOpacity>
                }
            />

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* Title */}
                    <View style={styles.field}>
                        <Text style={labelStyle}>Title *</Text>
                        <TextInput
                            style={[inputStyle, errors.title && { borderColor: colors.danger }]}
                            placeholder="Event title"
                            placeholderTextColor={colors.textTertiary}
                            value={title}
                            onChangeText={t => { setTitle(t); setErrors(e => ({ ...e, title: '' })); }}
                        />
                        {errors.title ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.title}</Text> : null}
                    </View>

                    {/* Event Type */}
                    <View style={styles.field}>
                        <Text style={labelStyle}>Event Type *</Text>
                        <View style={styles.typeRow}>
                            {EVENT_TYPES.map(t => {
                                const isActive = eventType === t;
                                const color = EVENT_TYPE_COLORS[t];
                                return (
                                    <TouchableOpacity
                                        key={t}
                                        style={[
                                            styles.typeChip,
                                            {
                                                borderColor: isActive ? color : colors.border,
                                                backgroundColor: isActive ? color + '18' : colors.cardBackground,
                                            },
                                        ]}
                                        onPress={() => setEventType(t)}
                                    >
                                        <Text style={[styles.typeChipText, { color: isActive ? color : colors.textSecondary }]}>
                                            {EVENT_TYPE_LABELS[t]}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Date — single for non-roadshow, date range for roadshow */}
                    {eventType !== 'roadshow' ? (
                        <View style={styles.field}>
                            <Text style={labelStyle}>Date * (YYYY-MM-DD)</Text>
                            <TextInput
                                style={[inputStyle, errors.eventDate && { borderColor: colors.danger }]}
                                placeholder="e.g. 2026-03-15"
                                placeholderTextColor={colors.textTertiary}
                                value={eventDate}
                                onChangeText={v => { setEventDate(v); setErrors(e => ({ ...e, eventDate: '' })); }}
                                keyboardType="numbers-and-punctuation"
                                maxLength={10}
                            />
                            {errors.eventDate ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.eventDate}</Text> : null}
                        </View>
                    ) : (
                        <View style={styles.field}>
                            <Text style={labelStyle}>Date Range *</Text>
                            <View style={styles.timeRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.label, { color: colors.textTertiary, fontSize: 11 }]}>From (YYYY-MM-DD)</Text>
                                    <TextInput
                                        style={[inputStyle, errors.rsStartDate && { borderColor: colors.danger }]}
                                        placeholder="2026-03-09"
                                        placeholderTextColor={colors.textTertiary}
                                        value={rsStartDate}
                                        onChangeText={v => { setRsStartDate(v); setErrors(e => ({ ...e, rsStartDate: '' })); }}
                                        keyboardType="numbers-and-punctuation"
                                        maxLength={10}
                                    />
                                    {errors.rsStartDate ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.rsStartDate}</Text> : null}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.label, { color: colors.textTertiary, fontSize: 11 }]}>To (YYYY-MM-DD)</Text>
                                    <TextInput
                                        style={[inputStyle, errors.rsEndDate && { borderColor: colors.danger }]}
                                        placeholder="2026-03-15"
                                        placeholderTextColor={colors.textTertiary}
                                        value={rsEndDate}
                                        onChangeText={v => { setRsEndDate(v); setErrors(e => ({ ...e, rsEndDate: '' })); }}
                                        keyboardType="numbers-and-punctuation"
                                        maxLength={10}
                                    />
                                    {errors.rsEndDate ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.rsEndDate}</Text> : null}
                                </View>
                            </View>
                            {rsStartDate && rsEndDate && isValidDate(rsStartDate) && isValidDate(rsEndDate) && rsEndDate >= rsStartDate && (
                                <Text style={[styles.rsPreviewHint, { color: colors.textTertiary }]}>
                                    Creates {dateDiffDays(rsStartDate, rsEndDate) + 1} daily event{dateDiffDays(rsStartDate, rsEndDate) + 1 > 1 ? 's' : ''} · {formatDateLabel(rsStartDate)} – {formatDateLabel(rsEndDate)}
                                </Text>
                            )}
                            {isEditing && (
                                <View style={[styles.editNotice, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Ionicons name="information-circle-outline" size={14} color={colors.textTertiary} />
                                    <Text style={[{ color: colors.textTertiary, fontSize: 12, flex: 1 }]}>Editing this day only. Other days in this campaign are unaffected.</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Roadshow Settings */}
                    {eventType === 'roadshow' && (
                        <View style={[styles.rsSection, { backgroundColor: colors.cardBackground }]}>
                            <Text style={[styles.rsSectionTitle, { color: colors.textPrimary }]}>Roadshow Settings</Text>
                            {rsConfigLocked && (
                                <View style={[styles.rsLockedBanner, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Ionicons name="lock-closed-outline" size={14} color={colors.textTertiary} />
                                    <Text style={[{ color: colors.textTertiary, fontSize: 12, flex: 1 }]}>Config locked — agents have already checked in.</Text>
                                </View>
                            )}
                            <View style={styles.field}>
                                <Text style={labelStyle}>Weekly Cost ($) *</Text>
                                <TextInput
                                    style={[inputStyle, errors.rsWeeklyCost && { borderColor: colors.danger }, rsConfigLocked && { opacity: 0.5 }]}
                                    placeholder="e.g. 1800"
                                    placeholderTextColor={colors.textTertiary}
                                    value={rsWeeklyCost}
                                    onChangeText={v => { setRsWeeklyCost(v.replace(/[^0-9.]/g, '')); setErrors(e => ({ ...e, rsWeeklyCost: '' })); }}
                                    keyboardType="decimal-pad"
                                    editable={!rsConfigLocked}
                                />
                                {errors.rsWeeklyCost ? <Text style={[styles.errorText, { color: colors.danger }]}>{errors.rsWeeklyCost}</Text> : null}
                            </View>
                            <View style={styles.rsStepper}>
                                <Text style={labelStyle}>Agents per slot / day</Text>
                                <View style={styles.rsStepperRow}>
                                    <TouchableOpacity
                                        style={[styles.rsStepBtn, { backgroundColor: colors.surfaceSecondary }]}
                                        onPress={() => setRsSlots(v => Math.max(1, v - 1))}
                                        disabled={rsConfigLocked}
                                        accessibilityLabel="Decrease agents per slot"
                                    >
                                        <Ionicons name="remove" size={18} color={colors.textPrimary} />
                                    </TouchableOpacity>
                                    <Text style={[styles.rsStepValue, { color: colors.textPrimary }]}>{rsSlots}</Text>
                                    <TouchableOpacity
                                        style={[styles.rsStepBtn, { backgroundColor: colors.surfaceSecondary }]}
                                        onPress={() => setRsSlots(v => v + 1)}
                                        disabled={rsConfigLocked}
                                        accessibilityLabel="Increase agents per slot"
                                    >
                                        <Ionicons name="add" size={18} color={colors.textPrimary} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <View style={styles.rsStepper}>
                                <Text style={labelStyle}>Grace period (minutes)</Text>
                                <View style={styles.rsStepperRow}>
                                    <TouchableOpacity
                                        style={[styles.rsStepBtn, { backgroundColor: colors.surfaceSecondary }]}
                                        onPress={() => setRsGrace(v => Math.max(0, v - 5))}
                                        accessibilityLabel="Decrease grace period"
                                    >
                                        <Ionicons name="remove" size={18} color={colors.textPrimary} />
                                    </TouchableOpacity>
                                    <Text style={[styles.rsStepValue, { color: colors.textPrimary }]}>{rsGrace}</Text>
                                    <TouchableOpacity
                                        style={[styles.rsStepBtn, { backgroundColor: colors.surfaceSecondary }]}
                                        onPress={() => setRsGrace(v => v + 5)}
                                        accessibilityLabel="Increase grace period"
                                    >
                                        <Ionicons name="add" size={18} color={colors.textPrimary} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <Text style={[styles.rsSectionTitle, { color: colors.textPrimary, marginTop: 8 }]}>Suggested Daily Targets</Text>
                            {(['sitdowns', 'pitches', 'closed'] as const).map(key => {
                                const labels = { sitdowns: 'Sitdowns', pitches: 'Pitches', closed: 'Cases Closed' };
                                const values = { sitdowns: rsSitdowns, pitches: rsPitches, closed: rsClosed };
                                const setters = { sitdowns: setRsSitdowns, pitches: setRsPitches, closed: setRsClosed };
                                return (
                                    <View key={key} style={styles.rsStepper}>
                                        <Text style={labelStyle}>{labels[key]}</Text>
                                        <View style={styles.rsStepperRow}>
                                            <TouchableOpacity
                                                style={[styles.rsStepBtn, { backgroundColor: colors.surfaceSecondary }]}
                                                onPress={() => setters[key](v => Math.max(0, v - 1))}
                                                accessibilityLabel={`Decrease ${labels[key]} target`}
                                            >
                                                <Ionicons name="remove" size={18} color={colors.textPrimary} />
                                            </TouchableOpacity>
                                            <Text style={[styles.rsStepValue, { color: colors.textPrimary }]}>{values[key]}</Text>
                                            <TouchableOpacity
                                                style={[styles.rsStepBtn, { backgroundColor: colors.surfaceSecondary }]}
                                                onPress={() => setters[key](v => v + 1)}
                                                accessibilityLabel={`Increase ${labels[key]} target`}
                                            >
                                                <Ionicons name="add" size={18} color={colors.textPrimary} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })}

                            {/* Cost preview */}
                            {rsWeeklyCost && !isNaN(Number(rsWeeklyCost)) && Number(rsWeeklyCost) > 0 && (
                                <View style={[styles.rsPreview, { backgroundColor: colors.background }]}>
                                    <Text style={[styles.rsPreviewTitle, { color: colors.textSecondary }]}>Cost Preview</Text>
                                    <View style={styles.rsPreviewRow}>
                                        <Text style={[styles.rsPreviewLabel, { color: colors.textTertiary }]}>Daily cost</Text>
                                        <Text style={[styles.rsPreviewValue, { color: colors.textPrimary }]}>
                                            ${(Number(rsWeeklyCost) / 7).toFixed(2)}
                                        </Text>
                                    </View>
                                    <View style={styles.rsPreviewRow}>
                                        <Text style={[styles.rsPreviewLabel, { color: colors.textTertiary }]}>Per agent / slot</Text>
                                        <Text style={[styles.rsPreviewValue, { color: '#EC4899', fontWeight: '700' }]}>
                                            ${(Number(rsWeeklyCost) / 7 / Math.max(1, rsSlots)).toFixed(2)}
                                        </Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    )}

                    {errors._submit ? (
                        <View style={[styles.submitError, { backgroundColor: '#FEE2E2' }]}>
                            <Text style={{ color: '#DC2626', fontSize: 13 }}>{errors._submit}</Text>
                        </View>
                    ) : null}

                    {/* Time row — tapping either cell opens the picker modal */}
                    <View style={styles.field}>
                        <Text style={labelStyle}>Time *</Text>
                        <View style={[styles.timeRowCard, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                            {/* Start time cell */}
                            <TouchableOpacity
                                style={styles.timeCell}
                                onPress={() => setShowTimePicker('start')}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.timeCellLabel, { color: colors.textTertiary }]}>Start</Text>
                                <Text style={[styles.timeCellValue, { color: colors.textPrimary }]}>
                                    {formatPickerTime(startHour, startMinIdx, startAmPm)}
                                </Text>
                            </TouchableOpacity>

                            <View style={[styles.timeCellDivider, { backgroundColor: colors.border }]} />

                            {/* End time cell */}
                            <TouchableOpacity
                                style={styles.timeCell}
                                onPress={() => { if (!hasEndTime) setHasEndTime(true); setShowTimePicker('end'); }}
                                activeOpacity={0.7}
                            >
                                {hasEndTime ? (
                                    <>
                                        <Text style={[styles.timeCellLabel, { color: colors.textTertiary }]}>End</Text>
                                        <Text style={[styles.timeCellValue, { color: colors.textPrimary }]}>
                                            {formatPickerTime(endHour, endMinIdx, endAmPm)}
                                        </Text>
                                    </>
                                ) : (
                                    <View style={styles.timeCellAdd}>
                                        <Ionicons name="add" size={16} color={colors.accent} />
                                        <Text style={[styles.timeCellAddText, { color: colors.accent }]}>End time</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Location */}
                    <View style={styles.field}>
                        <Text style={labelStyle}>Location</Text>
                        <TextInput
                            style={inputStyle}
                            placeholder="e.g. Zoom, Marina Bay Sands"
                            placeholderTextColor={colors.textTertiary}
                            value={location}
                            onChangeText={setLocation}
                        />
                    </View>

                    {/* Description */}
                    <View style={styles.field}>
                        <Text style={labelStyle}>Description</Text>
                        <TextInput
                            style={[inputStyle, styles.textArea]}
                            placeholder="Optional details..."
                            placeholderTextColor={colors.textTertiary}
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />
                    </View>

                    {/* Attendees */}
                    <View style={styles.field}>
                        <View style={styles.sectionHeader}>
                            <Text style={labelStyle}>
                                Attendees ({selectedAttendees.length + externalAttendees.length})
                            </Text>
                            <TouchableOpacity
                                onPress={() => setShowAttendeePicker(true)}
                                style={[styles.addAttendeeBtn, { borderColor: colors.accent }]}
                            >
                                <Ionicons name="person-add-outline" size={14} color={colors.accent} />
                                <Text style={[styles.addAttendeeBtnText, { color: colors.accent }]}>Add</Text>
                            </TouchableOpacity>
                        </View>

                        {selectedAttendees.length === 0 && externalAttendees.length === 0 ? (
                            <View style={[styles.emptyAttendees, { backgroundColor: colors.cardBackground }]}>
                                <Text style={[styles.emptyAttendeesText, { color: colors.textTertiary }]}>
                                    No attendees selected
                                </Text>
                            </View>
                        ) : (
                            <>
                                {selectedAttendees.map(a => {
                                    const aColor = getAvatarColor(a.full_name);
                                    return (
                                        <View key={a.user_id} style={[styles.attendeeItem, { backgroundColor: colors.cardBackground }]}>
                                            <Avatar
                                                name={a.full_name}
                                                avatarUrl={a.avatar_url}
                                                size={36}
                                                backgroundColor={aColor + '18'}
                                                textColor={aColor}
                                            />
                                            <View style={styles.attendeeItemInfo}>
                                                <Text style={[styles.attendeeName, { color: colors.textPrimary }]}>
                                                    {a.full_name}
                                                </Text>
                                                <View style={styles.roleRow}>
                                                    {ATTENDEE_ROLES.map(r => {
                                                        const active = a.attendee_role === r.key;
                                                        return (
                                                            <TouchableOpacity
                                                                key={r.key}
                                                                style={[
                                                                    styles.roleChip,
                                                                    { backgroundColor: active ? colors.accent : colors.surfaceSecondary },
                                                                ]}
                                                                onPress={() => updateAttendeeRole(a.user_id, r.key)}
                                                            >
                                                                <Text style={[
                                                                    styles.roleChipText,
                                                                    { color: active ? '#FFFFFF' : colors.textTertiary },
                                                                ]}>
                                                                    {r.label}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => setSelectedAttendees(prev => prev.filter(x => x.user_id !== a.user_id))}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                                {externalAttendees.map(a => {
                                    const aColor = getAvatarColor(a.name);
                                    return (
                                        <View key={a._key} style={[styles.attendeeItem, { backgroundColor: colors.cardBackground }]}>
                                            <Avatar
                                                name={a.name}
                                                avatarUrl={null}
                                                size={36}
                                                backgroundColor={aColor + '18'}
                                                textColor={aColor}
                                            />
                                            <View style={styles.attendeeItemInfo}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={[styles.attendeeName, { color: colors.textPrimary }]}>
                                                        {a.name}
                                                    </Text>
                                                    <View style={[styles.guestBadge, { backgroundColor: colors.surfaceSecondary }]}>
                                                        <Text style={[styles.guestBadgeText, { color: colors.textTertiary }]}>Guest</Text>
                                                    </View>
                                                </View>
                                                <View style={styles.roleRow}>
                                                    {ATTENDEE_ROLES.map(r => {
                                                        const active = a.attendee_role === r.key;
                                                        return (
                                                            <TouchableOpacity
                                                                key={r.key}
                                                                style={[
                                                                    styles.roleChip,
                                                                    { backgroundColor: active ? colors.accent : colors.surfaceSecondary },
                                                                ]}
                                                                onPress={() => setExternalAttendees(prev =>
                                                                    prev.map(x => x._key === a._key ? { ...x, attendee_role: r.key } : x)
                                                                )}
                                                            >
                                                                <Text style={[
                                                                    styles.roleChipText,
                                                                    { color: active ? '#FFFFFF' : colors.textTertiary },
                                                                ]}>
                                                                    {r.label}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        );
                                                    })}
                                                </View>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => setExternalAttendees(prev => prev.filter(x => x._key !== a._key))}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                            </>
                        )}
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Time Picker Modal */}
            <Modal
                visible={showTimePicker !== null}
                transparent
                animationType="slide"
                onRequestClose={() => setShowTimePicker(null)}
            >
                <View style={styles.timeModalOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={() => setShowTimePicker(null)} />
                    <View style={[styles.timeModalSheet, { backgroundColor: colors.cardBackground }]}>
                        <View style={[styles.timeModalHandle, { backgroundColor: colors.border }]} />
                        <View style={styles.timeModalHeader}>
                            <Text style={[styles.timeModalTitle, { color: colors.textPrimary }]}>
                                {showTimePicker === 'start' ? 'Start Time' : 'End Time'}
                            </Text>
                            <View style={styles.timeModalActions}>
                                {showTimePicker === 'end' && hasEndTime && (
                                    <TouchableOpacity
                                        onPress={() => { setHasEndTime(false); setShowTimePicker(null); }}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Text style={{ fontSize: 15, color: colors.danger }}>Remove</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={() => setShowTimePicker(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.accent }}>Done</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        {/* Picker */}
                        <View style={[styles.timePickerContainer, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, marginHorizontal: 16, marginBottom: 16 }]}>
                            <View pointerEvents="none" style={[styles.timePickerBand, { borderColor: colors.border }]} />
                            <View style={styles.timePickerWheels}>
                                {showTimePicker === 'start' ? (
                                    <>
                                        <WheelPicker items={PICKER_HOURS} selectedIndex={startHour} onChange={setStartHour} colors={colors} width={60} showIndicator={false} visibleItems={TIME_PICKER_VISIBLE} />
                                        <View style={styles.timePickerColon}><Text style={[styles.timeColonText, { color: colors.textPrimary }]}>:</Text></View>
                                        <WheelPicker items={PICKER_MINUTES} selectedIndex={startMinIdx} onChange={setStartMinIdx} colors={colors} width={60} showIndicator={false} visibleItems={TIME_PICKER_VISIBLE} />
                                        <View style={{ flex: 1 }} />
                                        <WheelPicker items={PICKER_AMPM} selectedIndex={startAmPm} onChange={setStartAmPm} colors={colors} width={70} showIndicator={false} visibleItems={TIME_PICKER_VISIBLE} />
                                    </>
                                ) : (
                                    <>
                                        <WheelPicker items={PICKER_HOURS} selectedIndex={endHour} onChange={setEndHour} colors={colors} width={60} showIndicator={false} visibleItems={TIME_PICKER_VISIBLE} />
                                        <View style={styles.timePickerColon}><Text style={[styles.timeColonText, { color: colors.textPrimary }]}>:</Text></View>
                                        <WheelPicker items={PICKER_MINUTES} selectedIndex={endMinIdx} onChange={setEndMinIdx} colors={colors} width={60} showIndicator={false} visibleItems={TIME_PICKER_VISIBLE} />
                                        <View style={{ flex: 1 }} />
                                        <WheelPicker items={PICKER_AMPM} selectedIndex={endAmPm} onChange={setEndAmPm} colors={colors} width={70} showIndicator={false} visibleItems={TIME_PICKER_VISIBLE} />
                                    </>
                                )}
                            </View>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Attendee Picker Modal */}
            <Modal
                visible={showAttendeePicker}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => { setShowAttendeePicker(false); setUserSearch(''); setExternalName(''); }}
            >
                <SafeAreaView style={[styles.pickerScreen, { backgroundColor: colors.background }]}>
                    <View style={[styles.pickerSheetHeader, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.pickerSheetTitle, { color: colors.textPrimary }]}>Add Attendees</Text>
                        <TouchableOpacity onPress={() => { setShowAttendeePicker(false); setUserSearch(''); setExternalName(''); }}>
                            <Text style={[styles.pickerDone, { color: colors.accent }]}>Done</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Tabs */}
                    <View style={[styles.pickerTabs, { borderBottomColor: colors.border }]}>
                        {(['team', 'external'] as const).map(tab => (
                            <TouchableOpacity
                                key={tab}
                                style={[styles.pickerTab, pickerTab === tab && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}
                                onPress={() => setPickerTab(tab)}
                            >
                                <Text style={[styles.pickerTabText, { color: pickerTab === tab ? colors.accent : colors.textSecondary }]}>
                                    {tab === 'team' ? 'Team' : 'External'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {pickerTab === 'team' ? (
                        <>
                            <View style={[styles.searchBar, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                                <Ionicons name="search" size={16} color={colors.textTertiary} />
                                <TextInput
                                    style={[styles.searchInput, { color: colors.textPrimary }]}
                                    placeholder="Search by name or role..."
                                    placeholderTextColor={colors.textTertiary}
                                    value={userSearch}
                                    onChangeText={setUserSearch}
                                />
                            </View>

                            {loadingUsers ? (
                                <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
                            ) : usersError ? (
                                <TouchableOpacity
                                    style={[styles.retryBtn, { backgroundColor: colors.cardBackground }]}
                                    onPress={loadUsers}
                                >
                                    <Ionicons name="refresh" size={20} color={colors.accent} />
                                    <Text style={[styles.retryText, { color: colors.accent }]}>{usersError}</Text>
                                </TouchableOpacity>
                            ) : (
                                <FlatList
                                    data={filteredUsers}
                                    keyExtractor={u => u.id}
                                    contentContainerStyle={{ padding: 16 }}
                                    renderItem={({ item }) => {
                                        const isSelected = selectedAttendees.some(a => a.user_id === item.id);
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
                                                onPress={() => toggleAttendee(item)}
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
                                                    <Text style={[styles.userName, { color: colors.textPrimary }]}>{item.full_name}</Text>
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
                    ) : (
                        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                            <ScrollView contentContainerStyle={styles.externalTab}>
                                <Text style={[styles.externalHint, { color: colors.textTertiary }]}>
                                    Add guests not in the system — clients, prospects, or external partners.
                                </Text>

                                {/* Name input + role chips + Add button */}
                                <View style={[styles.externalForm, { backgroundColor: colors.cardBackground }]}>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.textPrimary }]}
                                        placeholder="Full name"
                                        placeholderTextColor={colors.textTertiary}
                                        value={externalName}
                                        onChangeText={setExternalName}
                                        returnKeyType="done"
                                    />
                                    <View style={styles.roleRow}>
                                        {ATTENDEE_ROLES.map(r => {
                                            const active = externalRole === r.key;
                                            return (
                                                <TouchableOpacity
                                                    key={r.key}
                                                    style={[styles.roleChip, { backgroundColor: active ? colors.accent : colors.surfaceSecondary }]}
                                                    onPress={() => setExternalRole(r.key)}
                                                >
                                                    <Text style={[styles.roleChipText, { color: active ? '#FFFFFF' : colors.textTertiary }]}>
                                                        {r.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.externalAddBtn, { backgroundColor: externalName.trim() ? colors.accent : colors.border }]}
                                        disabled={!externalName.trim()}
                                        onPress={() => {
                                            if (!externalName.trim()) return;
                                            setExternalAttendees(prev => [
                                                ...prev,
                                                { _key: `ext_${Date.now()}`, name: externalName.trim(), attendee_role: externalRole },
                                            ]);
                                            setExternalName('');
                                            setExternalRole('attendee');
                                        }}
                                    >
                                        <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
                                        <Text style={styles.externalAddBtnText}>Add Guest</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Already-added external attendees */}
                                {externalAttendees.length > 0 && (
                                    <View style={{ gap: 8, marginTop: 4 }}>
                                        <Text style={[styles.label, { color: colors.textSecondary }]}>Added guests</Text>
                                        {externalAttendees.map(a => {
                                            const aColor = getAvatarColor(a.name);
                                            return (
                                                <View key={a._key} style={[styles.userRow, { backgroundColor: colors.cardBackground, borderColor: 'transparent' }]}>
                                                    <Avatar name={a.name} avatarUrl={null} size={36} backgroundColor={aColor + '18'} textColor={aColor} />
                                                    <View style={styles.userInfo}>
                                                        <Text style={[styles.userName, { color: colors.textPrimary }]}>{a.name}</Text>
                                                        <Text style={[styles.userRole, { color: colors.textTertiary }]}>
                                                            {ATTENDEE_ROLES.find(r => r.key === a.attendee_role)?.label ?? a.attendee_role}
                                                        </Text>
                                                    </View>
                                                    <TouchableOpacity
                                                        onPress={() => setExternalAttendees(prev => prev.filter(x => x._key !== a._key))}
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
                    )}
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 60 },

    field: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
    textArea: { minHeight: 96, paddingTop: 12 },
    errorText: { fontSize: 12, marginTop: 4 },

    timeRow: { flexDirection: 'row', gap: 12 },

    // Compact time row card
    timeRowCard: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
    timeCell: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center', minHeight: 60 },
    timeCellLabel: { fontSize: 11, fontWeight: '500', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.4 },
    timeCellValue: { fontSize: 17, fontWeight: '500' },
    timeCellDivider: { width: StyleSheet.hairlineWidth },
    timeCellAdd: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    timeCellAddText: { fontSize: 15, fontWeight: '500' },

    // Time picker modal
    timeModalOverlay: { flex: 1, justifyContent: 'flex-end' },
    timeModalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: 32 },
    timeModalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
    timeModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
    timeModalTitle: { fontSize: 17, fontWeight: '600' },
    timeModalActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },

    // Shared picker internals
    timePickerContainer: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', position: 'relative' },
    timePickerBand: {
        position: 'absolute',
        top: WHEEL_ITEM_H,
        left: 0, right: 0,
        height: WHEEL_ITEM_H,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    timePickerWheels: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
    timePickerColon: { height: WHEEL_ITEM_H * TIME_PICKER_VISIBLE, justifyContent: 'center', paddingHorizontal: 2 },
    timeColonText: { fontSize: 20, fontWeight: '700' },

    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5 },
    typeChipText: { fontSize: 13, fontWeight: '600' },

    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    addAttendeeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1.5, borderRadius: 8 },
    addAttendeeBtnText: { fontSize: 13, fontWeight: '600' },

    emptyAttendees: { borderRadius: 12, padding: 20, alignItems: 'center' },
    emptyAttendeesText: { fontSize: 14 },

    attendeeItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, padding: 12, marginBottom: 8 },
    avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 13, fontWeight: '700' },
    attendeeItemInfo: { flex: 1, gap: 6 },
    attendeeName: { fontSize: 15, fontWeight: '600' },
    roleRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    roleChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    roleChipText: { fontSize: 11, fontWeight: '600' },

    saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
    saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

    pickerScreen: { flex: 1 },
    pickerSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
    pickerSheetTitle: { fontSize: 17, fontWeight: '700' },
    pickerDone: { fontSize: 16, fontWeight: '600' },
    searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
    searchInput: { flex: 1, fontSize: 15, padding: 0 },

    userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1.5 },
    userInfo: { flex: 1 },
    userName: { fontSize: 15, fontWeight: '600' },
    userRole: { fontSize: 12, marginTop: 1 },

    retryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 32, borderRadius: 12, padding: 16 },
    retryText: { fontSize: 14, fontWeight: '600' },

    pickerTabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
    pickerTab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
    pickerTabText: { fontSize: 14, fontWeight: '600' },

    guestBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    guestBadgeText: { fontSize: 10, fontWeight: '700' },

    externalTab: { padding: 16, gap: 16 },
    externalHint: { fontSize: 13, lineHeight: 19 },
    externalForm: { borderRadius: 12, padding: 14, gap: 12 },
    externalAddBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 11 },
    externalAddBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

    // Roadshow
    rsSection: { borderRadius: 14, padding: 16, gap: 12, marginBottom: 16 },
    rsSectionTitle: { fontSize: 15, fontWeight: '700' },
    rsLockedBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, padding: 10 },
    rsStepper: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rsStepperRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rsStepBtn: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    rsStepValue: { fontSize: 16, fontWeight: '700', minWidth: 28, textAlign: 'center' },
    rsPreview: { borderRadius: 10, padding: 12, gap: 6, marginTop: 4 },
    rsPreviewTitle: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
    rsPreviewRow: { flexDirection: 'row', justifyContent: 'space-between' },
    rsPreviewLabel: { fontSize: 13 },
    rsPreviewValue: { fontSize: 13, fontWeight: '600' },
    rsPreviewHint: { fontSize: 12, marginTop: 6 },
    editNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, borderRadius: 8, padding: 10, marginTop: 4 },
    submitError: { borderRadius: 10, padding: 12, marginBottom: 8 },
});
