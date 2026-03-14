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
    formatCheckinTime: jest.fn((iso: string) => '9:05 AM'),
}));

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
    successLight: '#D1FAE5',
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
    it('renders attendance list with agent names', () => {
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

        expect(getByText('Attendance')).toBeTruthy();
        expect(getByText('2/3')).toBeTruthy();
        // Names appear in both attendance and results table, so use getAllByText
        expect(getAllByText('Alice Tan').length).toBeGreaterThanOrEqual(1);
        expect(getAllByText('Bob Lee').length).toBeGreaterThanOrEqual(1);
    });

    it('renders results table with totals row', () => {
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

        expect(getByText('Results vs Pledges')).toBeTruthy();
        expect(getByText('TOTAL')).toBeTruthy();
        // sitdowns 3/4 appears for agent row and total row — use getAllByText
        expect(getAllByText('3/4').length).toBeGreaterThanOrEqual(1);
    });

    it('renders cost summary when config exists', () => {
        const { getByText } = render(
            <RoadshowPast
                colors={COLORS}
                roadshowConfig={makeConfig()}
                attendance={[makeAttendance()]}
                activityCounts={defaultCounts}
                totalAttendees={1}
            />,
        );

        expect(getByText('Cost Summary')).toBeTruthy();
        expect(getByText('$700.00')).toBeTruthy();
        expect(getByText('$140.00')).toBeTruthy();
        expect(getByText('$28.00')).toBeTruthy();
    });

    it('handles empty attendance', () => {
        const { getByText, queryByText } = render(
            <RoadshowPast
                colors={COLORS}
                roadshowConfig={makeConfig()}
                attendance={[]}
                activityCounts={defaultCounts}
                totalAttendees={3}
            />,
        );

        expect(getByText('0/3')).toBeTruthy();
        expect(queryByText('TOTAL')).toBeNull();
    });
});
