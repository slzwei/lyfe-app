/**
 * Tests for app/(tabs)/home/index.tsx — Home screen role-based rendering
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import { Colors } from '@/constants/Colors';
import { fetchLeadStats, fetchRecentActivities, fetchManagerDashboardStats } from '@/lib/leads';
import { fetchUpcomingEvents } from '@/lib/events';
import { fetchPAManagerIds, fetchPACandidateCount, fetchPAInterviewCount } from '@/lib/recruitment';
import { fetchCandidateRoadmap, getCandidateIdForUser } from '@/lib/roadmap';
import * as biometrics from '@/lib/biometrics';
import HomeScreen from '@/app/(tabs)/home/index';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/contexts/ViewModeContext');
jest.mock('@/contexts/NotificationContext', () => ({
    useNotifications: () => ({
        unreadCount: 0,
        refreshUnreadCount: jest.fn(),
        markAsRead: jest.fn(),
        markAllAsRead: jest.fn(),
    }),
}));
jest.mock('@/hooks/useTypedRouter');
jest.mock('@/lib/leads');
jest.mock('@/lib/events');
jest.mock('@/lib/recruitment');
jest.mock('@/lib/roadmap');
jest.mock('@/lib/biometrics');

const mockPush = jest.fn();
const mockBio = biometrics as jest.Mocked<typeof biometrics>;

// Defaults
beforeEach(() => {
    jest.clearAllMocks();

    (useTheme as jest.Mock).mockReturnValue({
        colors: Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    });
    (useTypedRouter as jest.Mock).mockReturnValue({
        push: mockPush,
        replace: jest.fn(),
        back: jest.fn(),
    });

    // Default: no biometrics prompt
    mockBio.isBiometricsAvailable.mockResolvedValue(false);
    mockBio.isBiometricsEnabled.mockResolvedValue(false);
    mockBio.hasShownBiometricsPrompt.mockResolvedValue(true);
    mockBio.getBiometryType.mockResolvedValue('none');
    mockBio.biometricMeta.mockImplementation((type: string) => {
        const map: Record<string, { label: string; icon: string }> = {
            faceid: { label: 'Face ID', icon: 'scan' },
            touchid: { label: 'Touch ID', icon: 'finger-print' },
            biometric: { label: 'Biometrics', icon: 'lock-closed' },
        };
        return map[type] || { label: '', icon: '' };
    });

    // Default service mocks
    (fetchLeadStats as jest.Mock).mockResolvedValue({
        data: {
            totalLeads: 10,
            newThisWeek: 2,
            conversionRate: 25,
            activeFollowUps: 3,
            pipeline: [
                { status: 'new', count: 3 },
                { status: 'contacted', count: 2 },
                { status: 'qualified', count: 2 },
                { status: 'proposed', count: 1 },
                { status: 'won', count: 1 },
                { status: 'lost', count: 1 },
            ],
        },
        error: null,
    });
    (fetchRecentActivities as jest.Mock).mockResolvedValue({ data: [], error: null });
    (fetchManagerDashboardStats as jest.Mock).mockResolvedValue({
        data: { activeCandidates: 5, agentsManaged: 3 },
        error: null,
    });
    (fetchUpcomingEvents as jest.Mock).mockResolvedValue({ data: [], error: null });
    (fetchPAManagerIds as jest.Mock).mockResolvedValue([]);
    (fetchPACandidateCount as jest.Mock).mockResolvedValue(0);
    (fetchPAInterviewCount as jest.Mock).mockResolvedValue(0);
    (getCandidateIdForUser as jest.Mock).mockResolvedValue('candidate-record-id');
    (fetchCandidateRoadmap as jest.Mock).mockResolvedValue({
        data: [
            {
                id: 'prog-1',
                title: 'SeedLYFE',
                icon_type: 'seedling',
                percentage: 40,
                completedCount: 2,
                totalCount: 5,
                isLocked: false,
                manuallyUnlocked: false,
                unlockedByName: null,
                modules: [
                    {
                        id: 'mod-exam-1',
                        title: 'Module 5 Exam',
                        module_type: 'exam',
                        isLocked: false,
                        progress: null,
                        examPaper: { code: 'M5', title: 'Module 5', pass_percentage: 70 },
                        resources: [],
                        itemSummary: null,
                        prerequisiteIds: [],
                        isArchived: false,
                    },
                ],
            },
        ],
        error: null,
    });
});

function setupRole(role: string, viewMode: 'agent' | 'manager' = 'agent') {
    const canToggle = role === 'manager' || role === 'director';
    (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'user-1', full_name: 'Test User', role, avatar_url: null },
        enableBiometrics: jest.fn(),
    });
    (useViewMode as jest.Mock).mockReturnValue({
        viewMode: canToggle ? viewMode : 'agent',
        canToggle,
        setViewMode: jest.fn(),
        isReady: true,
    });
}

describe('HomeScreen', () => {
    // ── Agent view ──

    it('renders agent dashboard with lead stats', async () => {
        setupRole('agent');
        const { getByText } = render(<HomeScreen />);
        await waitFor(() => {
            expect(getByText('Total Leads')).toBeTruthy();
            expect(getByText('10')).toBeTruthy();
        });
        expect(getByText('Total Leads')).toBeTruthy();
    });

    it('shows upcoming events for agent', async () => {
        setupRole('agent');
        const { getByText } = render(<HomeScreen />);
        await waitFor(() => {
            expect(getByText('My Events')).toBeTruthy();
        });
    });

    // ── Manager view ──

    it('renders manager dashboard with team stats', async () => {
        setupRole('manager', 'manager');
        const { getByText, getAllByText } = render(<HomeScreen />);
        await waitFor(() => {
            expect(getByText('Team Leads')).toBeTruthy();
            expect(getAllByText('Candidates').length).toBeGreaterThanOrEqual(1);
            expect(getByText('Agents')).toBeTruthy();
        });
    });

    // ── Candidate view ──

    it('renders candidate dashboard with roadmap progress', async () => {
        setupRole('candidate');
        const { getByText, getAllByText, queryByText } = render(<HomeScreen />);
        await waitFor(() => {
            expect(getByText('Roadmap Progress')).toBeTruthy();
            expect(getAllByText('SeedLYFE').length).toBeGreaterThanOrEqual(1);
            expect(getByText('2 of 5 modules completed')).toBeTruthy();
        });
        // Pipeline and activity should be hidden
        expect(queryByText('Lead Pipeline')).toBeNull();
        expect(queryByText('Recent Activity')).toBeNull();
    });

    it('shows upcoming events for candidate', async () => {
        setupRole('candidate');
        const { getByText } = render(<HomeScreen />);
        await waitFor(() => {
            expect(getByText('Upcoming Events')).toBeTruthy();
        });
    });

    // ── PA view ──

    it('renders PA dashboard with candidate count', async () => {
        setupRole('pa');
        (fetchPAManagerIds as jest.Mock).mockResolvedValue(['mgr-1']);
        (fetchPACandidateCount as jest.Mock).mockResolvedValue(8);
        (fetchPAInterviewCount as jest.Mock).mockResolvedValue(3);

        const { getAllByText, queryByText } = render(<HomeScreen />);
        await waitFor(() => {
            expect(getAllByText('Candidates').length).toBeGreaterThanOrEqual(1);
            expect(getAllByText('8').length).toBeGreaterThanOrEqual(1);
            expect(getAllByText('Interviews').length).toBeGreaterThanOrEqual(1);
        });
        // Pipeline and activity should be hidden for PA
        expect(queryByText('Lead Pipeline')).toBeNull();
        expect(queryByText('Recent Activity')).toBeNull();
    });

    it('shows PA events section', async () => {
        setupRole('pa');
        (fetchUpcomingEvents as jest.Mock).mockResolvedValue({
            data: [
                {
                    id: 'evt-1',
                    title: 'Team Standup',
                    event_type: 'team_meeting',
                    event_date: '2026-03-15',
                    start_time: '09:00',
                    end_time: '10:00',
                    location: 'Office',
                    attendees: [],
                },
            ],
            error: null,
        });

        const { getByText } = render(<HomeScreen />);
        await waitFor(() => {
            expect(getByText('My Events')).toBeTruthy();
            expect(getByText('Team Standup')).toBeTruthy();
        });
    });

    it('shows "No upcoming events" when PA has no events', async () => {
        setupRole('pa');
        const { getByText } = render(<HomeScreen />);
        await waitFor(() => {
            expect(getByText('No upcoming events')).toBeTruthy();
        });
    });

    // ── Greeting ──

    it('shows greeting with first name', async () => {
        setupRole('agent');
        const { getByText } = render(<HomeScreen />);
        await waitFor(() => {
            expect(getByText(/Test/)).toBeTruthy(); // "Good morning/afternoon/evening, Test"
        });
    });

    // ── Profile navigation ──

    it('has profile avatar button', async () => {
        setupRole('agent');
        const { getByLabelText } = render(<HomeScreen />);
        await waitFor(() => {
            expect(getByLabelText('Go to profile')).toBeTruthy();
        });
    });
});
