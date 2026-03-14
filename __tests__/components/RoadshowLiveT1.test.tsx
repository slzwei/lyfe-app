import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RoadshowLiveT1 } from '@/components/events/RoadshowLiveT1';
import type { RoadshowLiveT1Props } from '@/components/events/RoadshowLiveT1';
import type { RoadshowAttendance, RoadshowConfig } from '@/types/event';

jest.mock('@/components/events/ProgressRing', () => {
    const { View, Text } = require('react-native');
    return function MockProgressRing({ label, accessLabel }: any) {
        return (
            <View accessibilityLabel={accessLabel}>
                <Text>{label}</Text>
            </View>
        );
    };
});

jest.mock('@/components/WheelPicker', () => {
    const { View } = require('react-native');
    return function MockWheelPicker() {
        return <View testID="wheel-picker" />;
    };
});

jest.mock('@/lib/dateTime', () => ({
    formatCheckinTime: jest.fn(() => '9:05 AM'),
    formatTime: jest.fn((t: string) => '9:00 AM'),
}));

jest.mock('@/constants/ui', () => ({
    ERROR_BG: '#FEE2E2',
    ERROR_TEXT: '#DC2626',
    PICKER_HOURS: Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1}`, value: i })),
    PICKER_MINUTES: Array.from({ length: 12 }, (_, i) => ({ label: `${i * 5}`.padStart(2, '0'), value: i })),
    PICKER_AMPM: [
        { label: 'AM', value: 0 },
        { label: 'PM', value: 1 },
    ],
    ROADSHOW_PINK: '#EC4899',
}));

jest.mock('react-native-safe-area-context', () => {
    const { View } = require('react-native');
    return {
        SafeAreaView: View,
        useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    };
});

const COLORS = {
    textPrimary: '#000000',
    textSecondary: '#666666',
    textTertiary: '#999999',
    accent: '#007AFF',
    accentLight: '#E0F0FF',
    cardBackground: '#FFFFFF',
    background: '#F5F5F5',
    border: '#E0E0E0',
    success: '#34C759',
    error: '#FF3B30',
    warning: '#EAB308',
    warningLight: '#FFF3CD',
    inputBackground: '#F9F9F9',
    inputBorder: '#E0E0E0',
    surfaceSecondary: '#F0F0F0',
} as any;

const makeConfig = (): RoadshowConfig => ({
    id: 'cfg-1',
    event_id: 'e1',
    weekly_cost: 700,
    slots_per_day: 5,
    expected_start_time: '09:00',
    late_grace_minutes: 15,
    suggested_sitdowns: 4,
    suggested_pitches: 2,
    suggested_closed: 1,
    daily_cost: 140,
    slot_cost: 28,
});

const makeAttendance = (overrides?: Partial<RoadshowAttendance>): RoadshowAttendance => ({
    id: 'att-1',
    event_id: 'e1',
    user_id: 'u1',
    full_name: 'Alice Tan',
    checked_in_at: '2026-03-08T09:05:00Z',
    late_reason: null,
    checked_in_by: null,
    is_late: false,
    minutes_late: 0,
    pledged_sitdowns: 4,
    pledged_pitches: 2,
    pledged_closed: 1,
    pledged_afyc: 2000,
    ...overrides,
});

function makeDefaultProps(overrides?: Partial<RoadshowLiveT1Props>): RoadshowLiveT1Props {
    return {
        colors: COLORS,
        attendance: [],
        myAttendance: null,
        myCounts: { sitdowns: 0, pitches: 0, closed: 0, afyc: 0 },
        roadshowConfig: makeConfig(),
        activities: [],
        isCurrentlyLate: false,
        minutesCurrentlyLate: 0,
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
        userId: 'u1',
        lateReason: '',
        setLateReason: jest.fn(),
        showPledgeSheet: false,
        setShowPledgeSheet: jest.fn(),
        pledgeSitdowns: 4,
        setPledgeSitdowns: jest.fn(),
        pledgePitches: 2,
        setPledgePitches: jest.fn(),
        pledgeClosed: 1,
        setPledgeClosed: jest.fn(),
        pledgeAfyc: '2000',
        setPledgeAfyc: jest.fn(),
        checkingIn: false,
        checkinError: null,
        handleOpenCheckin: jest.fn(),
        handleConfirmPledge: jest.fn(),
        logDebounce: {},
        confirmActivity: null,
        setConfirmActivity: jest.fn(),
        showAfycSheet: false,
        setShowAfycSheet: jest.fn(),
        afycInput: '',
        setAfycInput: jest.fn(),
        loggingActivity: false,
        logHour: 0,
        setLogHour: jest.fn(),
        logMinuteIdx: 0,
        setLogMinuteIdx: jest.fn(),
        logAmPm: 0,
        setLogAmPm: jest.fn(),
        initLogTime: jest.fn(),
        handleLogActivity: jest.fn(),
        handleLogCaseClosed: jest.fn(),
        handleLogDeparture: jest.fn(),
        handleReturnToBooth: jest.fn(),
        hasCheckedIn: false,
        ...overrides,
    };
}

beforeEach(() => jest.clearAllMocks());

describe('RoadshowLiveT1', () => {
    it('renders check-in card when not checked in', () => {
        const props = makeDefaultProps({ hasCheckedIn: false });
        const { getByLabelText, getByText } = render(<RoadshowLiveT1 {...props} />);

        expect(getByLabelText('Check In Now')).toBeTruthy();
        expect(getByText(/Booth opens/)).toBeTruthy();
    });

    it('renders progress rings when checked in', () => {
        const myAtt = makeAttendance({ user_id: 'u1' });
        const props = makeDefaultProps({
            hasCheckedIn: true,
            myAttendance: myAtt,
            myCounts: { sitdowns: 2, pitches: 1, closed: 0, afyc: 500 },
        });
        const { getByText, getByLabelText } = render(<RoadshowLiveT1 {...props} />);

        expect(getByText('Your Progress')).toBeTruthy();
        expect(getByLabelText('Sitdowns: 2 of 4')).toBeTruthy();
        expect(getByLabelText('Pitches: 1 of 2')).toBeTruthy();
    });

    it('renders activity logging buttons when checked in', () => {
        const myAtt = makeAttendance({ user_id: 'u1' });
        const props = makeDefaultProps({
            hasCheckedIn: true,
            myAttendance: myAtt,
            myCounts: { sitdowns: 3, pitches: 1, closed: 0, afyc: 0 },
        });
        const { getByLabelText } = render(<RoadshowLiveT1 {...props} />);

        expect(getByLabelText('Log Sitdown, current count 3')).toBeTruthy();
        expect(getByLabelText('Log Pitch, current count 1')).toBeTruthy();
        expect(getByLabelText('Log Case Closed, current count 0')).toBeTruthy();
        expect(getByLabelText('Leave Roadshow')).toBeTruthy();
    });

    it('calls handleOpenCheckin when check-in button pressed', () => {
        const handleOpenCheckin = jest.fn();
        const props = makeDefaultProps({ hasCheckedIn: false, handleOpenCheckin });
        const { getByLabelText } = render(<RoadshowLiveT1 {...props} />);

        fireEvent.press(getByLabelText('Check In Now'));
        expect(handleOpenCheckin).toHaveBeenCalledTimes(1);
    });

    it('renders pledge sheet when showPledgeSheet is true', () => {
        const props = makeDefaultProps({ showPledgeSheet: true });
        const { getByText } = render(<RoadshowLiveT1 {...props} />);

        expect(getByText('Your Pledge for Today')).toBeTruthy();
        expect(getByText('Sitdowns today')).toBeTruthy();
        expect(getByText('Pitches today')).toBeTruthy();
        expect(getByText('Cases to close')).toBeTruthy();
    });
});
