/**
 * Tests for app/(tabs)/candidates/[candidateId].tsx — Candidate detail screen (revamped)
 */
import React from 'react';
import { fireEvent, render, waitFor, type RenderResult } from '@testing-library/react-native';
import CandidateDetailScreen from '@/app/(tabs)/candidates/[candidateId]';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import {
    fetchCandidate,
    fetchEmockAttemptsForCandidate,
    fetchMilestones,
    fetchPaperAttempts,
    fetchPrepCourseBookings,
} from '@/lib/recruitment';
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

function renderScreen() {
    return render(
        <CandidateProgressionProvider candidateId="cand-1">
            <CandidateDetailScreen />
        </CandidateProgressionProvider>,
    );
}

// The 4-tab structure (Progress/Profile/Docs/Activity) defaults to Progress.
// Tests asserting profile/docs/activity content must switch tabs first.
async function switchTab(r: RenderResult, label: 'Profile' | 'Docs' | 'Activity' | 'Progress') {
    await waitFor(() => expect(r.getByText(label)).toBeTruthy());
    fireEvent.press(r.getByText(label));
}

// Mock child components — sheets and complex UI that aren't under test
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
jest.mock('@/components/candidates/ContactOutcomeSheet', () => () => null);
jest.mock('@/components/candidates/InterviewSchedulerSheet', () => () => null);
jest.mock('@/components/candidates/NoteSheet', () => () => null);
jest.mock('@/components/candidates/PdfViewerModal', () => () => null);
jest.mock('@/components/candidates/DocumentSection', () => ({
    AddDocumentSheet: () => null,
    DocumentList: () => {
        const { Text } = require('react-native');
        return <Text>Document List</Text>;
    },
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
jest.mock('@/components/candidates/MilestoneMarkSheet', () => () => null);
jest.mock('@/components/candidates/PrepCourseMarkSheet', () => () => null);
jest.mock('@/components/CalendarPicker', () => () => null);
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

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
    ...jest.requireActual('expo-router'),
    useLocalSearchParams: () => ({ candidateId: 'cand-1' }),
    usePathname: () => '/candidates/cand-1',
    // useFocusEffect requires a navigation container; stub it to just invoke
    // the callback once, like a regular effect.
    useFocusEffect: (cb: () => void | (() => void)) => {
        const React = require('react');
        React.useEffect(() => cb(), [cb]);
    },
}));
jest.mock('@/hooks/useTypedRouter', () => ({
    useTypedRouter: () => ({ push: mockPush, replace: jest.fn(), back: mockBack }),
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
    enneagram_pdf_path: null,
    disc_results: null,
    profile_details: null,
    interviews: [] as any[],
    created_at: '2026-03-01',
    updated_at: '2026-03-05',
};

const MOCK_PROFILE = {
    completed: true,
    onboarding_step: 6,
    full_name: 'Jane Smith',
    chinese_name: '李小红',
    alias: 'Jenny',
    date_of_birth: '1995-06-15',
    nationality: 'Singaporean',
    race: 'Chinese',
    gender: 'Female',
    marital_status: 'Single',
    address_block: '123',
    address_street: 'Orchard Road',
    address_unit: '04-05',
    address_postal: '238888',
    position_applied: 'Financial Advisor',
    expected_salary: '5000',
    salary_period: 'month',
    date_available: '2026-04-01',
    emergency_name: 'John Smith',
    emergency_relationship: 'Father',
    emergency_contact: '+6591234567',
    education: [
        { institution: 'NUS', qualification: 'BSc Finance', year: '2017' },
        { institution: 'RI', qualification: 'A Levels', year: '2013' },
    ],
    employment_history: [
        { company: 'DBS Bank', position: 'Associate', period: '2017-2024', reason_for_leaving: 'Career change' },
    ],
    languages: [
        { language: 'English', spoken: 'Fluent', written: 'Fluent' },
        { language: 'Mandarin', spoken: 'Good', written: 'Fair' },
    ],
    software_competencies: 'MS Office, Salesforce',
    shorthand_wpm: null,
    typing_wpm: 60,
};

const MOCK_DISC = { d_pct: 35, i_pct: 28, s_pct: 20, c_pct: 17, disc_type: 'Di', angle: 45 };

function defaultHookMocks() {
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
    (fetchCandidateRoadmap as jest.Mock).mockResolvedValue({ data: [], error: null });
    (fetchPaperAttempts as jest.Mock).mockResolvedValue({ data: [], error: null });
    (fetchMilestones as jest.Mock).mockResolvedValue({ data: [], error: null });
    (fetchPrepCourseBookings as jest.Mock).mockResolvedValue({ data: [], error: null });
    (fetchEmockAttemptsForCandidate as jest.Mock).mockResolvedValue({ data: [], error: null });
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
}

beforeEach(() => {
    jest.clearAllMocks();
    defaultHookMocks();
});

describe('CandidateDetailScreen', () => {
    // ── Loading & error states ──

    it('shows loading state while fetching', () => {
        (fetchCandidate as jest.Mock).mockReturnValue(new Promise(() => {}));
        const { getAllByText } = renderScreen();
        expect(getAllByText('Loading...').length).toBeGreaterThanOrEqual(1);
    });

    it('shows not-found when candidate is null', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({ data: null, error: 'Not found' });
        const { getByText } = renderScreen();
        await waitFor(() => {
            expect(getByText('Not found')).toBeTruthy();
            expect(getByText('Go Back')).toBeTruthy();
        });
    });

    // ── Hero section ──

    it('renders candidate name in hero and header', async () => {
        const { getAllByText } = renderScreen();
        await waitFor(() => {
            expect(getAllByText('Jane Smith').length).toBeGreaterThanOrEqual(1);
        });
    });

    it('renders phone number', async () => {
        const { getByText } = renderScreen();
        await waitFor(() => {
            // Phone rendered via formatSgPhone (+65 + space-separated groups)
            expect(getByText('+65 9876 5432')).toBeTruthy();
        });
    });

    it('renders email when present', async () => {
        const { getByText } = renderScreen();
        await waitFor(() => {
            expect(getByText('jane@example.com')).toBeTruthy();
        });
    });

    it('hides email when null', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, email: null },
            error: null,
        });
        const { queryByText } = renderScreen();
        await waitFor(() => {
            expect(queryByText('jane@example.com')).toBeNull();
        });
    });

    it('renders status label', async () => {
        const { getByText } = renderScreen();
        await waitFor(() => {
            expect(getByText('Applied')).toBeTruthy();
        });
    });

    it('renders assigned manager name', async () => {
        const { getByText } = renderScreen();
        await waitFor(() => {
            expect(getByText('Manager Alice')).toBeTruthy();
        });
    });

    it('renders days in pipeline', async () => {
        const { getByText } = renderScreen();
        const days = Math.floor((Date.now() - new Date('2026-03-01').getTime()) / 86400000);
        await waitFor(() => {
            expect(getByText('IN PIPELINE')).toBeTruthy();
            expect(getByText(`${days}d`)).toBeTruthy();
        });
    });

    // ── Quick actions ──

    it('renders quick actions bar', async () => {
        const { getByText } = renderScreen();
        await waitFor(() => {
            expect(getByText('Quick Actions')).toBeTruthy();
        });
    });

    // ── Onboarding checklist ──

    it('renders onboarding checklist section', async () => {
        const { getByText } = renderScreen();
        await waitFor(() => {
            expect(getByText('Onboarding')).toBeTruthy();
        });
    });

    it('shows unchecked items for minimal candidate', async () => {
        const { getByText } = renderScreen();
        await waitFor(() => {
            expect(getByText('Profile submitted')).toBeTruthy();
            expect(getByText('DISC completed')).toBeTruthy();
            expect(getByText('Resume uploaded')).toBeTruthy();
            expect(getByText('Interview scheduled')).toBeTruthy();
            expect(getByText('0/7')).toBeTruthy();
        });
    });

    it('marks profile submitted when completed', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, profile_details: { ...MOCK_PROFILE, completed: true } },
            error: null,
        });
        const { getByText } = renderScreen();
        await waitFor(() => {
            expect(getByText('Profile submitted')).toBeTruthy();
        });
    });

    it('marks DISC completed when disc_results exist', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, disc_results: MOCK_DISC },
            error: null,
        });
        const { getByText } = renderScreen();
        await waitFor(() => {
            expect(getByText('DISC completed')).toBeTruthy();
        });
    });

    it('shows correct progress count with resume doc', async () => {
        (useDocumentManager as jest.Mock).mockReturnValue({
            ...((useDocumentManager as jest.Mock).getMockImplementation?.() ?? {}),
            documents: [
                {
                    id: 'doc-1',
                    candidate_id: 'cand-1',
                    label: 'Resume',
                    file_url: 'url',
                    file_name: 'resume.pdf',
                    created_at: '',
                },
            ],
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
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, profile_details: MOCK_PROFILE, disc_results: MOCK_DISC },
            error: null,
        });

        const { getByText } = renderScreen();
        await waitFor(() => {
            expect(getByText('3/7')).toBeTruthy();
        });
    });

    // ── Personal details ──

    it('renders personal details when profile exists', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, profile_details: MOCK_PROFILE },
            error: null,
        });
        const r = renderScreen();
        await switchTab(r, 'Profile');
        await waitFor(() => {
            expect(r.getByText('Personal Details')).toBeTruthy();
            expect(r.getByText('Singaporean')).toBeTruthy();
            expect(r.getByText('Chinese')).toBeTruthy();
            expect(r.getByText('Female')).toBeTruthy();
            expect(r.getByText('Single')).toBeTruthy();
        });
    });

    it('renders chinese name and alias', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, profile_details: MOCK_PROFILE },
            error: null,
        });
        const r = renderScreen();
        await switchTab(r, 'Profile');
        await waitFor(() => {
            expect(r.getByText('李小红')).toBeTruthy();
            expect(r.getByText('Jenny')).toBeTruthy();
        });
    });

    it('renders formatted address', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, profile_details: MOCK_PROFILE },
            error: null,
        });
        const r = renderScreen();
        await switchTab(r, 'Profile');
        await waitFor(() => {
            expect(r.getByText('Blk 123 Orchard Road #04-05 S(238888)')).toBeTruthy();
        });
    });

    it('hides personal details when profile is null', async () => {
        const { queryByText } = renderScreen();
        await waitFor(() => {
            expect(queryByText('Personal Details')).toBeNull();
        });
    });

    // ── Employment details ──

    it('renders employment details', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, profile_details: MOCK_PROFILE },
            error: null,
        });
        const r = renderScreen();
        await switchTab(r, 'Profile');
        await waitFor(() => {
            expect(r.getByText('Employment Details')).toBeTruthy();
            expect(r.getByText('Financial Advisor')).toBeTruthy();
            expect(r.getByText('$5000 / month')).toBeTruthy();
        });
    });

    // ── Emergency contact ──

    it('renders emergency contact', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, profile_details: MOCK_PROFILE },
            error: null,
        });
        const r = renderScreen();
        await switchTab(r, 'Profile');
        await waitFor(() => {
            expect(r.getByText('Emergency Contact')).toBeTruthy();
            expect(r.getByText('John Smith')).toBeTruthy();
            expect(r.getByText('Father')).toBeTruthy();
        });
    });

    // ── Education ──

    it('renders education entries', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, profile_details: MOCK_PROFILE },
            error: null,
        });
        const r = renderScreen();
        await switchTab(r, 'Profile');
        await waitFor(() => {
            expect(r.getByText('Education')).toBeTruthy();
            expect(r.getByText('NUS')).toBeTruthy();
            expect(r.getByText('BSc Finance')).toBeTruthy();
            expect(r.getByText('RI')).toBeTruthy();
        });
    });

    // ── Employment history ──

    it('renders employment history', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, profile_details: MOCK_PROFILE },
            error: null,
        });
        const r = renderScreen();
        await switchTab(r, 'Profile');
        await waitFor(() => {
            expect(r.getByText('Employment History')).toBeTruthy();
            expect(r.getByText('DBS Bank')).toBeTruthy();
            expect(r.getByText('Associate')).toBeTruthy();
            expect(r.getByText('Left: Career change')).toBeTruthy();
        });
    });

    // ── Skills & languages ──

    it('renders languages and skills', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, profile_details: MOCK_PROFILE },
            error: null,
        });
        const r = renderScreen();
        await switchTab(r, 'Profile');
        await waitFor(() => {
            expect(r.getByText('Skills & Languages')).toBeTruthy();
            expect(r.getByText('English')).toBeTruthy();
            expect(r.getByText('Mandarin')).toBeTruthy();
            expect(r.getByText('MS Office, Salesforce')).toBeTruthy();
            expect(r.getByText('60 WPM')).toBeTruthy();
        });
    });

    // ── DISC profile ──

    it('renders DISC profile when results exist', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, disc_results: MOCK_DISC },
            error: null,
        });
        const r = renderScreen();
        await switchTab(r, 'Profile');
        await waitFor(() => {
            expect(r.getByText('DISC Profile')).toBeTruthy();
            expect(r.getByText('Di')).toBeTruthy();
            expect(r.getByText('35%')).toBeTruthy();
            expect(r.getByText('28%')).toBeTruthy();
        });
    });

    it('hides DISC section when no results', async () => {
        const { queryByText } = renderScreen();
        await waitFor(() => {
            expect(queryByText('DISC Profile')).toBeNull();
        });
    });

    // ── Documents ──

    it('renders documents section', async () => {
        const r = renderScreen();
        await switchTab(r, 'Docs');
        await waitFor(() => {
            expect(r.getByText('Documents')).toBeTruthy();
            expect(r.getByText('Document List')).toBeTruthy();
        });
    });

    // ── Interviews ──

    it('shows empty state when no interviews', async () => {
        const r = renderScreen();
        await switchTab(r, 'Activity');
        await waitFor(() => {
            expect(r.getByText('Interviews')).toBeTruthy();
            expect(r.getByText('No interviews yet')).toBeTruthy();
        });
    });

    it('renders interview cards', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: {
                ...MOCK_CANDIDATE,
                interviews: [
                    {
                        id: 'iv-1',
                        candidate_id: 'cand-1',
                        round_number: 1,
                        type: 'zoom',
                        datetime: '2026-04-10T10:00:00Z',
                        status: 'scheduled',
                        location: null,
                        zoom_link: null,
                        google_calendar_event_id: null,
                        notes: null,
                        recommendation: null,
                        created_at: '2026-04-01',
                    },
                    {
                        id: 'iv-2',
                        candidate_id: 'cand-1',
                        round_number: 2,
                        type: 'in_person',
                        datetime: '2026-04-15T14:00:00Z',
                        status: 'completed',
                        location: 'Office',
                        zoom_link: null,
                        google_calendar_event_id: null,
                        notes: null,
                        recommendation: null,
                        created_at: '2026-04-05',
                    },
                ],
            },
            error: null,
        });
        const r = renderScreen();
        await switchTab(r, 'Activity');
        await waitFor(() => {
            expect(r.getByText('Interview 1')).toBeTruthy();
            expect(r.getByText('Interview 2')).toBeTruthy();
        });
    });

    // ── Contact activity ──

    it('shows empty contact activity state', async () => {
        const r = renderScreen();
        await switchTab(r, 'Activity');
        await waitFor(() => {
            expect(r.getByText('Contact Activity')).toBeTruthy();
            expect(r.getByText('No calls or messages logged yet')).toBeTruthy();
        });
    });

    // ── Notes ──

    it('renders notes when present', async () => {
        const r = renderScreen();
        await switchTab(r, 'Activity');
        await waitFor(() => {
            expect(r.getByText('Notes')).toBeTruthy();
            expect(r.getByText('Promising candidate')).toBeTruthy();
        });
    });

    it('hides notes section when notes is null', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, notes: null },
            error: null,
        });
        const { queryByText } = renderScreen();
        await waitFor(() => {
            expect(queryByText('Notes')).toBeNull();
        });
    });

    // ── Status rendering ──

    it('renders interview_scheduled status', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, status: 'interview_scheduled' },
            error: null,
        });
        const { getByText } = renderScreen();
        await waitFor(() => {
            expect(getByText('Interview')).toBeTruthy();
        });
    });

    it('renders approved status', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, status: 'approved' },
            error: null,
        });
        const { getAllByText } = renderScreen();
        await waitFor(() => {
            expect(getAllByText('Approved').length).toBeGreaterThanOrEqual(1);
        });
    });

    // ── Training progress ──

    it('renders training progress when programmes exist', async () => {
        (fetchCandidateRoadmap as jest.Mock).mockResolvedValue({
            data: [{ id: 'prog-1', slug: 'sproutlyfe', title: 'SproutLYFE', isLocked: false, modules: [] }],
            error: null,
        });
        const { getByText } = renderScreen();
        await waitFor(() => {
            expect(getByText('Training Progress')).toBeTruthy();
            expect(getByText('Roadmap Progress')).toBeTruthy();
        });
    });

    it('hides training progress for non-manager roles', async () => {
        (useAuth as jest.Mock).mockReturnValue({
            user: { id: 'agent-1', role: 'agent', full_name: 'Agent Bob' },
        });
        (fetchCandidateRoadmap as jest.Mock).mockResolvedValue({
            data: [{ id: 'prog-1', slug: 'sproutlyfe', title: 'SproutLYFE', isLocked: false, modules: [] }],
            error: null,
        });
        const { queryByText } = renderScreen();
        await waitFor(() => {
            expect(queryByText('Training Progress')).toBeNull();
        });
    });

    // ── LicensedReadinessBanner visibility matrix ──

    // Helper for a paper ATTEMPT (new attempts-only model).
    function paper(code: string, result: 'passed' | 'failed' | null = 'passed') {
        return {
            id: `att-${code}-${result ?? 'sch'}`,
            candidate_id: 'cand-1',
            paper_code: code,
            exam_at: '2026-04-10T02:00:00Z',
            cost: 120,
            result,
            logged_by_user_id: null,
            created_at: '2026-04-01T00:00:00Z',
            updated_at: '2026-04-01T00:00:00Z',
        };
    }

    function rnf(status: 'not_started' | 'lodged_to_mas' | 'issued'): any {
        return {
            id: 'ms-rnf',
            candidate_id: 'cand-1',
            milestone_code: 'rnf',
            status,
            scheduled_date: null,
            scheduled_end_date: null,
            completed_date: null,
            reference_number: status === 'issued' ? 'RNF-2026-001' : null,
            verified_by_user_id: null,
            note: null,
            created_at: '2026-04-01T00:00:00Z',
            updated_at: '2026-04-01T00:00:00Z',
        };
    }

    it('hides licensed banner when papers are incomplete', async () => {
        // Only 3 of 4 requirements satisfied.
        (fetchPaperAttempts as jest.Mock).mockResolvedValue({
            data: [paper('M9'), paper('M9A'), paper('M5')],
            error: null,
        });
        (fetchMilestones as jest.Mock).mockResolvedValue({ data: [rnf('issued')], error: null });

        const { queryByTestId } = renderScreen();
        await waitFor(() => expect(queryByTestId('papers-section-row-life_1')).toBeTruthy());
        expect(queryByTestId('licensed-readiness-banner')).toBeNull();
    });

    it('hides licensed banner when RNF is not issued', async () => {
        (fetchPaperAttempts as jest.Mock).mockResolvedValue({
            data: [paper('M9'), paper('M9A'), paper('M5'), paper('HI')],
            error: null,
        });
        (fetchMilestones as jest.Mock).mockResolvedValue({ data: [rnf('lodged_to_mas')], error: null });

        const { queryByTestId } = renderScreen();
        await waitFor(() => expect(queryByTestId('papers-section-row-life_1')).toBeTruthy());
        expect(queryByTestId('licensed-readiness-banner')).toBeNull();
    });

    it('hides licensed banner when candidate is already licensed', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, status: 'licensed' },
            error: null,
        });
        (fetchPaperAttempts as jest.Mock).mockResolvedValue({
            data: [paper('M9'), paper('M9A'), paper('M5'), paper('HI')],
            error: null,
        });
        (fetchMilestones as jest.Mock).mockResolvedValue({ data: [rnf('issued')], error: null });

        const { queryByTestId } = renderScreen();
        await waitFor(() => expect(queryByTestId('papers-section-row-life_1')).toBeTruthy());
        expect(queryByTestId('licensed-readiness-banner')).toBeNull();
    });

    it('shows licensed banner when all prerequisites are met and status is pre-licensed', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, status: 'exam_prep' },
            error: null,
        });
        (fetchPaperAttempts as jest.Mock).mockResolvedValue({
            data: [paper('M9'), paper('M9A'), paper('M5'), paper('HI')],
            error: null,
        });
        (fetchMilestones as jest.Mock).mockResolvedValue({ data: [rnf('issued')], error: null });

        const { queryByTestId } = renderScreen();
        await waitFor(() => expect(queryByTestId('licensed-readiness-banner')).toBeTruthy());
    });

    it('hides licensed banner for roles without verify+manage capability', async () => {
        (useAuth as jest.Mock).mockReturnValue({
            user: { id: 'agent-1', role: 'agent', full_name: 'Agent Bob' },
        });
        (fetchPaperAttempts as jest.Mock).mockResolvedValue({
            data: [paper('M9'), paper('M9A'), paper('M5'), paper('HI')],
            error: null,
        });
        (fetchMilestones as jest.Mock).mockResolvedValue({ data: [rnf('issued')], error: null });

        const { queryByTestId } = renderScreen();
        await waitFor(() => expect(queryByTestId('licensed-readiness-banner')).toBeNull());
    });
});
