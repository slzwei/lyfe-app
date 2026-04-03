/**
 * Tests for app/(tabs)/exams/results/vark/[attemptId].tsx
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import VarkResultsScreen from '@/app/(tabs)/exams/results/vark/[attemptId]';
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
    useLocalSearchParams: () => ({ attemptId: 'vark-1' }),
    useRouter: () => ({ replace: mockReplace, back: jest.fn() }),
    useSegments: () => ['(tabs)', 'exams'],
}));

const MOCK_VARK = {
    personalityResults: {
        scores: { V: 6, A: 4, R: 3, K: 3 },
        percentages: { V: 38, A: 25, R: 19, K: 19 },
        preference: 'single',
        topTypes: ['V'],
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

describe('VarkResultsScreen', () => {
    it('loads VARK results from AsyncStorage', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(MOCK_VARK));

        const { getByText } = render(<VarkResultsScreen />);

        await waitFor(() => {
            expect(getByText('Your Learning Style')).toBeTruthy();
            expect(getByText('Single Preference')).toBeTruthy();
            expect(getByText('Score Breakdown')).toBeTruthy();
        });
    });

    it('falls back to Supabase', async () => {
        (fetchExamResult as jest.Mock).mockResolvedValue({
            data: { personalityResults: MOCK_VARK.personalityResults },
            error: null,
        });

        const { getByText } = render(<VarkResultsScreen />);

        await waitFor(() => {
            expect(getByText('Your Learning Style')).toBeTruthy();
        });
    });

    it('shows error state when no results', async () => {
        const { getByText } = render(<VarkResultsScreen />);

        await waitFor(() => {
            expect(getByText(/Result not found/)).toBeTruthy();
        });
    });

    it('renders type detail cards with tips', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(MOCK_VARK));

        const { getByText, getAllByText } = render(<VarkResultsScreen />);

        await waitFor(() => {
            expect(getByText('What This Means')).toBeTruthy();
            expect(getAllByText('Visual').length).toBeGreaterThanOrEqual(1);
            expect(getByText('Study Tips')).toBeTruthy();
        });
    });

    it('renders Done and Retake buttons', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(MOCK_VARK));

        const { getByText } = render(<VarkResultsScreen />);

        await waitFor(() => {
            expect(getByText('Done')).toBeTruthy();
            expect(getByText('Retake')).toBeTruthy();
        });

        fireEvent.press(getByText('Done'));
        expect(mockReplace).toHaveBeenCalled();
    });

    it('renders multimodal results with note', async () => {
        const multimodal = {
            personalityResults: {
                scores: { V: 5, A: 5, R: 3, K: 3 },
                percentages: { V: 31, A: 31, R: 19, K: 19 },
                preference: 'bimodal',
                topTypes: ['V', 'A'],
            },
        };
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(multimodal));

        const { getByText } = render(<VarkResultsScreen />);

        await waitFor(() => {
            expect(getByText('Bimodal')).toBeTruthy();
            expect(getByText(/use strategies from each/)).toBeTruthy();
        });
    });
});
