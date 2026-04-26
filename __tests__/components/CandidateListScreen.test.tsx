/**
 * Tests for components/CandidateListScreen.tsx — Candidate list with role-aware modes and grouped filters.
 */
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CandidateListScreen from '@/components/CandidateListScreen';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import { useCandidatePipeline } from '@/hooks/useCandidatePipeline';
import { fetchCandidates } from '@/lib/recruitment';
import type { RecruitmentCandidate } from '@/types/recruitment';

jest.mock('@/lib/supabase');
jest.mock('@/lib/recruitment');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/hooks/useTypedRouter');
jest.mock('@/hooks/useCandidatePipeline');

jest.mock('expo-router', () => ({
    ...(jest.requireActual('expo-router') as any),
    useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() })),
    useLocalSearchParams: jest.fn(() => ({})),
    useFocusEffect: (cb: () => void) => {
        const React = require('react');
        React.useEffect(() => {
            cb();
        }, [cb]);
    },
    Link: 'Link',
    Tabs: { Screen: 'Screen' },
}));

const mockFetch = fetchCandidates as jest.MockedFunction<typeof fetchCandidates>;
const mockUsePipeline = useCandidatePipeline as jest.MockedFunction<typeof useCandidatePipeline>;
const mockPush = jest.fn();
const mockRefreshPipeline = jest.fn().mockResolvedValue(undefined);

function candidate(overrides: Partial<RecruitmentCandidate>): RecruitmentCandidate {
    return {
        id: 'c1',
        name: 'Alice Tan',
        phone: '+6591111111',
        email: 'alice@test.com',
        status: 'applied',
        assigned_manager_id: 'mgr-1',
        assigned_manager_name: 'Manager',
        created_by_id: 'user-1',
        invite_token: null,
        notes: null,
        resume_url: null,
        profile_pdf_path: null,
        disc_pdf_path: null,
        enneagram_pdf_path: null,
        disc_results: null,
        profile_details: null,
        interviews: [],
        stage_before_hold: null,
        rejected_at: null,
        rejected_reason: null,
        rejected_by_user_id: null,
        created_at: '2026-03-01T00:00:00Z',
        updated_at: '2026-03-05T00:00:00Z',
        ...overrides,
    };
}

const CANDIDATES: RecruitmentCandidate[] = [
    candidate({ id: 'c1', name: 'Alice Tan', status: 'applied' }),
    candidate({ id: 'c2', name: 'Bob Lim', phone: '+6592222222', status: 'interview_scheduled' }),
    candidate({ id: 'c3', name: 'Charlie Wong', phone: '+6593333333', status: 'approved' }),
];

beforeEach(() => {
    jest.clearAllMocks();
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    mockFetch.mockResolvedValue({ data: CANDIDATES, error: null, hasMore: false });
    mockUsePipeline.mockReturnValue({
        rows: [],
        counts: { 'at-risk': 0, 'this-week': 0, ready: 0, 'on-track': 0, hidden: 0 },
        isLoading: false,
        isRefreshing: false,
        error: null,
        refresh: mockRefreshPipeline,
    });
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-1', role: 'pa' } });
    (useTheme as jest.Mock).mockReturnValue({
        colors: Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    });
    (useTypedRouter as jest.Mock).mockReturnValue({ push: mockPush, replace: jest.fn(), back: jest.fn() });
});

describe('CandidateListScreen', () => {
    it('defaults PA users to Directory and renders candidates', async () => {
        const { getByText } = render(
            <CandidateListScreen candidateRoute={(id) => `/candidates/${id}`} addRoute="/candidates/add-candidate" />,
        );

        await waitFor(() => {
            expect(getByText('Alice Tan')).toBeTruthy();
        });

        expect(getByText('Bob Lim')).toBeTruthy();
        expect(getByText('Charlie Wong')).toBeTruthy();
        expect(mockFetch).toHaveBeenCalledWith('user-1', false);
    });

    it('defaults managers to Pipeline', async () => {
        (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-1', role: 'manager' } });
        mockUsePipeline.mockReturnValue({
            rows: [
                {
                    candidate: CANDIDATES[0],
                    nextStep: { urgency: 'ready', text: 'Schedule BDM interview', signal: 'all papers passed' },
                },
            ],
            counts: { 'at-risk': 0, 'this-week': 0, ready: 1, 'on-track': 0, hidden: 0 },
            isLoading: false,
            isRefreshing: false,
            error: null,
            refresh: mockRefreshPipeline,
        });

        const { getByText } = render(
            <CandidateListScreen
                candidateRoute={(id) => `/candidates/${id}`}
                addRoute="/candidates/add-candidate"
                isManagerView
            />,
        );

        await waitFor(() => {
            expect(getByText('Schedule BDM interview')).toBeTruthy();
        });

        expect(mockUsePipeline).toHaveBeenCalledWith({ isManagerView: true, enabled: true });
    });

    it('search filters candidates by name', async () => {
        const { getByText, getByPlaceholderText, queryByText } = render(
            <CandidateListScreen candidateRoute={(id) => `/candidates/${id}`} addRoute="/add" />,
        );

        await waitFor(() => {
            expect(getByText('Alice Tan')).toBeTruthy();
        });

        fireEvent.changeText(getByPlaceholderText('Search candidates'), 'Alice');

        await waitFor(() => {
            expect(getByText('Alice Tan')).toBeTruthy();
            expect(queryByText('Bob Lim')).toBeNull();
            expect(queryByText('Charlie Wong')).toBeNull();
        });
    });

    it('uses grouped filters by default', async () => {
        const { getAllByText, getByText, queryByText } = render(
            <CandidateListScreen candidateRoute={(id) => `/candidates/${id}`} addRoute="/add" />,
        );

        await waitFor(() => {
            expect(getByText('Alice Tan')).toBeTruthy();
        });

        fireEvent.press(getAllByText('Interview')[0]);

        expect(queryByText('Alice Tan')).toBeNull();
        expect(getByText('Bob Lim')).toBeTruthy();
        expect(queryByText('Charlie Wong')).toBeNull();
    });

    it('keeps granular statuses in the status sheet', async () => {
        const { getAllByText, getByLabelText, getByText, queryByText } = render(
            <CandidateListScreen candidateRoute={(id) => `/candidates/${id}`} addRoute="/add" />,
        );

        await waitFor(() => {
            expect(getByText('Alice Tan')).toBeTruthy();
        });

        fireEvent.press(getByLabelText('Open detailed status filters'));
        fireEvent.press(getAllByText('Approved').at(-1)!);

        expect(queryByText('Alice Tan')).toBeNull();
        expect(queryByText('Bob Lim')).toBeNull();
        expect(getByText('Charlie Wong')).toBeTruthy();
    });

    it('persists manual mode switches', async () => {
        const { getByText } = render(
            <CandidateListScreen candidateRoute={(id) => `/candidates/${id}`} addRoute="/add" />,
        );

        await waitFor(() => {
            expect(getByText('Alice Tan')).toBeTruthy();
        });

        fireEvent.press(getByText('Pipeline'));

        expect(AsyncStorage.setItem).toHaveBeenCalledWith('lyfe_candidate_sort_mode:pa', 'urgency');
    });

    it('navigates to candidate and add routes', async () => {
        const { getByLabelText, getByText } = render(
            <CandidateListScreen candidateRoute={(id) => `/candidates/${id}`} addRoute="/candidates/add-candidate" />,
        );

        await waitFor(() => {
            expect(getByText('Alice Tan')).toBeTruthy();
        });

        fireEvent.press(getByText('Alice Tan'));
        expect(mockPush).toHaveBeenCalledWith('/candidates/c1');

        fireEvent.press(getByLabelText('Add new candidate'));
        expect(mockPush).toHaveBeenCalledWith('/candidates/add-candidate');
    });

    it('does not fetch directory candidates when no user', () => {
        (useAuth as jest.Mock).mockReturnValue({ user: null });

        render(<CandidateListScreen candidateRoute={(id) => `/candidates/${id}`} addRoute="/add" />);

        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('passes isManagerView to directory fetch', async () => {
        render(<CandidateListScreen candidateRoute={(id) => `/candidates/${id}`} addRoute="/add" isManagerView />);

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith('user-1', true);
        });
    });
});
