/**
 * Tests for app/(tabs)/exams/results/disc/[attemptId].tsx
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import DiscResultsScreen from '@/app/(tabs)/exams/results/disc/[attemptId]';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { fetchExamResult } from '@/lib/exams';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/lib/exams');
// Mock react-native-svg since it uses native modules
jest.mock('react-native-svg', () => {
    const { View, Text } = require('react-native');
    return {
        __esModule: true,
        default: View,
        Circle: View,
        Line: View,
        Path: View,
        Text: Text,
        Svg: View,
    };
});

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
    ...jest.requireActual('expo-router'),
    useLocalSearchParams: () => ({ attemptId: 'disc-1' }),
    useRouter: () => ({ replace: mockReplace, back: jest.fn() }),
    useSegments: () => ['(tabs)', 'exams'],
}));

const MOCK_DISC = {
    personalityResults: {
        quizType: 'disc',
        d_raw: 30,
        i_raw: 25,
        s_raw: 20,
        c_raw: 25,
        d_pct: 30,
        i_pct: 25,
        s_pct: 20,
        c_pct: 25,
        disc_type: 'Di',
        angle: 45,
        profile_strength: 'strong',
        strength_pct: 30,
        priorities: ['Results', 'Action'],
        totalQuestions: 38,
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

describe('DiscResultsScreen', () => {
    it('loads results from AsyncStorage', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(MOCK_DISC));

        const { getByText } = render(<DiscResultsScreen />);

        await waitFor(() => {
            expect(getByText('Your DISC Profile')).toBeTruthy();
        });
    });

    it('falls back to Supabase', async () => {
        (fetchExamResult as jest.Mock).mockResolvedValue({
            data: { personalityResults: MOCK_DISC.personalityResults },
            error: null,
        });

        const { getByText } = render(<DiscResultsScreen />);

        await waitFor(() => {
            expect(getByText('Your DISC Profile')).toBeTruthy();
        });
    });

    it('shows error state when no results', async () => {
        const { getByText } = render(<DiscResultsScreen />);

        await waitFor(() => {
            expect(getByText(/Result not found/)).toBeTruthy();
        });
    });

    it('renders DISC percentages', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(MOCK_DISC));

        const { getAllByText } = render(<DiscResultsScreen />);

        await waitFor(() => {
            expect(getAllByText('Drive').length).toBeGreaterThanOrEqual(1);
            expect(getAllByText('Influence').length).toBeGreaterThanOrEqual(1);
            expect(getAllByText('Support').length).toBeGreaterThanOrEqual(1);
            expect(getAllByText('Clarity').length).toBeGreaterThanOrEqual(1);
        });
    });

    it('renders profile sections', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(MOCK_DISC));

        const { getByText } = render(<DiscResultsScreen />);

        await waitFor(() => {
            expect(getByText('YOUR DISC PROFILE')).toBeTruthy();
            expect(getByText('Your DISC Profile')).toBeTruthy();
        });
    });

    it('renders Done and Retake buttons', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(MOCK_DISC));

        const { getByText } = render(<DiscResultsScreen />);

        await waitFor(() => {
            expect(getByText('Done')).toBeTruthy();
            expect(getByText('Retake')).toBeTruthy();
        });

        fireEvent.press(getByText('Done'));
        expect(mockReplace).toHaveBeenCalled();
    });

    it('shows Supabase error', async () => {
        (fetchExamResult as jest.Mock).mockResolvedValue({ data: null, error: 'DB error' });

        const { getByText } = render(<DiscResultsScreen />);

        await waitFor(() => {
            expect(getByText('DB error')).toBeTruthy();
        });
    });
});
