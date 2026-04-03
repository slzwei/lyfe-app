/**
 * Tests for app/(tabs)/candidates/[candidateId].tsx — Candidate detail screen
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import CandidateDetailScreen from '@/app/(tabs)/candidates/[candidateId]';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { fetchCandidate } from '@/lib/recruitment';
import { fetchCandidateRoadmap } from '@/lib/roadmap';
import { useContactOutcome } from '@/hooks/useContactOutcome';
import { useDocumentManager } from '@/hooks/useDocumentManager';
import { useInterviewScheduler } from '@/hooks/useInterviewScheduler';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/lib/recruitment');
jest.mock('@/lib/roadmap');
jest.mock('@/hooks/useContactOutcome');
jest.mock('@/hooks/useDocumentManager');
jest.mock('@/hooks/useInterviewScheduler');

// Mock child components
jest.mock('@/components/ScreenHeader', () => {
    const { Text } = require('react-native');
    return ({ title }: any) => <Text>{title}</Text>;
});
jest.mock('@/components/LoadingState', () => {
    const { Text } = require('react-native');
    return () => <Text>Loading...</Text>;
});
jest.mock('@/components/StatusStepper', () => {
    const { Text } = require('react-native');
    return ({ currentStatus }: any) => <Text>Status: {currentStatus}</Text>;
});
jest.mock('@/components/candidates/CandidateProfileCard', () => {
    const { Text } = require('react-native');
    return ({ candidate }: any) => <Text>Profile: {candidate.name}</Text>;
});
jest.mock('@/components/candidates/DiscResultsCard', () => {
    const { Text } = require('react-native');
    return () => <Text>DISC Results</Text>;
});
jest.mock('@/components/candidates/ApplicationDetailsCard', () => {
    const { Text } = require('react-native');
    return () => <Text>Application Details</Text>;
});
jest.mock('@/components/candidates/ContactHistoryCard', () => {
    const { Text } = require('react-native');
    return () => <Text>Contact History</Text>;
});
jest.mock('@/components/candidates/QuickActionsBar', () => {
    const { Text } = require('react-native');
    return () => <Text>Quick Actions</Text>;
});
jest.mock('@/components/candidates/ContactOutcomeSheet', () => () => null);
jest.mock('@/components/candidates/InterviewSchedulerSheet', () => () => null);
jest.mock('@/components/candidates/NoteSheet', () => () => null);
jest.mock('@/components/candidates/PdfViewerModal', () => () => null);
jest.mock('@/components/candidates/DocumentSection', () => ({
    AddDocumentSheet: () => null,
    DocumentList: () => null,
}));
jest.mock('@/components/InterviewCard', () => {
    const { Text } = require('react-native');
    return ({ interview }: any) => <Text>Interview {interview.round_number}</Text>;
});
jest.mock('@/components/roadmap/ProgressSummaryCard', () => {
    const { Text } = require('react-native');
    return () => <Text>Roadmap Progress</Text>;
});
jest.mock('@/components/roadmap/UnlockConfirmSheet', () => () => null);
jest.mock('react-native-reanimated', () => ({
    useSharedValue: () => ({ value: 0 }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: any) => v,
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    ...jest.requireActual('expo-router'),
    useLocalSearchParams: () => ({ candidateId: 'cand-1' }),
}));
jest.mock('@/hooks/useTypedRouter', () => ({
    useTypedRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

const MOCK_CANDIDATE = {
    id: 'cand-1',
    name: 'Jane Smith',
    phone: '+6598765432',
    email: 'jane@example.com',
    status: 'applied',
    assigned_manager_id: 'mgr-1',
    assigned_manager_name: 'Manager Alice',
    created_by_id: 'mgr-1',
    invite_token: 'inv_abc',
    notes: 'Promising',
    resume_url: null,
    profile_pdf_path: null,
    disc_pdf_path: null,
    disc_results: null,
    profile_details: null,
    interviews: [],
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
        user: { id: 'mgr-1', role: 'manager', full_name: 'Manager Alice' },
    });
    (fetchCandidate as jest.Mock).mockResolvedValue({ data: MOCK_CANDIDATE, error: null });
    (fetchCandidateRoadmap as jest.Mock).mockResolvedValue({ programmes: [], error: null });
    (useContactOutcome as jest.Mock).mockReturnValue({
        showOutcome: false,
        setShowOutcome: jest.fn(),
        contactType: null,
        setContactType: jest.fn(),
        outcome: null,
        setOutcome: jest.fn(),
        handleSubmit: jest.fn(),
    });
    (useDocumentManager as jest.Mock).mockReturnValue({
        documents: [],
        isLoading: false,
        showAdd: false,
        setShowAdd: jest.fn(),
        handleUpload: jest.fn(),
        handleDelete: jest.fn(),
        loadDocuments: jest.fn(),
    });
    (useInterviewScheduler as jest.Mock).mockReturnValue({
        showSchedule: false,
        setShowSchedule: jest.fn(),
        handleSchedule: jest.fn(),
        handleUpdate: jest.fn(),
        handleDelete: jest.fn(),
    });
});

describe('CandidateDetailScreen', () => {
    it('renders candidate profile on success', async () => {
        const { getByText } = render(<CandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText('Profile: Jane Smith')).toBeTruthy();
        });
    });

    it('renders status stepper', async () => {
        const { getByText } = render(<CandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText('Status: applied')).toBeTruthy();
        });
    });

    it('renders quick actions bar', async () => {
        const { getByText } = render(<CandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText('Quick Actions')).toBeTruthy();
        });
    });

    it('renders interview cards when interviews exist', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: {
                ...MOCK_CANDIDATE,
                interviews: [
                    {
                        id: 'iv-1',
                        candidate_id: 'cand-1',
                        round_number: 1,
                        type: 'zoom',
                        datetime: '2026-04-10',
                        status: 'scheduled',
                    },
                ],
            },
            error: null,
        });

        const { getByText } = render(<CandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText('Interview 1')).toBeTruthy();
        });
    });

    it('renders application details when profile exists', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: {
                ...MOCK_CANDIDATE,
                profile_details: {
                    completed: true,
                    onboarding_step: 5,
                    full_name: 'Jane Smith',
                    education: [],
                    employment_history: [],
                    languages: [],
                },
            },
            error: null,
        });

        const { getByText } = render(<CandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText('Application Details')).toBeTruthy();
        });
    });

    it('renders contact history card', async () => {
        const { getByText } = render(<CandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText('Contact History')).toBeTruthy();
        });
    });

    it('renders candidate with resume URL', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, resume_url: 'resumes/cand-1/resume.pdf' },
            error: null,
        });

        const { getByText } = render(<CandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText('Profile: Jane Smith')).toBeTruthy();
        });
    });

    it('renders candidate with profile PDF path', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, profile_pdf_path: 'pdfs/profile.pdf' },
            error: null,
        });

        const { getByText } = render(<CandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText('Profile: Jane Smith')).toBeTruthy();
        });
    });

    it('renders candidate with multiple interviews', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: {
                ...MOCK_CANDIDATE,
                interviews: [
                    {
                        id: 'iv-1',
                        candidate_id: 'cand-1',
                        round_number: 1,
                        type: 'zoom',
                        datetime: '2026-04-10',
                        status: 'completed',
                    },
                    {
                        id: 'iv-2',
                        candidate_id: 'cand-1',
                        round_number: 2,
                        type: 'in_person',
                        datetime: '2026-04-15',
                        status: 'scheduled',
                    },
                ],
            },
            error: null,
        });

        const { getByText } = render(<CandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText('Interview 1')).toBeTruthy();
            expect(getByText('Interview 2')).toBeTruthy();
        });
    });

    it('renders with no email', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, email: null },
            error: null,
        });

        const { getByText, queryByText } = render(<CandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText('Profile: Jane Smith')).toBeTruthy();
            expect(queryByText('jane@example.com')).toBeNull();
        });
    });

    it('renders candidate with interview_scheduled status', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, status: 'interview_scheduled' },
            error: null,
        });

        const { getByText } = render(<CandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText('Status: interview_scheduled')).toBeTruthy();
        });
    });

    it('renders DISC results when available', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: {
                ...MOCK_CANDIDATE,
                disc_results: { d_pct: 30, i_pct: 25, s_pct: 20, c_pct: 25, disc_type: 'Di', angle: 45 },
            },
            error: null,
        });

        const { getByText } = render(<CandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText('DISC Results')).toBeTruthy();
        });
    });
});
