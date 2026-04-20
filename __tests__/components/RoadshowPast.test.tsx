import React from 'react';
import { render } from '@testing-library/react-native';
import { RoadshowPast } from '@/components/events/RoadshowPast';
import type { RoadshowAttendance, RoadshowConfig } from '@/types/event';

jest.mock('@/components/Avatar', () => {
    const { View } = require('react-native');
    return function MockAvatar() {
        return <View testID="avatar" />;
    };
});

jest.mock('@/lib/dateTime', () => ({
    formatCheckinTime: jest.fn((_iso: string) => '9:05 AM'),
}));

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
    successLight: '#D1FAE5',
    tintTerra: '#F7E7DC',
    tintSage: '#E8EDE0',
    tintButter: '#F7ECCF',
    tintPink: '#F2E0E7',
} as any;

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

const defaultCounts = () => ({ sitdowns: 3, pitches: 1, closed: 1, afyc: 1500 });

beforeEach(() => jest.clearAllMocks());

describe('RoadshowPast', () => {
    it('renders leaderboard with agent names', () => {
        const att = [makeAttendance(), makeAttendance({ id: 'att-2', user_id: 'u2', full_name: 'Bob Lee' })];
        const { getAllByText, getByText } = render(
            <RoadshowPast
                colors={COLORS}
                roadshowConfig={makeConfig()}
                attendance={att}
                activityCounts={defaultCounts}
                totalAttendees={3}
            />,
        );

        // Editorial leaderboard eyebrow
        expect(getByText(/LEADERBOARD/)).toBeTruthy();
        // Ranked row renders both agents
        expect(getAllByText('Alice Tan').length).toBeGreaterThanOrEqual(1);
        expect(getAllByText('Bob Lee').length).toBeGreaterThanOrEqual(1);
        // Attendance ratio in eyebrow row
        expect(getByText(/2\/3/)).toBeTruthy();
    });

    it('renders leaderboard stats per agent', () => {
        const att = [makeAttendance()];
        const { getByText, getAllByText } = render(
            <RoadshowPast
                colors={COLORS}
                roadshowConfig={makeConfig()}
                attendance={att}
                activityCounts={defaultCounts}
                totalAttendees={1}
            />,
        );

        // Ranked row renders "3 sits · 1 pitch · 1 close"
        expect(getByText(/3 sits/)).toBeTruthy();
        // Dollar amount renders in leaderboard trail AND hero stat
        expect(getAllByText(/1,500/).length).toBeGreaterThanOrEqual(1);
    });

    it('renders cost summary when config exists', () => {
        const { getByText, getAllByText } = render(
            <RoadshowPast
                colors={COLORS}
                roadshowConfig={makeConfig()}
                attendance={[makeAttendance()]}
                activityCounts={defaultCounts}
                totalAttendees={1}
            />,
        );

        expect(getByText('COST SUMMARY')).toBeTruthy();
        expect(getByText('$700')).toBeTruthy();
        // $140 shows in both hero "cost $140" and cost summary row
        expect(getAllByText('$140').length).toBeGreaterThanOrEqual(1);
        expect(getByText('$28.00')).toBeTruthy();
    });

    it('handles empty attendance gracefully', () => {
        const { getByText } = render(
            <RoadshowPast
                colors={COLORS}
                roadshowConfig={makeConfig()}
                attendance={[]}
                activityCounts={defaultCounts}
                totalAttendees={3}
            />,
        );

        expect(getByText(/0\/3/)).toBeTruthy();
        expect(getByText('No one checked in.')).toBeTruthy();
    });
});
