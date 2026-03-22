/**
 * Tests for components/CandidateListScreen.tsx — Candidate list with search/filter
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import CandidateListScreen from '@/components/CandidateListScreen';
import { fetchCandidates } from '@/lib/recruitment';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import { Colors } from '@/constants/Colors';
import type { RecruitmentCandidate } from '@/types/recruitment';

jest.mock('@/lib/supabase');
jest.mock('@/lib/recruitment');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/hooks/useTypedRouter');

// Override useFocusEffect to behave like useEffect (not called on every render)
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
const mockPush = jest.fn();

(useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-1', role: 'manager' } });
(useTheme as jest.Mock).mockReturnValue({
    colors: Colors.light,
    isDark: false,
    mode: 'light',
    resolved: 'light',
    setMode: jest.fn(),
});
(useTypedRouter as jest.Mock).mockReturnValue({ push: mockPush, replace: jest.fn(), back: jest.fn() });

const CANDIDATES: RecruitmentCandidate[] = [
    {
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
        interviews: [],
        created_at: '2026-03-01',
        updated_at: '2026-03-05',
    },
    {
        id: 'c2',
        name: 'Bob Lim',
        phone: '+6592222222',
        email: null,
        status: 'interview_scheduled',
        assigned_manager_id: 'mgr-1',
        assigned_manager_name: 'Manager',
        created_by_id: 'user-1',
        invite_token: null,
        notes: null,
        resume_url: null,
        profile_pdf_path: null,
        disc_pdf_path: null,
        interviews: [],
        created_at: '2026-03-02',
        updated_at: '2026-03-06',
    },
    {
        id: 'c3',
        name: 'Charlie Wong',
        phone: '+6593333333',
        email: null,
        status: 'approved',
        assigned_manager_id: 'mgr-1',
        assigned_manager_name: 'Manager',
        created_by_id: 'user-1',
        invite_token: null,
        notes: null,
        resume_url: null,
        profile_pdf_path: null,
        disc_pdf_path: null,
        interviews: [],
        created_at: '2026-03-03',
        updated_at: '2026-03-07',
    },
];

beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({ data: CANDIDATES, error: null, hasMore: false });
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-1', role: 'manager' } });
    (useTypedRouter as jest.Mock).mockReturnValue({ push: mockPush, replace: jest.fn(), back: jest.fn() });
});

describe('CandidateListScreen', () => {
    it('renders candidates after loading', async () => {
        const { getByText, queryByText } = render(
            <CandidateListScreen candidateRoute={(id) => `/candidates/${id}`} addRoute="/team/add-candidate" />,
        );

        await waitFor(() => {
            expect(getByText('Alice Tan')).toBeTruthy();
        });

        expect(getByText('Bob Lim')).toBeTruthy();
        expect(getByText('Charlie Wong')).toBeTruthy();
    });

    it('shows loading state initially', () => {
        // Never resolve the fetch
        mockFetch.mockReturnValue(new Promise(() => {}));

        const { getByText } = render(
            <CandidateListScreen candidateRoute={(id) => `/candidates/${id}`} addRoute="/add" />,
        );

        expect(getByText('Candidates')).toBeTruthy();
    });

    it('shows error banner on fetch failure', async () => {
        mockFetch.mockResolvedValue({ data: [], error: 'Network error', hasMore: false });

        const { getByText } = render(
            <CandidateListScreen candidateRoute={(id) => `/candidates/${id}`} addRoute="/add" />,
        );

        await waitFor(() => {
            expect(getByText('Network error')).toBeTruthy();
        });
    });

    it('shows empty state when no candidates match', async () => {
        mockFetch.mockResolvedValue({ data: [], error: null, hasMore: false });

        const { getByText } = render(
            <CandidateListScreen candidateRoute={(id) => `/candidates/${id}`} addRoute="/add" />,
        );

        await waitFor(() => {
            expect(getByText('No candidates found')).toBeTruthy();
        });
    });

    it('search filters candidates by name', async () => {
        const { getByText, getByPlaceholderText, queryByText } = render(
            <CandidateListScreen candidateRoute={(id) => `/candidates/${id}`} addRoute="/add" />,
        );

        await waitFor(() => {
            expect(getByText('Alice Tan')).toBeTruthy();
        });

        const searchInput = getByPlaceholderText('Search candidates...');
        fireEvent.changeText(searchInput, 'Alice');

        await waitFor(() => {
            expect(getByText('Alice Tan')).toBeTruthy();
            expect(queryByText('Bob Lim')).toBeNull();
            expect(queryByText('Charlie Wong')).toBeNull();
        });
    });

    it('navigates to candidate on press', async () => {
        const { getByText } = render(
            <CandidateListScreen candidateRoute={(id) => `/candidates/${id}`} addRoute="/add" />,
        );

        await waitFor(() => {
            expect(getByText('Alice Tan')).toBeTruthy();
        });

        // CandidateCard has a TouchableOpacity — find the card and press it
        // The entire card is wrapped in a press handler
        fireEvent.press(getByText('Alice Tan'));

        expect(mockPush).toHaveBeenCalledWith('/candidates/c1');
    });

    it('navigates to add route on add button press', async () => {
        const { getByLabelText } = render(
            <CandidateListScreen candidateRoute={(id) => `/candidates/${id}`} addRoute="/team/add-candidate" />,
        );

        await waitFor(() => {
            expect(getByLabelText('Add new candidate')).toBeTruthy();
        });

        fireEvent.press(getByLabelText('Add new candidate'));
        expect(mockPush).toHaveBeenCalledWith('/team/add-candidate');
    });

    it('does not fetch when no user', async () => {
        (useAuth as jest.Mock).mockReturnValue({ user: null });

        render(<CandidateListScreen candidateRoute={(id) => `/candidates/${id}`} addRoute="/add" />);

        // Should not call fetchCandidates
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('passes isManagerView to fetchCandidates', async () => {
        const { getByText } = render(
            <CandidateListScreen candidateRoute={(id) => `/candidates/${id}`} addRoute="/add" isManagerView={true} />,
        );

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith('user-1', true);
        });
    });
});
