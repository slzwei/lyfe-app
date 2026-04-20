import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Colors } from '@/constants/Colors';
import EventCard from '@/components/events/EventCard';
import type { AgencyEvent } from '@/types/event';

// ── Mocks ──────────────────────────────────────────────────────

jest.mock('@/lib/dateTime', () => ({
    formatTime: jest.fn((t: string) => t),
    formatCheckinTime: jest.fn(() => '10:30 AM'),
    getRoadshowStatus: jest.fn(() => 'upcoming'),
    toDateStr: jest.fn((d: Date) => d.toISOString().split('T')[0]),
}));

jest.mock('@/components/WheelPicker', () => {
    const { View } = require('react-native');
    return function MockWheelPicker(props: any) {
        return <View testID="wheel-picker" />;
    };
});

jest.mock('@/components/events/roadshowTokens', () => ({
    PITCH_COLOR: '#E67700',
    CASE_CLOSED_COLOR: '#F59E0B',
}));

jest.mock('@/constants/ui', () => ({
    AVATAR_COLORS: ['#6366F1', '#FF7600', '#E11D48', '#F59E0B', '#8B5CF6', '#06B6D4'],
    ERROR_BG: '#FEE2E2',
    ERROR_TEXT: '#DC2626',
    ROADSHOW_PINK: '#EC4899',
    PICKER_HOURS: Array.from({ length: 12 }, (_, i) => String(i + 1)),
    PICKER_MINUTES: ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'],
    PICKER_AMPM: ['AM', 'PM'],
}));

jest.mock('@/components/Avatar', () => {
    const { Text } = require('react-native');
    return function MockAvatar({ name }: { name: string }) {
        return <Text>{name}</Text>;
    };
});

const colors = Colors.light;

// ── Helpers ────────────────────────────────────────────────────

function makeEvent(overrides: Partial<AgencyEvent> = {}): AgencyEvent {
    return {
        id: 'evt-1',
        title: 'Weekly Standup',
        description: null,
        event_type: 'team_meeting',
        event_date: '2026-03-15',
        start_time: '09:00',
        end_time: '10:00',
        location: null,
        created_by: 'u1',
        creator_name: 'Creator',
        created_at: '2026-03-01T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z',
        attendees: [],
        external_attendees: [],
        ...overrides,
    };
}

// ── EventCard ──────────────────────────────────────────────────

describe('EventCard', () => {
    const onPress = jest.fn();
    beforeEach(() => jest.clearAllMocks());

    it('renders title and time', () => {
        const event = makeEvent();
        const { getByText } = render(<EventCard event={event} onPress={onPress} colors={colors} />);
        expect(getByText('Weekly Standup')).toBeTruthy();
        // formatTime is mocked to return the input string
        expect(getByText(/09:00/)).toBeTruthy();
    });

    it('renders event type badge for team_meeting', () => {
        const event = makeEvent({ event_type: 'team_meeting' });
        const { getByText } = render(<EventCard event={event} onPress={onPress} colors={colors} />);
        expect(getByText('Team Meeting')).toBeTruthy();
    });

    it('renders event type badge for training', () => {
        const event = makeEvent({ event_type: 'training', title: 'Sales Training' });
        const { getByText } = render(<EventCard event={event} onPress={onPress} colors={colors} />);
        expect(getByText('Training')).toBeTruthy();
    });

    it('renders event type badge for roadshow', () => {
        const event = makeEvent({ event_type: 'roadshow', title: 'March Roadshow' });
        const { getByText } = render(<EventCard event={event} onPress={onPress} colors={colors} />);
        expect(getByText('Roadshow')).toBeTruthy();
    });

    it('renders event type badge for exam', () => {
        const event = makeEvent({ event_type: 'exam', title: 'Module 5 Exam' });
        const { getByText } = render(<EventCard event={event} onPress={onPress} colors={colors} />);
        expect(getByText('Exam')).toBeTruthy();
    });

    it('shows location when provided', () => {
        const event = makeEvent({ location: 'Conference Room A' });
        const { getByText } = render(<EventCard event={event} onPress={onPress} colors={colors} />);
        expect(getByText('Conference Room A')).toBeTruthy();
    });

    it('hides location row when location is null', () => {
        const event = makeEvent({ location: null });
        const { queryByText } = render(<EventCard event={event} onPress={onPress} colors={colors} />);
        expect(queryByText('Conference Room A')).toBeNull();
    });

    it('shows time range when end_time is present', () => {
        const event = makeEvent({ start_time: '09:00', end_time: '10:00' });
        const { getByText } = render(<EventCard event={event} onPress={onPress} colors={colors} />);
        // formatTime is mocked to identity, so we see "09:00" and "10:00"
        expect(getByText(/09:00/)).toBeTruthy();
        expect(getByText(/10:00/)).toBeTruthy();
    });

    it('shows only start_time when end_time is null', () => {
        const event = makeEvent({ start_time: '09:00', end_time: null });
        const { getByText, queryByText } = render(<EventCard event={event} onPress={onPress} colors={colors} />);
        expect(getByText('09:00')).toBeTruthy();
        expect(queryByText(/–/)).toBeNull();
    });

    it('calls onPress when card is pressed', () => {
        const event = makeEvent();
        const { getByRole } = render(<EventCard event={event} onPress={onPress} colors={colors} />);
        fireEvent.press(getByRole('button'));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('renders attendee avatars (up to 3)', () => {
        const event = makeEvent({
            attendees: [
                { id: 'a1', event_id: 'evt-1', user_id: 'u1', attendee_role: 'attendee', full_name: 'Alice' },
                { id: 'a2', event_id: 'evt-1', user_id: 'u2', attendee_role: 'attendee', full_name: 'Bob' },
                { id: 'a3', event_id: 'evt-1', user_id: 'u3', attendee_role: 'attendee', full_name: 'Charlie' },
            ],
        });
        const { getByText } = render(<EventCard event={event} onPress={onPress} colors={colors} />);
        expect(getByText('Alice')).toBeTruthy();
        expect(getByText('Bob')).toBeTruthy();
        expect(getByText('Charlie')).toBeTruthy();
    });

    it('shows overflow count when more than 3 attendees', () => {
        const event = makeEvent({
            attendees: [
                { id: 'a1', event_id: 'evt-1', user_id: 'u1', attendee_role: 'attendee', full_name: 'Alice' },
                { id: 'a2', event_id: 'evt-1', user_id: 'u2', attendee_role: 'attendee', full_name: 'Bob' },
                { id: 'a3', event_id: 'evt-1', user_id: 'u3', attendee_role: 'attendee', full_name: 'Charlie' },
                { id: 'a4', event_id: 'evt-1', user_id: 'u4', attendee_role: 'attendee', full_name: 'Diana' },
                { id: 'a5', event_id: 'evt-1', user_id: 'u5', attendee_role: 'attendee', full_name: 'Eve' },
            ],
        });
        const { getByText, queryByText } = render(<EventCard event={event} onPress={onPress} colors={colors} />);
        // Only first 3 visible
        expect(getByText('Alice')).toBeTruthy();
        expect(getByText('Bob')).toBeTruthy();
        expect(getByText('Charlie')).toBeTruthy();
        // Overflow chip: 5 - 3 = +2
        expect(getByText('+2')).toBeTruthy();
        // Diana and Eve not rendered
        expect(queryByText('Diana')).toBeNull();
        expect(queryByText('Eve')).toBeNull();
    });

    it('includes external attendees in overflow count', () => {
        const event = makeEvent({
            attendees: [
                { id: 'a1', event_id: 'evt-1', user_id: 'u1', attendee_role: 'attendee', full_name: 'Alice' },
                { id: 'a2', event_id: 'evt-1', user_id: 'u2', attendee_role: 'attendee', full_name: 'Bob' },
                { id: 'a3', event_id: 'evt-1', user_id: 'u3', attendee_role: 'attendee', full_name: 'Charlie' },
            ],
            external_attendees: [
                { name: 'External1', attendee_role: 'attendee' },
                { name: 'External2', attendee_role: 'attendee' },
            ],
        });
        const { getByText } = render(<EventCard event={event} onPress={onPress} colors={colors} />);
        // 3 internal + 2 external = 5 total, overflow = 5 - 3 = +2
        expect(getByText('+2')).toBeTruthy();
    });

    it('shows LIVE pill when roadshow is live', () => {
        const { getRoadshowStatus } = require('@/lib/dateTime');
        getRoadshowStatus.mockReturnValue('live');

        const event = makeEvent({ event_type: 'roadshow' });
        const { getByText } = render(<EventCard event={event} onPress={onPress} colors={colors} />);
        expect(getByText('LIVE')).toBeTruthy();

        getRoadshowStatus.mockReturnValue('upcoming');
    });

    it('hides LIVE pill for non-live roadshow', () => {
        const { getRoadshowStatus } = require('@/lib/dateTime');
        getRoadshowStatus.mockReturnValue('upcoming');

        const event = makeEvent({ event_type: 'roadshow' });
        const { queryByText } = render(<EventCard event={event} onPress={onPress} colors={colors} />);
        expect(queryByText('LIVE')).toBeNull();
    });

    it('sets accessibilityLabel to event title', () => {
        const event = makeEvent({ title: 'Team Sync' });
        const { getByLabelText } = render(<EventCard event={event} onPress={onPress} colors={colors} />);
        expect(getByLabelText('Team Sync')).toBeTruthy();
    });
});

// ── InlineCalendar ─────────────────────────────────────────────

describe('InlineCalendar', () => {
    // Lazy-require to ensure mocks are applied first
    const getInlineCalendar = () => require('@/components/events/InlineCalendar').default;

    const onSelectDate = jest.fn();
    beforeEach(() => jest.clearAllMocks());

    it('renders without crashing with a selected date', () => {
        const InlineCalendar = getInlineCalendar();
        const { toJSON } = render(
            <InlineCalendar
                selectedDate="2026-03-15"
                onSelectDate={onSelectDate}
                eventDates={new Set<string>()}
                colors={colors}
            />,
        );
        expect(toJSON()).toBeTruthy();
    });

    it('renders with event dates', () => {
        const InlineCalendar = getInlineCalendar();
        const eventDates = new Set(['2026-03-15', '2026-03-16']);
        const { toJSON } = render(
            <InlineCalendar
                selectedDate="2026-03-15"
                onSelectDate={onSelectDate}
                eventDates={eventDates}
                colors={colors}
            />,
        );
        expect(toJSON()).toBeTruthy();
    });

    it('accepts a scrollToTodayRef prop', () => {
        const InlineCalendar = getInlineCalendar();
        const ref = { current: null } as React.MutableRefObject<(() => void) | null>;
        render(
            <InlineCalendar
                selectedDate="2026-03-15"
                onSelectDate={onSelectDate}
                eventDates={new Set<string>()}
                colors={colors}
                scrollToTodayRef={ref}
            />,
        );
        // The component assigns a function to the ref
        expect(typeof ref.current).toBe('function');
    });
});

// ── PledgeSheet ────────────────────────────────────────────────

describe('PledgeSheet', () => {
    const getPledgeSheet = () => require('@/components/events/PledgeSheet').PledgeSheet;

    function makeProps(overrides: Record<string, any> = {}) {
        return {
            colors,
            showPledgeSheet: true,
            setShowPledgeSheet: jest.fn(),
            pledgeSitdowns: 3,
            setPledgeSitdowns: jest.fn(),
            pledgePitches: 2,
            setPledgePitches: jest.fn(),
            pledgeClosed: 1,
            setPledgeClosed: jest.fn(),
            pledgeAfyc: '2000',
            setPledgeAfyc: jest.fn(),
            checkingIn: false,
            checkinError: null,
            handleConfirmPledge: jest.fn(),
            ...overrides,
        };
    }

    beforeEach(() => jest.clearAllMocks());

    it('renders editorial title when visible', () => {
        const PledgeSheet = getPledgeSheet();
        const { getByText } = render(<PledgeSheet {...makeProps()} />);
        // Editorial serif title split across text nodes — assert pieces
        expect(getByText(/Your/)).toBeTruthy();
        expect(getByText('pledge')).toBeTruthy();
    });

    it('does not render content when hidden', () => {
        const PledgeSheet = getPledgeSheet();
        const { queryByText } = render(<PledgeSheet {...makeProps({ showPledgeSheet: false })} />);
        expect(queryByText('pledge')).toBeNull();
    });

    it('shows stepper labels and current values', () => {
        const PledgeSheet = getPledgeSheet();
        const { getByText } = render(<PledgeSheet {...makeProps()} />);
        expect(getByText('Sit-downs')).toBeTruthy();
        expect(getByText('Pitches')).toBeTruthy();
        expect(getByText('Cases')).toBeTruthy();
        expect(getByText('3')).toBeTruthy();
        expect(getByText('2')).toBeTruthy();
        expect(getByText('1')).toBeTruthy();
    });

    it('calls setPledgeSitdowns on increment press', () => {
        const setPledgeSitdowns = jest.fn();
        const PledgeSheet = getPledgeSheet();
        const { getByLabelText } = render(<PledgeSheet {...makeProps({ setPledgeSitdowns })} />);
        fireEvent.press(getByLabelText('Increase Sit-downs'));
        expect(setPledgeSitdowns).toHaveBeenCalledTimes(1);
        const updater = setPledgeSitdowns.mock.calls[0][0];
        expect(typeof updater).toBe('function');
        expect(updater(5)).toBe(6);
    });

    it('calls setPledgeSitdowns on decrement press (clamped to 0)', () => {
        const setPledgeSitdowns = jest.fn();
        const PledgeSheet = getPledgeSheet();
        const { getByLabelText } = render(<PledgeSheet {...makeProps({ setPledgeSitdowns })} />);
        fireEvent.press(getByLabelText('Decrease Sit-downs'));
        expect(setPledgeSitdowns).toHaveBeenCalledTimes(1);
        const updater = setPledgeSitdowns.mock.calls[0][0];
        expect(updater(0)).toBe(0);
        expect(updater(3)).toBe(2);
    });

    it('calls setPledgePitches on increment press', () => {
        const setPledgePitches = jest.fn();
        const PledgeSheet = getPledgeSheet();
        const { getByLabelText } = render(<PledgeSheet {...makeProps({ setPledgePitches })} />);
        fireEvent.press(getByLabelText('Increase Pitches'));
        const updater = setPledgePitches.mock.calls[0][0];
        expect(updater(2)).toBe(3);
    });

    it('calls setPledgeClosed on decrement press', () => {
        const setPledgeClosed = jest.fn();
        const PledgeSheet = getPledgeSheet();
        const { getByLabelText } = render(<PledgeSheet {...makeProps({ setPledgeClosed })} />);
        fireEvent.press(getByLabelText('Decrease Cases'));
        const updater = setPledgeClosed.mock.calls[0][0];
        expect(updater(1)).toBe(0);
    });

    it('calls handleConfirmPledge on confirm button press', () => {
        const handleConfirmPledge = jest.fn();
        const PledgeSheet = getPledgeSheet();
        const { getByText } = render(<PledgeSheet {...makeProps({ handleConfirmPledge })} />);
        fireEvent.press(getByText('Continue to face check'));
        expect(handleConfirmPledge).toHaveBeenCalledTimes(1);
    });

    it('hides CTA label when checkingIn is true', () => {
        const PledgeSheet = getPledgeSheet();
        const { queryByText } = render(<PledgeSheet {...makeProps({ checkingIn: true })} />);
        // Spinner replaces the text
        expect(queryByText('Continue to face check')).toBeNull();
    });

    it('shows error banner when checkinError is set', () => {
        const PledgeSheet = getPledgeSheet();
        const { getByText } = render(<PledgeSheet {...makeProps({ checkinError: 'Network error' })} />);
        expect(getByText('Network error')).toBeTruthy();
    });

    it('hides error banner when checkinError is null', () => {
        const PledgeSheet = getPledgeSheet();
        const { queryByText } = render(<PledgeSheet {...makeProps({ checkinError: null })} />);
        expect(queryByText('Network error')).toBeNull();
    });

    it('shows AFYC target label', () => {
        const PledgeSheet = getPledgeSheet();
        const { getByText } = render(<PledgeSheet {...makeProps()} />);
        expect(getByText('AFYC target')).toBeTruthy();
    });

    it('shows AFYC input with current value', () => {
        const PledgeSheet = getPledgeSheet();
        const { getByDisplayValue } = render(<PledgeSheet {...makeProps()} />);
        expect(getByDisplayValue('2000')).toBeTruthy();
    });
});

// ── ActivityConfirmSheet ───────────────────────────────────────

describe('ActivityConfirmSheet', () => {
    const getSheet = () => require('@/components/events/ActivityConfirmSheet').ActivityConfirmSheet;

    function makeProps(overrides: Record<string, any> = {}) {
        return {
            colors,
            confirmActivity: 'sitdown' as 'sitdown' | 'pitch' | null,
            setConfirmActivity: jest.fn(),
            myCounts: { sitdowns: 2, pitches: 1, closed: 0, afyc: 0 },
            insets: { top: 0, bottom: 34, left: 0, right: 0 },
            logHour: 8,
            setLogHour: jest.fn(),
            logMinuteIdx: 0,
            setLogMinuteIdx: jest.fn(),
            logAmPm: 0,
            setLogAmPm: jest.fn(),
            handleLogActivity: jest.fn(),
            ...overrides,
        };
    }

    beforeEach(() => jest.clearAllMocks());

    it('renders sitdown confirmation when confirmActivity is sitdown', () => {
        const ActivityConfirmSheet = getSheet();
        const { getByText } = render(<ActivityConfirmSheet {...makeProps()} />);
        // Title "Sit-down logged" — RNTL concatenates nested Text children
        expect(getByText('Sit-down logged')).toBeTruthy();
        // Subtitle is "<line> Your ring just nudged up." for sitdowns
        expect(getByText(/One conversation in the books/)).toBeTruthy();
    });

    it('renders pitch confirmation when confirmActivity is pitch', () => {
        const ActivityConfirmSheet = getSheet();
        const { getByText } = render(
            <ActivityConfirmSheet
                {...makeProps({ confirmActivity: 'pitch', myCounts: { sitdowns: 0, pitches: 0, closed: 0, afyc: 0 } })}
            />,
        );
        expect(getByText('Pitch logged')).toBeTruthy();
        expect(getByText(/Plan walked through/)).toBeTruthy();
    });

    it('is hidden when confirmActivity is null', () => {
        const ActivityConfirmSheet = getSheet();
        const { queryByText } = render(<ActivityConfirmSheet {...makeProps({ confirmActivity: null })} />);
        expect(queryByText('Sit-down logged')).toBeNull();
        expect(queryByText('Pitch logged')).toBeNull();
    });

    it('calls handleLogActivity and setConfirmActivity on confirm press', () => {
        const handleLogActivity = jest.fn();
        const setConfirmActivity = jest.fn();
        const ActivityConfirmSheet = getSheet();
        const { getByText } = render(
            <ActivityConfirmSheet {...makeProps({ handleLogActivity, setConfirmActivity })} />,
        );
        // CTA renamed to "Done" in v2
        fireEvent.press(getByText('Done'));
        expect(handleLogActivity).toHaveBeenCalledWith('sitdown');
        expect(setConfirmActivity).toHaveBeenCalledWith(null);
    });

    it('calls setConfirmActivity(null) on cancel press', () => {
        const setConfirmActivity = jest.fn();
        const ActivityConfirmSheet = getSheet();
        const { getByText } = render(<ActivityConfirmSheet {...makeProps({ setConfirmActivity })} />);
        fireEvent.press(getByText('Cancel'));
        expect(setConfirmActivity).toHaveBeenCalledWith(null);
    });

    it('renders subtitle line regardless of count', () => {
        const ActivityConfirmSheet = getSheet();
        const { getByText } = render(
            <ActivityConfirmSheet
                {...makeProps({
                    confirmActivity: 'pitch',
                    myCounts: { sitdowns: 0, pitches: 5, closed: 0, afyc: 0 },
                })}
            />,
        );
        expect(getByText(/Plan walked through/)).toBeTruthy();
    });

    it('renders WheelPicker components for time selection', () => {
        const ActivityConfirmSheet = getSheet();
        const { getAllByTestId } = render(<ActivityConfirmSheet {...makeProps()} />);
        expect(getAllByTestId('wheel-picker').length).toBe(3);
    });

    it('shows TIME label', () => {
        const ActivityConfirmSheet = getSheet();
        const { getByText } = render(<ActivityConfirmSheet {...makeProps()} />);
        expect(getByText('TIME')).toBeTruthy();
    });
});

// ── AfycSheet ──────────────────────────────────────────────────

describe('AfycSheet', () => {
    const getSheet = () => require('@/components/events/AfycSheet').AfycSheet;

    function makeProps(overrides: Record<string, any> = {}) {
        return {
            colors,
            showAfycSheet: true,
            setShowAfycSheet: jest.fn(),
            afycInput: '1500',
            setAfycInput: jest.fn(),
            logHour: 10,
            setLogHour: jest.fn(),
            logMinuteIdx: 6,
            setLogMinuteIdx: jest.fn(),
            logAmPm: 0,
            setLogAmPm: jest.fn(),
            loggingActivity: false,
            handleLogCaseClosed: jest.fn(),
            ...overrides,
        };
    }

    beforeEach(() => jest.clearAllMocks());

    it('renders editorial title when visible', () => {
        const AfycSheet = getSheet();
        const { getByText } = render(<AfycSheet {...makeProps()} />);
        // "A close. Nicely done." with italic "close" accent
        expect(getByText(/Nicely done/)).toBeTruthy();
    });

    it('is hidden when showAfycSheet is false', () => {
        const AfycSheet = getSheet();
        const { queryByText } = render(<AfycSheet {...makeProps({ showAfycSheet: false })} />);
        expect(queryByText(/Nicely done/)).toBeNull();
    });

    it('shows AFYC label and current amount', () => {
        const AfycSheet = getSheet();
        const { getByText } = render(<AfycSheet {...makeProps()} />);
        expect(getByText('AFYC')).toBeTruthy();
        // Displays $1,500 formatted
        expect(getByText(/1,500/)).toBeTruthy();
    });

    it('calls handleLogCaseClosed on confirm press', () => {
        const handleLogCaseClosed = jest.fn();
        const AfycSheet = getSheet();
        const { getByText } = render(<AfycSheet {...makeProps({ handleLogCaseClosed })} />);
        fireEvent.press(getByText('Log the close'));
        expect(handleLogCaseClosed).toHaveBeenCalledTimes(1);
    });

    it('hides confirm label when loggingActivity is true', () => {
        const AfycSheet = getSheet();
        const { queryByText } = render(<AfycSheet {...makeProps({ loggingActivity: true })} />);
        expect(queryByText('Log the close')).toBeNull();
    });

    it('shows quick-pick amounts', () => {
        const AfycSheet = getSheet();
        const { getByText } = render(<AfycSheet {...makeProps()} />);
        // Prototype quick picks: 1000, 1800, 2400, 3600, 6000
        expect(getByText('$1,000')).toBeTruthy();
        expect(getByText('$2,400')).toBeTruthy();
        expect(getByText('$6,000')).toBeTruthy();
    });

    it('sets afyc when quick pick tapped', () => {
        const setAfycInput = jest.fn();
        const AfycSheet = getSheet();
        const { getByText } = render(<AfycSheet {...makeProps({ setAfycInput })} />);
        fireEvent.press(getByText('$2,400'));
        expect(setAfycInput).toHaveBeenCalledWith('2400');
    });
});

// ── ManagerOverrideSheet ───────────────────────────────────────

describe('ManagerOverrideSheet', () => {
    const getSheet = () => require('@/components/events/ManagerOverrideSheet').ManagerOverrideSheet;

    const targetAttendee = {
        id: 'att-1',
        event_id: 'evt-1',
        user_id: 'u-agent',
        attendee_role: 'attendee' as const,
        full_name: 'John Agent',
    };

    function makeProps(overrides: Record<string, any> = {}) {
        return {
            colors,
            overrideTarget: targetAttendee,
            setOverrideTarget: jest.fn(),
            overrideTime: '10:15 AM',
            setOverrideTime: jest.fn(),
            overrideLateReason: '',
            setOverrideLateReason: jest.fn(),
            overridePledgeSitdowns: 4,
            setOverridePledgeSitdowns: jest.fn(),
            overridePledgePitches: 2,
            setOverridePledgePitches: jest.fn(),
            overridePledgeClosed: 1,
            setOverridePledgeClosed: jest.fn(),
            overridePledgeAfyc: '3000',
            setOverridePledgeAfyc: jest.fn(),
            overrideSubmitting: false,
            overrideError: null,
            handleConfirmOverride: jest.fn(),
            userFullName: 'Manager Lee',
            ...overrides,
        };
    }

    beforeEach(() => jest.clearAllMocks());

    it('renders editorial title referencing Override check-in', () => {
        const ManagerOverrideSheet = getSheet();
        const { getByText } = render(<ManagerOverrideSheet {...makeProps()} />);
        expect(getByText(/Override/)).toBeTruthy();
        expect(getByText('check-in')).toBeTruthy();
    });

    it('is hidden when overrideTarget is null', () => {
        const ManagerOverrideSheet = getSheet();
        const { queryByText } = render(<ManagerOverrideSheet {...makeProps({ overrideTarget: null })} />);
        expect(queryByText(/Override/)).toBeNull();
    });

    it('shows override-by note with manager name', () => {
        const ManagerOverrideSheet = getSheet();
        const { getByText } = render(<ManagerOverrideSheet {...makeProps()} />);
        expect(getByText(/Recorded as override by Manager Lee/)).toBeTruthy();
    });

    it('shows pledge stepper labels (uppercased per new stepper design)', () => {
        const ManagerOverrideSheet = getSheet();
        const { getByText } = render(<ManagerOverrideSheet {...makeProps()} />);
        expect(getByText('SITDOWNS')).toBeTruthy();
        expect(getByText('PITCHES')).toBeTruthy();
        expect(getByText('CLOSES')).toBeTruthy();
    });

    it('shows pledge stepper values', () => {
        const ManagerOverrideSheet = getSheet();
        const { getByText } = render(<ManagerOverrideSheet {...makeProps()} />);
        expect(getByText('4')).toBeTruthy();
        expect(getByText('2')).toBeTruthy();
        expect(getByText('1')).toBeTruthy();
    });

    it('shows arrival time input with current value', () => {
        const ManagerOverrideSheet = getSheet();
        const { getByDisplayValue } = render(<ManagerOverrideSheet {...makeProps()} />);
        expect(getByDisplayValue('10:15 AM')).toBeTruthy();
    });

    it('shows AFYC target input with current value', () => {
        const ManagerOverrideSheet = getSheet();
        const { getByDisplayValue } = render(<ManagerOverrideSheet {...makeProps()} />);
        expect(getByDisplayValue('3000')).toBeTruthy();
    });

    it('calls handleConfirmOverride on confirm button press', () => {
        const handleConfirmOverride = jest.fn();
        const ManagerOverrideSheet = getSheet();
        const { getByText } = render(<ManagerOverrideSheet {...makeProps({ handleConfirmOverride })} />);
        fireEvent.press(getByText('Confirm override'));
        expect(handleConfirmOverride).toHaveBeenCalledTimes(1);
    });

    it('hides confirm label when overrideSubmitting is true', () => {
        const ManagerOverrideSheet = getSheet();
        const { queryByText } = render(<ManagerOverrideSheet {...makeProps({ overrideSubmitting: true })} />);
        expect(queryByText('Confirm override')).toBeNull();
    });

    it('shows error banner when overrideError is set', () => {
        const ManagerOverrideSheet = getSheet();
        const { getByText } = render(<ManagerOverrideSheet {...makeProps({ overrideError: 'Failed to check in' })} />);
        expect(getByText('Failed to check in')).toBeTruthy();
    });

    it('hides error banner when overrideError is null', () => {
        const ManagerOverrideSheet = getSheet();
        const { queryByText } = render(<ManagerOverrideSheet {...makeProps({ overrideError: null })} />);
        expect(queryByText('Failed to check in')).toBeNull();
    });

    it('shows late reason field label', () => {
        const ManagerOverrideSheet = getSheet();
        const { getByText } = render(<ManagerOverrideSheet {...makeProps()} />);
        expect(getByText('LATE REASON (OPTIONAL)')).toBeTruthy();
    });

    it('shows pledge-on-behalf section header', () => {
        const ManagerOverrideSheet = getSheet();
        const { getByText } = render(<ManagerOverrideSheet {...makeProps()} />);
        expect(getByText('PLEDGE ON THEIR BEHALF')).toBeTruthy();
    });
});
