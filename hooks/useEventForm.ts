/**
 * Hook encapsulating the event create/edit form logic.
 * Manages validation, submission, and edit pre-population.
 */
import { useAuth } from '@/contexts/AuthContext';
import { useAttendeePicker } from '@/hooks/useAttendeePicker';
import { useRoadshowConfig } from '@/hooks/useRoadshowConfig';
import { useTimePicker } from '@/hooks/useTimePicker';
import { dateDiffDays, dateRange, isValidDate, todayLocalStr } from '@/lib/dateTime';
import { createEvent, fetchEventById, updateEvent } from '@/lib/events';
import { createRoadshowBulk, fetchRoadshowConfig, saveRoadshowConfig, type RoadshowConfigInput } from '@/lib/roadshow';
import { supabase } from '@/lib/supabase';
import type { CreateEventInput, EventType } from '@/types/event';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

export function useEventForm() {
    const { user } = useAuth();
    const router = useRouter();
    const { eventId } = useLocalSearchParams<{ eventId?: string }>();
    const isEditing = !!eventId;
    const [isEditingRoadshow, setIsEditingRoadshow] = useState(false);

    const [title, setTitle] = useState('');
    const [eventType, setEventType] = useState<EventType>('team_meeting');
    const [eventDate, setEventDate] = useState(todayLocalStr());
    const [showDatePicker, setShowDatePicker] = useState<'single' | 'range' | null>(null);
    const [location, setLocation] = useState('');
    // Precise venue coordinates — null means the location is TBC and
    // check-in will be blocked until a manager pins the spot. Set by
    // the MapPicker component in the create / detail screens.
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [loadingEvent, setLoadingEvent] = useState(isEditing);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const timePicker = useTimePicker();
    const attendeePicker = useAttendeePicker(eventType);
    const roadshowCfg = useRoadshowConfig();

    const { toStartTimeStr, toEndTimeStr, hasEndTime, populateFromEdit } = timePicker;
    const { startHour, startMinIdx, startAmPm, endHour, endMinIdx, endAmPm } = timePicker;
    const { selectedAttendees, setSelectedAttendees, externalAttendees, setExternalAttendees } = attendeePicker;
    const {
        rsStartDate,
        setRsStartDate,
        rsEndDate,
        setRsEndDate,
        rsWeeklyCost,
        rsSlots,
        rsGrace,
        rsSitdowns,
        rsPitches,
        rsClosed,
        rsConfigLocked,
        setRsConfigLocked,
        populateFromExisting,
    } = roadshowCfg;

    // Pre-populate form when editing
    useEffect(() => {
        if (!isEditing || !eventId) return;
        let cancelled = false;

        (async () => {
            const { data } = await fetchEventById(eventId);
            if (cancelled) return;
            if (data) {
                setTitle(data.title);
                setEventType(data.event_type);
                setEventDate(data.event_date);
                populateFromEdit(data.start_time, data.end_time);
                setLocation(data.location || '');
                setLatitude(data.latitude);
                setLongitude(data.longitude);
                setDescription(data.description || '');
                setSelectedAttendees(
                    data.attendees.map((a) => ({
                        user_id: a.user_id,
                        full_name: a.full_name ?? '',
                        role: '',
                        attendee_role: a.attendee_role,
                        avatar_url: a.avatar_url,
                    })),
                );
                setExternalAttendees(
                    (data.external_attendees || []).map((a, i) => ({
                        _key: `ext_${i}_${Date.now()}`,
                        name: a.name,
                        attendee_role: a.attendee_role,
                    })),
                );

                if (data.event_type === 'roadshow') {
                    setIsEditingRoadshow(true);
                    const { data: cfg } = await fetchRoadshowConfig(eventId);
                    if (!cancelled && cfg) {
                        populateFromExisting(cfg, data.event_date);
                    }
                    const { data: att } = await supabase
                        .from('roadshow_attendance')
                        .select('id')
                        .eq('event_id', eventId)
                        .limit(1);
                    if (!cancelled) setRsConfigLocked((att ?? []).length > 0);
                }
            }
            if (!cancelled) setLoadingEvent(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [isEditing, eventId]);

    const validate = (): boolean => {
        const e: Record<string, string> = {};
        if (!title.trim()) e.title = 'Title is required';
        if (eventType === 'roadshow') {
            if (!isValidDate(rsStartDate)) e.rsStartDate = 'Enter a valid start date (YYYY-MM-DD)';
            if (!isValidDate(rsEndDate)) e.rsEndDate = 'Enter a valid end date (YYYY-MM-DD)';
            if (rsStartDate && rsEndDate && rsEndDate < rsStartDate)
                e.rsEndDate = 'End date must be on or after start date';
            const dayCount = rsStartDate && rsEndDate ? dateDiffDays(rsStartDate, rsEndDate) + 1 : 0;
            if (dayCount > 31) e.rsEndDate = 'Range cannot exceed 31 days';
            if (!rsWeeklyCost || isNaN(Number(rsWeeklyCost)) || Number(rsWeeklyCost) <= 0)
                e.rsWeeklyCost = 'Enter a valid weekly cost';
            if (rsSlots < 1) e.rsSlots = 'Slots must be at least 1';
        } else {
            if (!isValidDate(eventDate)) e.eventDate = 'Enter a valid date (YYYY-MM-DD)';
        }
        if (hasEndTime && toStartTimeStr() >= toEndTimeStr()!) {
            e.endTime = 'End time must be after start time';
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    // Live end-time validation
    useEffect(() => {
        if (!hasEndTime) {
            setErrors((prev) => {
                if (!prev.endTime) return prev;
                const { endTime: _, ...rest } = prev;
                return rest;
            });
            return;
        }
        const invalid = toStartTimeStr() >= toEndTimeStr()!;
        setErrors((prev) => {
            if (invalid && !prev.endTime) return { ...prev, endTime: 'End time must be after start time' };
            if (!invalid && prev.endTime) {
                const { endTime: _, ...rest } = prev;
                return rest;
            }
            return prev;
        });
    }, [hasEndTime, startHour, startMinIdx, startAmPm, endHour, endMinIdx, endAmPm]);

    const handleSubmit = async () => {
        if (!validate()) return;

        const startTime = toStartTimeStr();
        const endTime = toEndTimeStr();

        setSubmitting(true);

        // Roadshow bulk create
        if (eventType === 'roadshow' && !isEditing) {
            const dates = dateRange(rsStartDate, rsEndDate);
            const dayCount = dates.length;

            if (dayCount > 14) {
                const confirmed = await new Promise<boolean>((resolve) =>
                    Alert.alert('Large Roadshow', `This will create ${dayCount} events. Continue?`, [
                        { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
                        { text: 'Create', onPress: () => resolve(true) },
                    ]),
                );
                if (!confirmed) {
                    setSubmitting(false);
                    return;
                }
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

            const events = dates.map((d) => ({
                title: title.trim(),
                event_date: d,
                start_time: startTime,
                end_time: endTime ?? '',
                location: location.trim(),
            }));

            const { error } = await createRoadshowBulk(
                events,
                rsConfig,
                selectedAttendees.map((a) => ({ user_id: a.user_id, attendee_role: a.attendee_role })),
                user!.id,
            );
            setSubmitting(false);
            if (error) {
                setErrors((e) => ({ ...e, _submit: error }));
            } else {
                Alert.alert('Created', `${dayCount} roadshow event${dayCount > 1 ? 's' : ''} created.`, [
                    { text: 'OK', onPress: () => router.back() },
                ]);
            }
            return;
        }

        // Normal create/edit
        const input: CreateEventInput = {
            title: title.trim(),
            description: description.trim() || null,
            event_type: eventType,
            event_date: eventDate,
            start_time: startTime,
            end_time: endTime,
            location: location.trim() || null,
            // Coordinates — null when TBC, set via MapPicker.
            latitude,
            longitude,
            attendees: selectedAttendees.map((a) => ({
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
            setErrors((e) => ({ ...e, _submit: eventError }));
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

    const handleClearError = useCallback((key: string) => setErrors((e) => ({ ...e, [key]: '' })), []);

    const handleCloseAttendeePicker = useCallback(() => {
        attendeePicker.setShowAttendeePicker(false);
        attendeePicker.setUserSearch('');
        attendeePicker.setExternalName('');
    }, [attendeePicker.setShowAttendeePicker, attendeePicker.setUserSearch, attendeePicker.setExternalName]);

    const handleAddExternal = useCallback(() => {
        if (!attendeePicker.externalName.trim()) return;
        attendeePicker.setExternalAttendees((prev) => [
            ...prev,
            {
                _key: `ext_${Date.now()}`,
                name: attendeePicker.externalName.trim(),
                attendee_role: attendeePicker.externalRole,
            },
        ]);
        attendeePicker.setExternalName('');
        attendeePicker.setExternalRole('attendee');
    }, [
        attendeePicker.externalName,
        attendeePicker.externalRole,
        attendeePicker.setExternalAttendees,
        attendeePicker.setExternalName,
        attendeePicker.setExternalRole,
    ]);

    const handleRemoveAttendee = useCallback(
        (userId: string) => setSelectedAttendees((prev) => prev.filter((x) => x.user_id !== userId)),
        [setSelectedAttendees],
    );

    const handleUpdateExternalRole = useCallback(
        (key: string, role: string) =>
            attendeePicker.setExternalAttendees((prev) =>
                prev.map((x) => (x._key === key ? { ...x, attendee_role: role as typeof x.attendee_role } : x)),
            ),
        [attendeePicker.setExternalAttendees],
    );

    const handleRemoveExternal = useCallback(
        (key: string) => attendeePicker.setExternalAttendees((prev) => prev.filter((x) => x._key !== key)),
        [attendeePicker.setExternalAttendees],
    );

    return {
        // Screen state
        isEditing,
        isEditingRoadshow,
        loadingEvent,
        submitting,
        errors,
        // Form fields
        title,
        setTitle,
        eventType,
        setEventType,
        eventDate,
        setEventDate,
        showDatePicker,
        setShowDatePicker,
        location,
        setLocation,
        latitude,
        setLatitude,
        longitude,
        setLongitude,
        description,
        setDescription,
        // Sub-hooks
        timePicker,
        attendeePicker,
        roadshowCfg,
        // Handlers
        handleSubmit,
        handleClearError,
        handleCloseAttendeePicker,
        handleAddExternal,
        handleRemoveAttendee,
        handleUpdateExternalRole,
        handleRemoveExternal,
        router,
    };
}
