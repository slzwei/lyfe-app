import React from 'react';
import { render } from '@testing-library/react-native';
import { RoadshowLeaderboard, RoadshowActivityFeed } from '@/components/events/RoadshowShared';
import type { LeaderboardEntry } from '@/components/events/RoadshowShared';
import type { RoadshowActivity } from '@/types/event';

jest.mock('@/components/Avatar', () => {
    const { View } = require('react-native');
    return function MockAvatar() {
        return <View testID="avatar" />;
    };
});

jest.mock('@/lib/dateTime', () => ({
    formatCheckinTime: jest.fn((iso: string) => '10:30 AM'),
}));

jest.mock('@/constants/ui', () => ({
    activityLabel: jest.fn((type: string) => {
        const map: Record<string, string> = {
            sitdown: 'Sitdown',
            pitch: 'Pitch',
            case_closed: 'Case Closed',
            check_in: 'Check In',
            departure: 'Departure',
        };
        return map[type] ?? type;
    }),
    activityTypeColor: jest.fn((_type: string, fallback: string) => fallback),
    getAvatarColor: jest.fn(() => '#6366F1'),
    ROADSHOW_PINK: '#EC4899',
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
} as any;

const makeLeaderboardEntry = (overrides?: Partial<LeaderboardEntry>): LeaderboardEntry => ({
    id: 'a1',
    event_id: 'e1',
    user_id: 'u1',
    attendee_role: 'attendee',
    full_name: 'Alice Tan',
    sitdowns: 5,
    pitches: 3,
    closed: 1,
    afyc: 2000,
    isCheckedIn: true,
    ...overrides,
});

const makeActivity = (overrides?: Partial<RoadshowActivity>): RoadshowActivity => ({
    id: 'act-1',
    event_id: 'e1',
    user_id: 'u1',
    full_name: 'Alice Tan',
    type: 'sitdown',
    afyc_amount: null,
    logged_at: '2026-03-08T10:30:00Z',
    ...overrides,
});

beforeEach(() => jest.clearAllMocks());

describe('RoadshowLeaderboard', () => {
    it('renders ranked agents with correct labels', () => {
        const entries = [
            makeLeaderboardEntry({ id: 'a1', user_id: 'u1', full_name: 'Alice Tan', sitdowns: 5 }),
            makeLeaderboardEntry({ id: 'a2', user_id: 'u2', full_name: 'Bob Lee', sitdowns: 3 }),
        ];
        const { getByText } = render(<RoadshowLeaderboard colors={COLORS} leaderboard={entries} userId="u2" />);

        expect(getByText('Booth Leaderboard')).toBeTruthy();
        expect(getByText('Alice Tan')).toBeTruthy();
        expect(getByText('Bob Lee')).toBeTruthy();
    });

    it('highlights current user row via accessibility label', () => {
        const entries = [
            makeLeaderboardEntry({
                id: 'a1',
                user_id: 'u1',
                full_name: 'Alice Tan',
                sitdowns: 5,
                pitches: 3,
                closed: 1,
                afyc: 2000,
            }),
        ];
        const { getByLabelText } = render(<RoadshowLeaderboard colors={COLORS} leaderboard={entries} userId="u1" />);

        expect(getByLabelText('Rank 1, Alice Tan, 5 sitdowns, 3 pitches, 1 case closed, $2000 AFYC')).toBeTruthy();
    });

    it('shows empty message when no entries', () => {
        const { getByText } = render(<RoadshowLeaderboard colors={COLORS} leaderboard={[]} userId="u1" />);

        expect(getByText('No activity logged yet.')).toBeTruthy();
    });
});

describe('RoadshowActivityFeed', () => {
    it('renders activity entries', () => {
        const activities = [
            makeActivity({ id: 'act-1', type: 'sitdown', full_name: 'Alice Tan' }),
            makeActivity({ id: 'act-2', type: 'pitch', full_name: 'Bob Lee' }),
        ];
        const { getByText } = render(<RoadshowActivityFeed colors={COLORS} activities={activities} />);

        expect(getByText('Activity Feed')).toBeTruthy();
        expect(getByText('Alice Tan')).toBeTruthy();
        expect(getByText('Bob Lee')).toBeTruthy();
        expect(getByText('Sitdown')).toBeTruthy();
        expect(getByText('Pitch')).toBeTruthy();
    });

    it('shows empty message when no activities', () => {
        const { getByText } = render(<RoadshowActivityFeed colors={COLORS} activities={[]} />);

        expect(getByText('No activities yet.')).toBeTruthy();
    });

    it('shows case_closed with AFYC amount', () => {
        const activities = [makeActivity({ id: 'act-1', type: 'case_closed', afyc_amount: 5000 })];
        const { getByText } = render(<RoadshowActivityFeed colors={COLORS} activities={activities} />);

        expect(getByText('Closed $5,000 AFYC')).toBeTruthy();
    });
});
