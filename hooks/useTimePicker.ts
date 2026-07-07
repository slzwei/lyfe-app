/**
 * Hook encapsulating time picker state for event creation/editing.
 * Manages start/end time wheel picker indices + optional end time toggle.
 *
 * The wheels only offer 5-minute steps, but edited events may hold odd
 * minutes (e.g. 09:07 from seeds/imports). To avoid silently rewriting
 * them on save, the raw HH:MM from populateFromEdit is preserved and used
 * for BOTH display and submission until the user actually moves a wheel —
 * what you see is always exactly what will be saved.
 */
import { useCallback, useState } from 'react';
import { formatPickerTime, hhmm24ToPickerState, pickerToHHMM24 } from '@/constants/ui';
import { formatTime } from '@/lib/dateTime';

interface TimePickerState {
    startHour: number;
    startMinIdx: number;
    startAmPm: number;
    endHour: number;
    endMinIdx: number;
    endAmPm: number;
    hasEndTime: boolean;
    showTimePicker: 'start' | 'end' | null;
    setStartHour: (v: number) => void;
    setStartMinIdx: (v: number) => void;
    setStartAmPm: (v: number) => void;
    setEndHour: (v: number) => void;
    setEndMinIdx: (v: number) => void;
    setEndAmPm: (v: number) => void;
    setHasEndTime: (v: boolean) => void;
    setShowTimePicker: (v: 'start' | 'end' | null) => void;
    toStartTimeStr: () => string;
    toEndTimeStr: () => string | null;
    formatStart: () => string;
    formatEnd: () => string;
    populateFromEdit: (startTime: string, endTime: string | null) => void;
}

export function useTimePicker(): TimePickerState {
    // Default 9:00 AM
    const [startHour, setStartHourState] = useState(8); // index 8 → '9'
    const [startMinIdx, setStartMinIdxState] = useState(0);
    const [startAmPm, setStartAmPmState] = useState(0); // 0 = AM
    // Default 5:00 PM
    const [endHour, setEndHourState] = useState(4); // index 4 → '5'
    const [endMinIdx, setEndMinIdxState] = useState(0);
    const [endAmPm, setEndAmPmState] = useState(1); // 1 = PM
    const [hasEndTime, setHasEndTime] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState<'start' | 'end' | null>(null);

    // Raw HH:MM as loaded from an existing event; null until populateFromEdit.
    // Cleared (superseded) the moment the corresponding wheel set is touched.
    const [startRaw, setStartRaw] = useState<string | null>(null);
    const [endRaw, setEndRaw] = useState<string | null>(null);

    const setStartHour = useCallback((v: number) => {
        setStartRaw(null);
        setStartHourState(v);
    }, []);
    const setStartMinIdx = useCallback((v: number) => {
        setStartRaw(null);
        setStartMinIdxState(v);
    }, []);
    const setStartAmPm = useCallback((v: number) => {
        setStartRaw(null);
        setStartAmPmState(v);
    }, []);
    const setEndHour = useCallback((v: number) => {
        setEndRaw(null);
        setEndHourState(v);
    }, []);
    const setEndMinIdx = useCallback((v: number) => {
        setEndRaw(null);
        setEndMinIdxState(v);
    }, []);
    const setEndAmPm = useCallback((v: number) => {
        setEndRaw(null);
        setEndAmPmState(v);
    }, []);

    const toStartTimeStr = useCallback(
        () => startRaw ?? pickerToHHMM24(startHour, startMinIdx, startAmPm),
        [startRaw, startHour, startMinIdx, startAmPm],
    );

    const toEndTimeStr = useCallback(
        () => (hasEndTime ? (endRaw ?? pickerToHHMM24(endHour, endMinIdx, endAmPm)) : null),
        [hasEndTime, endRaw, endHour, endMinIdx, endAmPm],
    );

    const formatStart = useCallback(
        () => (startRaw ? formatTime(startRaw) : formatPickerTime(startHour, startMinIdx, startAmPm)),
        [startRaw, startHour, startMinIdx, startAmPm],
    );

    const formatEnd = useCallback(
        () => (endRaw ? formatTime(endRaw) : formatPickerTime(endHour, endMinIdx, endAmPm)),
        [endRaw, endHour, endMinIdx, endAmPm],
    );

    const toHHMM = (t: string | null | undefined) => (t ?? '').slice(0, 5);

    const populateFromEdit = useCallback((startTime: string, endTime: string | null) => {
        const startHHMM = toHHMM(startTime) || '09:00';
        const sp = hhmm24ToPickerState(startHHMM);
        setStartRaw(startHHMM);
        setStartHourState(sp.hour);
        setStartMinIdxState(sp.minIdx);
        setStartAmPmState(sp.ampm);
        if (endTime) {
            const endHHMM = toHHMM(endTime);
            const ep = hhmm24ToPickerState(endHHMM);
            setEndRaw(endHHMM);
            setEndHourState(ep.hour);
            setEndMinIdxState(ep.minIdx);
            setEndAmPmState(ep.ampm);
            setHasEndTime(true);
        }
    }, []);

    return {
        startHour,
        startMinIdx,
        startAmPm,
        endHour,
        endMinIdx,
        endAmPm,
        hasEndTime,
        showTimePicker,
        setStartHour,
        setStartMinIdx,
        setStartAmPm,
        setEndHour,
        setEndMinIdx,
        setEndAmPm,
        setHasEndTime,
        setShowTimePicker,
        toStartTimeStr,
        toEndTimeStr,
        formatStart,
        formatEnd,
        populateFromEdit,
    };
}
