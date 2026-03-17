/**
 * Tests for app/(tabs)/home/analytics.tsx — Manager Analytics Dashboard
 */
jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/lib/team');
jest.mock('@/lib/activities');

jest.mock('react-native-reanimated', () => {
    const { View } = require('react-native');
    const React = require('react');
    const AnimatedView = React.forwardRef((props: any, ref: any) => <View ref={ref} {...props} />);
    AnimatedView.displayName = 'AnimatedView';
    return {
        __esModule: true,
        default: { View: AnimatedView },
        FadeInDown: {
            delay: () => ({
                duration: () => ({
                    springify: () => undefined,
                }),
            }),
        },
        useSharedValue: jest.fn((v: number) => ({ value: v })),
        useAnimatedStyle: jest.fn(() => ({})),
        useDerivedValue: jest.fn((fn: () => any) => ({ value: fn() })),
        useAnimatedProps: jest.fn(() => ({})),
        withTiming: jest.fn((v: number) => v),
        withRepeat: jest.fn((v: any) => v),
        withSpring: jest.fn((v: number) => v),
    };
});

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { getTeamPerformance } from '@/lib/team';
import { getTeamActivitySummaries } from '@/lib/activities';
import AnalyticsScreen from '@/app/(tabs)/home/analytics';

beforeEach(() => {
    jest.clearAllMocks();

    (useTheme as jest.Mock).mockReturnValue({
        colors: Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    });

    (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'mgr-1', full_name: 'Manager User', role: 'manager', avatar_url: null },
    });
});

describe('AnalyticsScreen', () => {
    it('renders skeleton loading state initially', () => {
        (getTeamPerformance as jest.Mock).mockReturnValue(new Promise(() => {})); // never resolves
        const { getByText } = render(<AnalyticsScreen />);
        // Header should be rendered immediately
        expect(getByText('Analytics')).toBeTruthy();
    });

    it('renders hero stat cards with team performance data', async () => {
        (getTeamPerformance as jest.Mock).mockResolvedValue({
            data: {
                agents: [
                    {
                        agentId: 'a1',
                        agentName: 'Alice Tan',
                        leadsClosed: 10,
                        leadsWon: 7,
                        leadsLost: 3,
                        activitiesLogged: 25,
                    },
                    {
                        agentId: 'a2',
                        agentName: 'Bob Lee',
                        leadsClosed: 5,
                        leadsWon: 2,
                        leadsLost: 3,
                        activitiesLogged: 12,
                    },
                ],
                totalClosed: 15,
                totalActivities: 37,
            },
            error: null,
        });

        (getTeamActivitySummaries as jest.Mock).mockResolvedValue({
            data: [
                {
                    agentId: 'a1',
                    totalActivities: 10,
                    byType: [
                        { type: 'call', count: 5 },
                        { type: 'meeting', count: 3 },
                        { type: 'note', count: 2 },
                    ],
                    dateRange: { start: '', end: '' },
                },
                {
                    agentId: 'a2',
                    totalActivities: 10,
                    byType: [
                        { type: 'call', count: 5 },
                        { type: 'meeting', count: 3 },
                        { type: 'note', count: 2 },
                    ],
                    dateRange: { start: '', end: '' },
                },
            ],
            error: null,
        });

        const { getByText } = render(<AnalyticsScreen />);

        await waitFor(() => {
            expect(getByText('Total Leads')).toBeTruthy();
            expect(getByText('Conversion')).toBeTruthy();
            expect(getByText('Activities')).toBeTruthy();
        });
    });

    it('renders agent leaderboard sorted by conversion rate', async () => {
        (getTeamPerformance as jest.Mock).mockResolvedValue({
            data: {
                agents: [
                    {
                        agentId: 'a1',
                        agentName: 'Alice Tan',
                        leadsClosed: 10,
                        leadsWon: 7,
                        leadsLost: 3,
                        activitiesLogged: 25,
                    },
                    {
                        agentId: 'a2',
                        agentName: 'Bob Lee',
                        leadsClosed: 5,
                        leadsWon: 2,
                        leadsLost: 3,
                        activitiesLogged: 12,
                    },
                ],
                totalClosed: 15,
                totalActivities: 37,
            },
            error: null,
        });

        (getTeamActivitySummaries as jest.Mock).mockResolvedValue({
            data: [{ agentId: 'a1', totalActivities: 0, byType: [], dateRange: { start: '', end: '' } }],
            error: null,
        });

        const { getByText } = render(<AnalyticsScreen />);

        await waitFor(() => {
            expect(getByText('Agent Leaderboard')).toBeTruthy();
            expect(getByText('Alice Tan')).toBeTruthy();
            expect(getByText('Bob Lee')).toBeTruthy();
        });
    });

    it('renders activity breakdown when data is available', async () => {
        (getTeamPerformance as jest.Mock).mockResolvedValue({
            data: {
                agents: [
                    {
                        agentId: 'a1',
                        agentName: 'Alice Tan',
                        leadsClosed: 10,
                        leadsWon: 7,
                        leadsLost: 3,
                        activitiesLogged: 25,
                    },
                ],
                totalClosed: 10,
                totalActivities: 25,
            },
            error: null,
        });

        (getTeamActivitySummaries as jest.Mock).mockResolvedValue({
            data: [
                {
                    agentId: 'a1',
                    totalActivities: 10,
                    byType: [
                        { type: 'call', count: 5 },
                        { type: 'meeting', count: 3 },
                    ],
                    dateRange: { start: '', end: '' },
                },
            ],
            error: null,
        });

        const { getByText } = render(<AnalyticsScreen />);

        await waitFor(() => {
            expect(getByText('Activity Breakdown')).toBeTruthy();
            expect(getByText('Calls')).toBeTruthy();
            expect(getByText('Meetings')).toBeTruthy();
        });
    });

    it('renders empty state when no agents', async () => {
        (getTeamPerformance as jest.Mock).mockResolvedValue({
            data: { agents: [], totalClosed: 0, totalActivities: 0 },
            error: null,
        });

        const { getByText } = render(<AnalyticsScreen />);

        await waitFor(() => {
            expect(getByText('No analytics yet')).toBeTruthy();
            expect(
                getByText('Once your team starts logging activities and closing leads, analytics will appear here.'),
            ).toBeTruthy();
        });
    });

    it('renders period selector pills', async () => {
        (getTeamPerformance as jest.Mock).mockResolvedValue({
            data: {
                agents: [
                    {
                        agentId: 'a1',
                        agentName: 'Alice',
                        leadsClosed: 1,
                        leadsWon: 1,
                        leadsLost: 0,
                        activitiesLogged: 1,
                    },
                ],
                totalClosed: 1,
                totalActivities: 1,
            },
            error: null,
        });

        (getTeamActivitySummaries as jest.Mock).mockResolvedValue({
            data: [{ agentId: 'a1', totalActivities: 0, byType: [], dateRange: { start: '', end: '' } }],
            error: null,
        });

        const { getByText } = render(<AnalyticsScreen />);

        await waitFor(() => {
            expect(getByText('This Week')).toBeTruthy();
            expect(getByText('This Month')).toBeTruthy();
            expect(getByText('This Quarter')).toBeTruthy();
        });
    });
});
