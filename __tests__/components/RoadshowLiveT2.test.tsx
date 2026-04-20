import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { RoadshowLiveT2 } from '@/components/events/RoadshowLiveT2';
import type { RoadshowLiveT2Props } from '@/components/events/RoadshowLiveT2';
import type { AgencyEvent, EventAttendee, RoadshowAttendance, RoadshowConfig } from '@/types/event';

jest.mock('@/components/roadshow/atoms/PledgeRing', () => {
    const { View, Text } = require('react-native');
    return {
        PledgeRing: function MockPledgeRing({ label, value, pledge }: any) {
            return (
                <View accessibilityLabel={`${label}: ${value} of ${pledge}`}>
                    <Text>{label}</Text>
                </View>
            );
        },
    };
});

jest.mock('@/components/Avatar', () => {
    const { View } = require('react-native');
    return function MockAvatar() {
        return <View testID="avatar" />;
    };
});

jest.mock('@/lib/dateTime', () => ({
    formatCheckinTime: jest.fn(() => '9:05 AM'),
}));

jest.mock('@/constants/ui', () => ({
    ERROR_BG: '#FEE2E2',
    ERROR_TEXT: '#DC2626',
    getAvatarColor: jest.fn(() => '#6366F1'),
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
    accentDark: '#0055BB',
    cardBackground: '#FFFFFF',
    cardBorder: '#E0E0E0',
    background: '#F5F5F5',
    border: '#E0E0E0',
    hairline: '#E0E0E0',
    surfacePrimary: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    success: '#34C759',
    error: '#FF3B30',
    warning: '#EAB308',
    warningLight: '#FFF3CD',
    info: '#007AFF',
    infoLight: '#E0F0FF',
    inputBackground: '#F9F9F9',
    inputBorder: '#E0E0E0',
    surfaceSecondary: '#F0F0F0',
    tintTerra: '#F7E7DC',
    tintSage: '#E8EDE0',
    tintButter: '#F7ECCF',
    tintPink: '#F2E0E7',
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

const makeAttendee = (overrides?: Partial<EventAttendee>): EventAttendee => ({
    id: 'ea1',
    event_id: 'e1',
    user_id: 'u1',
    attendee_role: 'attendee',
    full_name: 'Alice Tan',
    avatar_url: null,
    ...overrides,
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

const makeEvent = (attendees: EventAttendee[]): AgencyEvent =>
    ({
        id: 'e1',
        title: 'Roadshow Test',
        description: null,
        event_type: 'roadshow',
        event_date: '2026-03-08',
        start_time: '09:00',
        end_time: '17:00',
        location: 'Test Mall',
        latitude: null,
        longitude: null,
        location_radius_meters: null,
        created_by: 'admin1',
        creator_name: 'Admin',
        created_at: '2026-03-01T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z',
        attendees,
        external_attendees: [],
    }) as unknown as AgencyEvent;

function makeDefaultProps(overrides?: Partial<RoadshowLiveT2Props>): RoadshowLiveT2Props {
    const agents = [
        makeAttendee({ id: 'ea1', user_id: 'u1', full_name: 'Alice Tan' }),
        makeAttendee({ id: 'ea2', user_id: 'u2', full_name: 'Bob Lee' }),
    ];
    return {
        colors: COLORS,
        event: makeEvent(agents),
        attendance: [makeAttendance({ user_id: 'u1' })],
        activityCounts: jest.fn(() => ({ sitdowns: 2, pitches: 1, closed: 0, afyc: 500 })),
        boothTotals: {
            sitdowns: 5,
            pitches: 3,
            closed: 1,
            afyc: 1500,
            pledgedSitdowns: 8,
            pledgedPitches: 4,
            pledgedClosed: 2,
            pledgedAfyc: 4000,
        },
        roadshowConfig: makeConfig(),
        overrideTarget: null,
        setOverrideTarget: jest.fn(),
        overrideTime: '',
        setOverrideTime: jest.fn(),
        overrideLateReason: '',
        setOverrideLateReason: jest.fn(),
        overridePledgeSitdowns: 0,
        setOverridePledgeSitdowns: jest.fn(),
        overridePledgePitches: 0,
        setOverridePledgePitches: jest.fn(),
        overridePledgeClosed: 0,
        setOverridePledgeClosed: jest.fn(),
        overridePledgeAfyc: '',
        setOverridePledgeAfyc: jest.fn(),
        overrideSubmitting: false,
        overrideError: null,
        openOverride: jest.fn(),
        handleConfirmOverride: jest.fn(),
        userFullName: 'Manager Name',
        ...overrides,
    };
}

beforeEach(() => jest.clearAllMocks());

describe('RoadshowLiveT2', () => {
    it('renders team AFYC hero with progress bars', () => {
        const props = makeDefaultProps();
        const { getByText, getByLabelText } = render(<RoadshowLiveT2 {...props} />);

        expect(getByText('TEAM AFYC')).toBeTruthy();
        // Booth totals render 3 sub-metric bars — PledgeRing mock picks these up via label
        // T2 currently uses inline bars in hero (no PledgeRing calls); assert metric labels instead.
        expect(getByText('SITS')).toBeTruthy();
        expect(getByText('PITCHES')).toBeTruthy();
        expect(getByText('CLOSES')).toBeTruthy();
        // Override label affordance
        expect(getByLabelText('Manual override check-in')).toBeTruthy();
    });

    it('renders agent roster with checked-in and not-checked-in states', () => {
        const props = makeDefaultProps();
        const { getByText } = render(<RoadshowLiveT2 {...props} />);

        expect(getByText(/AGENTS · 2/)).toBeTruthy();
        expect(getByText('Alice Tan')).toBeTruthy();
        expect(getByText('Bob Lee')).toBeTruthy();
        // Bob is not checked in → renders NOT IN marker
        expect(getByText('NOT IN')).toBeTruthy();
    });

    it('renders override trigger for unchecked-in agents', () => {
        const openOverride = jest.fn();
        const props = makeDefaultProps({ openOverride });
        const { getAllByText } = render(<RoadshowLiveT2 {...props} />);

        // Bob Lee has "Override →" trail affordance on his card
        const overrideTriggers = getAllByText(/Override →/);
        expect(overrideTriggers.length).toBeGreaterThanOrEqual(1);
        fireEvent.press(overrideTriggers[0]);
        expect(openOverride).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u2', full_name: 'Bob Lee' }));
    });

    it('shows attendance count in AGENTS eyebrow', () => {
        const props = makeDefaultProps();
        const { getByText } = render(<RoadshowLiveT2 {...props} />);
        // Roster eyebrow reflects total attendees (not just checked-in)
        expect(getByText(/AGENTS · 2/)).toBeTruthy();
    });

    it('renders cost label when config exists', () => {
        const props = makeDefaultProps();
        const { getByText } = render(<RoadshowLiveT2 {...props} />);

        expect(getByText(/cost today/i)).toBeTruthy();
    });
});
