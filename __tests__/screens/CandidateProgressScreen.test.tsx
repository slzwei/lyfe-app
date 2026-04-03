/**
 * Tests for app/(tabs)/candidates/progress/[candidateId].tsx
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import CandidateProgressScreen from '@/app/(tabs)/candidates/progress/[candidateId]';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { fetchCandidate } from '@/lib/recruitment';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/lib/recruitment');
jest.mock('@/components/ScreenHeader', () => {
    const { Text } = require('react-native');
    return function MockScreenHeader({ title }: { title: string }) {
        return <Text>{title}</Text>;
    };
});
jest.mock('@/components/LoadingState', () => {
    const { Text } = require('react-native');
    return function MockLoading() {
        return <Text>Loading...</Text>;
    };
});
jest.mock('@/components/roadmap/CandidateProgressView', () => {
    const { Text } = require('react-native');
    return function MockCandidateProgressView({ candidateName }: { candidateName: string }) {
        return <Text testID="progress-view">{candidateName} progress</Text>;
    };
});

jest.mock('expo-router', () => ({
    ...jest.requireActual('expo-router'),
    useLocalSearchParams: () => ({ candidateId: 'cand-1' }),
    useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

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
        user: { id: 'user-1', role: 'manager' },
    });
});

describe('CandidateProgressScreen', () => {
    it('shows loading state initially', () => {
        (fetchCandidate as jest.Mock).mockReturnValue(new Promise(() => {})); // never resolves
        const { getByText } = render(<CandidateProgressScreen />);
        expect(getByText('Loading...')).toBeTruthy();
    });

    it('renders candidate roadmap on success', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({
            data: { name: 'Jane Smith' },
            error: null,
        });

        const { getByText } = render(<CandidateProgressScreen />);

        await waitFor(() => {
            expect(getByText("Jane Smith's Roadmap")).toBeTruthy();
            expect(getByText('Jane Smith progress')).toBeTruthy();
        });
    });

    it('shows not-found state when candidate missing', async () => {
        (fetchCandidate as jest.Mock).mockResolvedValue({ data: null, error: 'Not found' });

        const { getByText } = render(<CandidateProgressScreen />);

        await waitFor(() => {
            expect(getByText('Candidate not found')).toBeTruthy();
        });
    });
});
