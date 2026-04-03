/**
 * Tests for app/(tabs)/team/candidate/[candidateId].tsx
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert, Share } from 'react-native';
import TeamCandidateDetailScreen from '@/app/(tabs)/team/candidate/[candidateId]';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import {
    fetchCandidate,
    fetchAssignableManagers,
    updateCandidateStatus,
    addCandidateActivity,
    reassignCandidate,
    syncAgentToMKTR,
} from '@/lib/recruitment';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/lib/recruitment');

jest.mock('@/components/LoadingState', () => {
    const { Text } = require('react-native');
    return () => <Text>Loading...</Text>;
});

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    ...jest.requireActual('expo-router'),
    useLocalSearchParams: () => ({ candidateId: 'cand-1' }),
    useSegments: () => ['(tabs)', 'team'],
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
    notes: 'Promising candidate',
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
    (fetchAssignableManagers as jest.Mock).mockResolvedValue({ data: [], error: null });
});

describe('TeamCandidateDetailScreen', () => {
    it('renders candidate phone number', async () => {
        const { getByText } = render(<TeamCandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText('+6598765432')).toBeTruthy();
        });
    });

    it('renders candidate email', async () => {
        const { getByText } = render(<TeamCandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText('jane@example.com')).toBeTruthy();
        });
    });

    it('renders candidate notes', async () => {
        const { getByText } = render(<TeamCandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText('Promising candidate')).toBeTruthy();
        });
    });

    it('renders manager name', async () => {
        const { getByText } = render(<TeamCandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText(/Manager Alice/)).toBeTruthy();
        });
    });

    it('shows not found when candidate is missing', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({ data: null, error: 'Not found' });
        const { getByText } = render(<TeamCandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText(/not found/i)).toBeTruthy();
        });
    });

    it('renders candidate initial avatar', async () => {
        const { getByText } = render(<TeamCandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText('J')).toBeTruthy(); // Jane Smith initial
        });
    });

    it('renders action buttons (Schedule, Note, Call)', async () => {
        const { getByText } = render(<TeamCandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText('Schedule')).toBeTruthy();
            expect(getByText('Note')).toBeTruthy();
            expect(getByText('Call')).toBeTruthy();
        });
    });

    it('renders invite link banner for applied candidates with token', async () => {
        const { getByText } = render(<TeamCandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText('Copy Invite Link')).toBeTruthy();
        });
    });

    it('does not show invite banner when status is not applied', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { ...MOCK_CANDIDATE, status: 'interview_scheduled' },
            error: null,
        });
        const { queryByText } = render(<TeamCandidateDetailScreen />);
        await waitFor(() => {
            expect(queryByText('Copy Invite Link')).toBeNull();
        });
    });

    it('shares invite link on banner press', async () => {
        jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);

        const { getByText } = render(<TeamCandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText('Copy Invite Link')).toBeTruthy();
        });

        fireEvent.press(getByText('Copy Invite Link'));
        expect(Share.share).toHaveBeenCalled();
    });

    it('renders notes section', async () => {
        const { getByText } = render(<TeamCandidateDetailScreen />);
        await waitFor(() => {
            expect(getByText('Promising candidate')).toBeTruthy();
        });
    });
});
