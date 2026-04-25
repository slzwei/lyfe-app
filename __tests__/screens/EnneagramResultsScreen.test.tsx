/**
 * Tests for app/(tabs)/exams/results/enneagram/[attemptId].tsx
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import EnneagramResultsScreen from '@/app/(tabs)/exams/results/enneagram/[attemptId]';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { fetchExamResult } from '@/lib/exams';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/lib/exams');

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
    ...jest.requireActual('expo-router'),
    useLocalSearchParams: () => ({ attemptId: 'enn-1' }),
    useRouter: () => ({ replace: mockReplace, back: jest.fn() }),
    useSegments: () => ['(tabs)', 'exams'],
}));

const MOCK_ENNEAGRAM = {
    personalityResults: {
        quizType: 'enneagram',
        scores: { '1': 5, '2': 3, '3': 7, '4': 2, '5': 4, '6': 1, '7': 6, '8': 3, '9': 2 },
        percentages: { '1': 15, '2': 9, '3': 21, '4': 6, '5': 12, '6': 3, '7': 18, '8': 9, '9': 6 },
        primaryType: 3,
        wing: 2,
        topTypes: [3],
    },
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
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (fetchExamResult as jest.Mock).mockResolvedValue({ data: null, error: null });
});

describe('EnneagramResultsScreen', () => {
    it('loads results from AsyncStorage', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(MOCK_ENNEAGRAM));

        const { getByText } = render(<EnneagramResultsScreen />);

        await waitFor(() => {
            expect(getByText('Your Enneagram Type')).toBeTruthy();
            expect(getByText('Score Breakdown')).toBeTruthy();
        });
    });

    it('falls back to Supabase', async () => {
        (fetchExamResult as jest.Mock).mockResolvedValue({
            data: { personalityResults: MOCK_ENNEAGRAM.personalityResults },
            error: null,
        });

        const { getByText } = render(<EnneagramResultsScreen />);

        await waitFor(() => {
            expect(getByText('Your Enneagram Type')).toBeTruthy();
        });
    });

    it('shows error state when no results', async () => {
        const { getByText } = render(<EnneagramResultsScreen />);

        await waitFor(() => {
            expect(getByText(/Result not found/)).toBeTruthy();
        });
    });

    it('renders type description and strengths', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(MOCK_ENNEAGRAM));

        const { getByText } = render(<EnneagramResultsScreen />);

        await waitFor(() => {
            expect(getByText('Score Breakdown')).toBeTruthy();
            expect(getByText('Strengths')).toBeTruthy();
            expect(getByText('Growth')).toBeTruthy();
        });
    });

    it('renders wing badge', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(MOCK_ENNEAGRAM));

        const { getByText } = render(<EnneagramResultsScreen />);

        await waitFor(() => {
            expect(getByText(/Wing 2/)).toBeTruthy();
        });
    });

    it('navigates on Done press', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(MOCK_ENNEAGRAM));

        const { getByText } = render(<EnneagramResultsScreen />);

        await waitFor(() => {
            expect(getByText('Done')).toBeTruthy();
        });

        fireEvent.press(getByText('Done'));
        expect(mockReplace).toHaveBeenCalled();
    });

    it('shows Supabase error message', async () => {
        (fetchExamResult as jest.Mock).mockResolvedValue({ data: null, error: 'Server error' });

        const { getByText } = render(<EnneagramResultsScreen />);

        await waitFor(() => {
            expect(getByText('Server error')).toBeTruthy();
        });
    });
});
