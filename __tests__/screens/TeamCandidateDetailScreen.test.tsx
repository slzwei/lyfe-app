/**
 * Tests for app/(tabs)/team/candidate/[candidateId].tsx
 *
 * This file re-exports candidates/[candidateId].tsx (the NEW screen).
 * Detailed tests live in CandidateDetailScreen.test.tsx — this file
 * verifies the re-export works and basic rendering from the team tab context.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import TeamCandidateDetailScreen from '@/app/(tabs)/team/candidate/[candidateId]';
import CandidateDetailScreen from '@/app/(tabs)/candidates/[candidateId]';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { fetchCandidate } from '@/lib/recruitment';
import { fetchCandidateRoadmap } from '@/lib/roadmap';
import { useContactOutcome } from '@/hooks/useContactOutcome';
import { useDocumentManager } from '@/hooks/useDocumentManager';
import { useInterviewScheduler } from '@/hooks/useInterviewScheduler';

import { CandidateProgressionProvider } from '@/contexts/CandidateProgressionContext';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/lib/recruitment');
jest.mock('@/lib/roadmap');
jest.mock('@/hooks/useContactOutcome');
jest.mock('@/hooks/useDocumentManager');
jest.mock('@/hooks/useInterviewScheduler');

function renderTeamScreen() {
    return render(
        <CandidateProgressionProvider candidateId="cand-1">
            <TeamCandidateDetailScreen />
        </CandidateProgressionProvider>,
    );
}
function renderCandidateScreen() {
    return render(
        <CandidateProgressionProvider candidateId="cand-1">
            <CandidateDetailScreen />
        </CandidateProgressionProvider>,
    );
}

jest.mock('@/components/ScreenHeader', () => {
    const { Text } = require('react-native');
    return ({ title }: any) => <Text>{title}</Text>;
});
jest.mock('@/components/LoadingState', () => {
    const { Text } = require('react-native');
    return () => <Text>Loading...</Text>;
});
jest.mock('@/components/candidates/QuickActionsBar', () => {
    const { Text } = require('react-native');
    return () => <Text>Quick Actions</Text>;
});
jest.mock('@/components/candidates/HeroSection', () => {
    const { View, Text } = require('react-native');
    return ({ candidate }: any) => (
        <View testID="hero-section">
            <Text>{candidate.name}</Text>
            <Text>{candidate.phone}</Text>
            {candidate.email && <Text>{candidate.email}</Text>}
            {candidate.assigned_manager_name && <Text>{candidate.assigned_manager_name}</Text>}
        </View>
    );
});
jest.mock('@/components/candidates/OnboardingChecklist', () => {
    const { Text } = require('react-native');
    return () => <Text>Onboarding</Text>;
});
jest.mock('@/components/candidates/SectionCard', () => {
    const { View, Text } = require('react-native');
    const SectionCard = ({ title, children }: any) => (
        <View>
            <Text>{title}</Text>
            {children}
        </View>
    );
    const DetailRow = ({ label, value }: any) => (value ? <Text>{`${label}: ${value}`}</Text> : null);
    return { __esModule: true, default: SectionCard, DetailRow };
});
jest.mock('@/components/candidates/ContactOutcomeSheet', () => () => null);
jest.mock('@/components/candidates/InterviewSchedulerSheet', () => () => null);
jest.mock('@/components/candidates/NoteSheet', () => () => null);
jest.mock('@/components/candidates/PdfViewerModal', () => () => null);
jest.mock('@/components/candidates/DocumentSection', () => ({
    AddDocumentSheet: () => null,
    DocumentList: () => null,
}));
jest.mock('@/components/InterviewCard', () => () => null);
jest.mock('@/components/roadmap/ProgressSummaryCard', () => {
    const { Text } = require('react-native');
    return () => <Text>Roadmap Progress</Text>;
});
jest.mock('@/components/roadmap/UnlockConfirmSheet', () => () => null);
jest.mock('react-native-reanimated', () => ({
    useSharedValue: () => ({ value: 0 }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: any) => v,
    withTiming: (v: any, _cfg: any, cb?: (f: boolean) => void) => {
        cb?.(true);
        return v;
    },
    runOnJS: (fn: any) => fn,
    Easing: { out: () => undefined, in: () => undefined, cubic: undefined },
}));

jest.mock('expo-router', () => ({
    ...jest.requireActual('expo-router'),
    useLocalSearchParams: () => ({ candidateId: 'cand-1' }),
    useSegments: () => ['(tabs)', 'team'],
    usePathname: () => '/team/candidate/cand-1',
    useFocusEffect: (cb: () => void | (() => void)) => {
        const React = require('react');
        React.useEffect(() => cb(), [cb]);
    },
}));
jest.mock('@/hooks/useTypedRouter', () => ({
    useTypedRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));
jest.mock('@/hooks/useSheetAnimation', () => ({
    useSheetAnimation: () => false,
}));

const MOCK_CANDIDATE = {
    id: 'cand-1',
    name: 'Jane Smith',
    phone: '+6598765432',
    email: 'jane@example.com',
    status: 'applied' as const,
    assigned_manager_id: 'mgr-1',
    assigned_manager_name: 'Manager Alice',
    created_by_id: 'mgr-1',
    invite_token: 'inv_abc',
    notes: 'Promising candidate',
    resume_url: null,
    profile_pdf_path: null,
    disc_pdf_path: null,
    disc_results: null,
    profile_details: null,
    interviews: [] as any[],
    created_at: '2026-03-01',
    updated_at: '2026-03-05',
};

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
        user: { id: 'mgr-1', role: 'manager', full_name: 'Manager Alice', app_metadata: { role: 'manager' } },
    });
    (fetchCandidate as jest.Mock).mockResolvedValue({ data: MOCK_CANDIDATE, error: null });
    (fetchCandidateRoadmap as jest.Mock).mockResolvedValue({ data: [], error: null });
    const recruitment = require('@/lib/recruitment');
    recruitment.fetchPaperAttempts.mockResolvedValue({ data: [], error: null });
    recruitment.fetchMilestones.mockResolvedValue({ data: [], error: null });
    recruitment.fetchPrepCourseBookings.mockResolvedValue({ data: [], error: null });
    (useContactOutcome as jest.Mock).mockReturnValue({
        pendingType: null,
        showConfirmSheet: false,
        confirmStep: 'outcome',
        selectedOutcome: null,
        noteText: '',
        setNoteText: jest.fn(),
        handleCall: jest.fn(),
        handleWhatsApp: jest.fn(),
        handleOutcomeSelect: jest.fn(),
        handleSaveActivity: jest.fn(),
        handleDismissSheet: jest.fn(),
    });
    (useDocumentManager as jest.Mock).mockReturnValue({
        documents: [],
        showPdf: false,
        pdfUrl: null,
        pdfTitle: '',
        showAddDoc: false,
        addDocLabel: '',
        addDocCustomLabel: '',
        addDocStep: 'label',
        addDocError: null,
        hasDocumentPicker: true,
        setShowPdf: jest.fn(),
        setShowAddDoc: jest.fn(),
        setAddDocCustomLabel: jest.fn(),
        handleViewDocument: jest.fn(),
        openPdfViewer: jest.fn(),
        handleDeleteDocument: jest.fn(),
        handleSelectLabel: jest.fn(),
        pickAndUploadDocument: jest.fn(),
        openAddDocSheet: jest.fn(),
        loadDocuments: jest.fn().mockResolvedValue([]),
    });
    (useInterviewScheduler as jest.Mock).mockReturnValue({
        showScheduleSheet: false,
        editingInterview: null,
        scheduleStatus: 'scheduled',
        scheduleDate: new Date(),
        scheduleHour: 10,
        scheduleMinute: 0,
        scheduleAmPm: 'AM',
        scheduleType: 'zoom',
        scheduleLink: '',
        scheduleLocation: '',
        scheduleNotes: '',
        scheduleRecommendation: null,
        isScheduling: false,
        scheduleError: null,
        setScheduleDate: jest.fn(),
        setScheduleHour: jest.fn(),
        setScheduleMinute: jest.fn(),
        setScheduleAmPm: jest.fn(),
        setScheduleType: jest.fn(),
        setScheduleLink: jest.fn(),
        setScheduleLocation: jest.fn(),
        setScheduleNotes: jest.fn(),
        setScheduleStatus: jest.fn(),
        setScheduleRecommendation: jest.fn(),
        openNewInterview: jest.fn(),
        openEditInterview: jest.fn(),
        dismissScheduleSheet: jest.fn(),
        handleDeleteInterview: jest.fn(),
        handleSubmitSchedule: jest.fn(),
    });
});

describe('TeamCandidateDetailScreen', () => {
    it('is the same component as CandidateDetailScreen (re-export)', () => {
        expect(TeamCandidateDetailScreen).toBe(CandidateDetailScreen);
    });

    it('renders candidate name via HeroSection', async () => {
        const { getAllByText } = renderTeamScreen();
        await waitFor(() => {
            expect(getAllByText('Jane Smith').length).toBeGreaterThanOrEqual(1);
        });
    });

    it('renders candidate phone', async () => {
        const { getByText } = renderTeamScreen();
        await waitFor(() => {
            expect(getByText('+6598765432')).toBeTruthy();
        });
    });

    it('renders candidate email', async () => {
        const { getByText } = renderTeamScreen();
        await waitFor(() => {
            expect(getByText('jane@example.com')).toBeTruthy();
        });
    });

    it('renders manager name', async () => {
        const { getByText } = renderTeamScreen();
        await waitFor(() => {
            expect(getByText('Manager Alice')).toBeTruthy();
        });
    });

    it('shows not found when candidate is missing', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({ data: null, error: 'Not found' });
        const { getAllByText } = renderTeamScreen();
        await waitFor(() => {
            expect(getAllByText(/not found/i).length).toBeGreaterThanOrEqual(1);
        });
    });

    it('renders notes when present', async () => {
        const { getByText } = renderTeamScreen();
        await waitFor(() => {
            expect(getByText('Promising candidate')).toBeTruthy();
        });
    });
});
