/**
 * Smoke-test: render each major screen and assert it produces output without crashing.
 *
 * These tests intentionally mock every external dependency so the render path
 * exercises component trees, hooks, and layout code without hitting Supabase.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

// ── Core mocks (required by virtually every screen) ─────────────────────────

jest.mock('@/lib/supabase');

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        user: {
            id: 'u1',
            role: 'admin',
            full_name: 'Test',
            phone: '+6591234567',
            email: 'test@test.com',
            avatar_url: null,
        },
        isLoading: false,
        session: { access_token: 'test' },
        signOut: jest.fn(),
        biometricsEnabled: false,
        enableBiometrics: jest.fn().mockResolvedValue(true),
        disableBiometrics: jest.fn().mockResolvedValue(true),
        updateAvatarUrl: jest.fn(),
        updateProfile: jest.fn().mockResolvedValue({ error: null }),
    }),
    useProfile: () => ({
        profile: { id: 'u1', full_name: 'Test', role: 'admin', avatar_url: null },
        refreshUser: jest.fn(),
    }),
}));

jest.mock('@/contexts/ThemeContext', () => ({
    useTheme: () => ({
        colors: {
            background: '#fff',
            text: '#000',
            textPrimary: '#000',
            textSecondary: '#666',
            textTertiary: '#999',
            textInverse: '#fff',
            border: '#ccc',
            card: '#f5f5f5',
            cardBackground: '#f5f5f5',
            cardElevated: '#eee',
            accent: '#f60',
            accentLight: '#fff3e0',
            success: '#0c0',
            successLight: '#e8f5e9',
            error: '#c00',
            danger: '#c00',
            warning: '#fb0',
            info: '#09f',
            tint: '#007AFF',
            surfacePrimary: '#f5f5f5',
            surfaceSecondary: '#eee',
            statusProposed: '#9c27b0',
        },
        theme: 'light',
        mode: 'system',
        setMode: jest.fn(),
    }),
}));

jest.mock('@/contexts/ViewModeContext', () => ({
    useViewMode: () => ({ viewMode: 'manager', canToggle: true, setViewMode: jest.fn() }),
}));

jest.mock('@/contexts/NotificationContext', () => ({
    useNotifications: () => ({
        unreadCount: 0,
        refreshUnreadCount: jest.fn(),
        markAsRead: jest.fn().mockResolvedValue(undefined),
        markAllAsRead: jest.fn().mockResolvedValue(undefined),
    }),
}));

jest.mock('expo-router', () => ({
    useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
    useLocalSearchParams: () => ({}),
    useNavigation: () => ({ getParent: () => null }),
    router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
    useFocusEffect: (cb: () => void) => {
        const { useEffect } = require('react');
        useEffect(() => {
            const cleanup = cb();
            return typeof cleanup === 'function' ? cleanup : undefined;
        }, []);
    },
    Link: ({ children }: any) => children,
}));

jest.mock('@/lib/biometrics', () => ({
    getBiometryType: jest.fn().mockResolvedValue('none'),
    biometricMeta: jest.fn().mockReturnValue({ label: '', icon: 'lock-closed' }),
    isBiometricsEnabled: jest.fn().mockResolvedValue(false),
    isBiometricsAvailable: jest.fn().mockResolvedValue(false),
}));

// ── Lib / hook mocks shared across multiple screens ─────────────────────────

jest.mock('@/lib/notifications', () => ({
    fetchNotifications: jest.fn().mockResolvedValue({ data: [], error: null, hasMore: false }),
}));

jest.mock('@/lib/events', () => ({
    fetchEvents: jest.fn().mockResolvedValue({ data: [], error: null }),
    fetchAllEvents: jest.fn().mockResolvedValue({ data: [], error: null }),
}));

jest.mock('@/lib/leads', () => ({
    fetchLeads: jest.fn().mockResolvedValue({ data: [], error: null, hasMore: false }),
}));

jest.mock('@/lib/team', () => ({
    fetchTeamMembers: jest.fn().mockResolvedValue({ data: [], error: null }),
    fetchManagerOverview: jest.fn().mockResolvedValue({
        data: {
            manager: {
                id: 'mgr-1',
                name: 'Mei',
                role: 'manager',
                phone: '+6593333333',
                email: 'mei@example.com',
                avatarUrl: null,
                isActive: true,
                joinedDate: '2025-10-01T00:00:00Z',
                leadsCount: 0,
                openLeadsCount: 0,
                staleLeadsCount: 0,
                wonCount: 0,
                conversionRate: 0,
                lastLeadUpdatedAt: null,
                currentManagerId: null,
                currentManagerName: null,
                teamSize: 0,
                outstandingCandidatesCount: 0,
            },
            candidatePipeline: {
                outstandingTotal: 0,
                byStage: {},
                recentlyUpdated: [],
            },
            teamPerformance: {
                periodDays: 30,
                activitiesLogged: 0,
                leadsClosed: 0,
                leadsWon: 0,
                winRate: 0,
            },
            teamRoster: [],
        },
        error: null,
    }),
}));

jest.mock('@/lib/recruitment', () => ({
    fetchCandidates: jest.fn().mockResolvedValue({ data: [], error: null }),
    fetchPAManagers: jest.fn().mockResolvedValue([]),
    fetchPAManagerIds: jest.fn().mockResolvedValue([]),
    fetchPACandidateCount: jest.fn().mockResolvedValue(0),
    fetchPAInterviewCount: jest.fn().mockResolvedValue(0),
}));

jest.mock('@/lib/exams', () => ({
    fetchExamPapersWithAttempts: jest.fn().mockResolvedValue({ papers: [], stats: {}, error: null }),
}));

jest.mock('@/lib/roadmap', () => ({
    getCandidateIdForUser: jest.fn().mockResolvedValue(null),
    fetchCandidateRoadmap: jest.fn().mockResolvedValue({ programmes: [], error: null }),
    computeNodeStates: jest.fn().mockReturnValue(new Map()),
}));

jest.mock('@/lib/invitations', () => ({
    canInviteMembers: jest.fn().mockReturnValue(true),
}));

jest.mock('@/lib/storage', () => ({
    pickAndUploadAvatar: jest.fn().mockResolvedValue({ url: null, error: null }),
    removeAvatar: jest.fn().mockResolvedValue({ error: null }),
    takeAndUploadAvatar: jest.fn().mockResolvedValue({ url: null, error: null }),
}));

jest.mock('@/lib/dateTime', () => ({
    timeAgo: jest.fn().mockReturnValue('just now'),
    toDateStr: jest.fn().mockReturnValue('2026-03-31'),
    formatTime: jest.fn().mockReturnValue('9:00 AM'),
}));

jest.mock('@/lib/sentry', () => ({
    captureError: jest.fn(),
}));

// ── Hook mocks ──────────────────────────────────────────────────────────────

jest.mock('@/hooks/useTypedRouter', () => ({
    useTypedRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@/hooks/useLeadRealtime', () => ({
    useLeadRealtime: jest.fn(),
}));

jest.mock('@/hooks/useCandidateRealtime', () => ({
    useCandidateRealtime: jest.fn(),
}));

jest.mock('@/hooks/useCandidatePipeline', () => ({
    useCandidatePipeline: () => ({
        rows: [],
        counts: { 'at-risk': 0, 'this-week': 0, ready: 0, 'on-track': 0, hidden: 0 },
        isLoading: false,
        isRefreshing: false,
        error: null,
        refresh: jest.fn().mockResolvedValue(undefined),
    }),
}));

jest.mock('@/hooks/useFilteredList', () => ({
    useFilteredList: jest.fn().mockReturnValue({ filtered: [], counts: { all: 0 } }),
}));

jest.mock('@/hooks/useSubmitGuard', () => ({
    useSubmitGuard: () => ({ isSubmitting: false, guard: jest.fn((fn: any) => fn()) }),
}));

jest.mock('@/hooks/useRoadmap', () => ({
    useRoadmap: () => ({
        programmes: [],
        nodeStates: new Map(),
        isLoading: false,
        isRefreshing: false,
        error: null,
        refresh: jest.fn(),
        activeProgrammeIndex: 0,
        setActiveProgrammeIndex: jest.fn(),
    }),
}));

// ── Component mocks (heavy children that aren't the focus of these tests) ───

jest.mock('@/components/profile/PersonalityQuizzesCard', () => {
    const { View } = require('react-native');
    return { __esModule: true, default: () => <View testID="mock-personality-card" /> };
});

jest.mock('react-native-reanimated', () => {
    const { View } = require('react-native');
    return {
        __esModule: true,
        default: { createAnimatedComponent: (c: any) => c },
        useReducedMotion: () => false,
        useAnimatedStyle: () => ({}),
        useSharedValue: (v: any) => ({ value: v }),
        withTiming: (v: any) => v,
        withSpring: (v: any) => v,
        FadeIn: { duration: () => ({ build: () => ({}) }) },
        FadeOut: { duration: () => ({ build: () => ({}) }) },
        Layout: { duration: () => ({ build: () => ({}) }) },
        SlideInDown: { duration: () => ({ build: () => ({}) }) },
        SlideOutDown: { duration: () => ({ build: () => ({}) }) },
        createAnimatedComponent: (c: any) => c,
        Animated: { View, Text: require('react-native').Text },
    };
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Screen render tests', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('notifications screen renders without crashing', async () => {
        const NotificationsScreen = require('@/app/(tabs)/home/notifications').default;
        const { toJSON } = render(<NotificationsScreen />);
        expect(toJSON()).toBeTruthy();
    });

    it('profile screen renders without crashing', async () => {
        const ProfileScreen = require('@/app/(tabs)/profile/index').default;
        const { toJSON } = render(<ProfileScreen />);
        expect(toJSON()).toBeTruthy();
    });

    it('events screen renders without crashing', async () => {
        const EventsScreen = require('@/app/(tabs)/events/index').default;
        const { toJSON } = render(<EventsScreen />);
        expect(toJSON()).toBeTruthy();
    });

    it('leads screen renders without crashing', async () => {
        const LeadsScreen = require('@/app/(tabs)/leads/index').default;
        const { toJSON } = render(<LeadsScreen />);
        expect(toJSON()).toBeTruthy();
    });

    it('team screen renders without crashing', async () => {
        const TeamScreen = require('@/app/(tabs)/team/index').default;
        const { toJSON } = render(<TeamScreen />);
        expect(toJSON()).toBeTruthy();
    });

    it('manager detail screen renders without crashing', async () => {
        const ManagerDetailScreen = require('@/app/(tabs)/team/manager/[managerId]').default;
        const { toJSON } = render(<ManagerDetailScreen />);
        expect(toJSON()).toBeTruthy();
    });

    it('candidates screen renders without crashing', async () => {
        const CandidatesScreen = require('@/app/(tabs)/candidates/index').default;
        const { toJSON } = render(<CandidatesScreen />);
        expect(toJSON()).toBeTruthy();
    });

    it('exams screen renders without crashing', async () => {
        const ExamsScreen = require('@/app/(tabs)/exams/index').default;
        const { toJSON } = render(<ExamsScreen />);
        expect(toJSON()).toBeTruthy();
    });

    it('roadmap screen renders without crashing', async () => {
        const RoadmapScreen = require('@/app/(tabs)/roadmap/index').default;
        const { toJSON } = render(<RoadmapScreen />);
        expect(toJSON()).toBeTruthy();
    });
});
