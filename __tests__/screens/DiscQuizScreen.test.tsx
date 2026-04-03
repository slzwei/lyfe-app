/**
 * Tests for app/(tabs)/exams/disc.tsx — DISC personality quiz
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import DiscQuizScreen from '@/app/(tabs)/exams/disc';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/lib/exams');
jest.mock('@/lib/disc');
jest.mock('@/components/ConfirmDialog', () => {
    const { View, Text, TouchableOpacity } = require('react-native');
    return function MockConfirmDialog({ visible, title, buttons }: any) {
        if (!visible) return null;
        return (
            <View testID="confirm-dialog">
                <Text>{title}</Text>
                {buttons?.map((b: any, i: number) => (
                    <TouchableOpacity key={i} onPress={b.onPress}>
                        <Text>{b.text}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };
});

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
    ...jest.requireActual('expo-router'),
    useLocalSearchParams: () => ({ paperId: 'disc-paper-1' }),
    useSegments: () => ['(tabs)', 'exams'],
}));
jest.mock('@/hooks/useTypedRouter', () => ({
    useTypedRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
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
        user: { id: 'user-1', role: 'candidate' },
    });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

    // Mock supabase query for paperId
    const mockSupa = require('@/lib/supabase').supabase;
    mockSupa.__resetChains();
    const papersChain = mockSupa.__getChain('exam_papers');
    papersChain.__resolveWith({ data: { id: 'disc-paper-1', code: 'DISC' }, error: null });
});

describe('DiscQuizScreen', () => {
    it('renders quiz header with step indicator', async () => {
        const { getByText } = render(<DiscQuizScreen />);
        await waitFor(() => {
            expect(getByText('DISC Assessment')).toBeTruthy();
            expect(getByText(/Step 1/)).toBeTruthy();
        });
    });

    it('renders progress bar', async () => {
        const { getByText } = render(<DiscQuizScreen />);
        await waitFor(() => {
            expect(getByText(/of 5/)).toBeTruthy();
        });
    });

    it('renders first step questions', async () => {
        const { getByText } = render(<DiscQuizScreen />);
        await waitFor(() => {
            expect(getByText(/Step 1/)).toBeTruthy();
        });
    });

    it('navigates back with Prev button', async () => {
        // Start from step 2 via saved progress
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
            JSON.stringify({ paperId: 'disc-paper-1', answers: {}, currentStep: 2, startedAt: Date.now() }),
        );

        const { getByText } = render(<DiscQuizScreen />);
        await waitFor(() => {
            expect(getByText(/Step 2/)).toBeTruthy();
        });

        fireEvent.press(getByText('Previous'));

        await waitFor(() => {
            expect(getByText(/Step 1/)).toBeTruthy();
        });
    });

    it('restores progress from AsyncStorage', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
            JSON.stringify({
                paperId: 'disc-paper-1',
                answers: { 1: 3, 2: 4 },
                currentStep: 3,
                startedAt: Date.now() - 60000,
            }),
        );

        const { getByText } = render(<DiscQuizScreen />);
        await waitFor(() => {
            expect(getByText(/Step 3/)).toBeTruthy();
        });
    });

    it('clears saved state when paperId does not match', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
            JSON.stringify({
                paperId: 'other-paper',
                answers: { 1: 3 },
                currentStep: 4,
                startedAt: Date.now(),
            }),
        );

        const { getByText } = render(<DiscQuizScreen />);
        await waitFor(() => {
            // Should start from step 1 since paperId didn't match
            expect(getByText(/Step 1/)).toBeTruthy();
        });

        expect(AsyncStorage.removeItem).toHaveBeenCalledWith('lyfe_disc_quiz');
    });

    it('renders step description', async () => {
        const { getByText } = render(<DiscQuizScreen />);
        await waitFor(() => {
            expect(getByText('DISC Assessment')).toBeTruthy();
        });
    });
});
