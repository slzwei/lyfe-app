/**
 * Tests for app/(tabs)/exams/results/[attemptId].tsx — Generic exam results
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ExamResultsScreen from '@/app/(tabs)/exams/results/[attemptId]';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { fetchExamResult } from '@/lib/exams';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/lib/exams');
jest.mock('@/components/MathRenderer', () => {
    const { Text } = require('react-native');
    return function MockMathRenderer({ content }: { content: string }) {
        return <Text>{content}</Text>;
    };
});

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
    ...jest.requireActual('expo-router'),
    useLocalSearchParams: () => ({ attemptId: 'attempt-1' }),
    useRouter: () => ({ replace: mockReplace, back: mockBack, canGoBack: () => true }),
    useSegments: () => ['(tabs)', 'exams'],
}));

const MOCK_RESULT = {
    id: 'attempt-1',
    score: 4,
    totalQuestions: 5,
    percentage: 80,
    passed: true,
    status: 'submitted',
    paperCode: 'M9',
    answers: [
        { questionId: 'q1', selected: 'B', isCorrect: true, correctAnswer: 'B' },
        { questionId: 'q2', selected: 'A', isCorrect: false, correctAnswer: 'B' },
    ],
    questions: [
        {
            id: 'q1',
            paper_id: 'p1',
            question_number: 1,
            question_text: 'What is 1+1?',
            options: { A: '1', B: '2', C: '3', D: '4' },
            correct_answer: 'B',
            has_latex: false,
            explanation: null,
            explanation_has_latex: false,
        },
        {
            id: 'q2',
            paper_id: 'p1',
            question_number: 2,
            question_text: 'What is 2+2?',
            options: { A: '3', B: '4', C: '5', D: '6' },
            correct_answer: 'B',
            has_latex: false,
            explanation: 'Basic math',
            explanation_has_latex: false,
        },
    ],
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

describe('ExamResultsScreen', () => {
    it('loads result from AsyncStorage', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(MOCK_RESULT));

        const { getByText } = render(<ExamResultsScreen />);

        await waitFor(() => {
            expect(getByText('80%')).toBeTruthy();
            expect(getByText('PASSED')).toBeTruthy();
            expect(getByText('M9 Results')).toBeTruthy();
        });
    });

    it('falls back to Supabase when AsyncStorage empty', async () => {
        (fetchExamResult as jest.Mock).mockResolvedValue({ data: MOCK_RESULT, error: null });

        const { getByText } = render(<ExamResultsScreen />);

        await waitFor(() => {
            expect(getByText('80%')).toBeTruthy();
        });
    });

    it('shows not-found state when no result', async () => {
        const { getByText } = render(<ExamResultsScreen />);

        await waitFor(() => {
            expect(getByText('Result not found')).toBeTruthy();
        });
    });

    it('renders score stats', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(MOCK_RESULT));

        const { getByText } = render(<ExamResultsScreen />);

        await waitFor(() => {
            expect(getByText('Correct')).toBeTruthy();
            expect(getByText('Wrong')).toBeTruthy();
            expect(getByText('Total')).toBeTruthy();
        });
    });

    it('renders question review section', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(MOCK_RESULT));

        const { getByText } = render(<ExamResultsScreen />);

        await waitFor(() => {
            expect(getByText('Question Review')).toBeTruthy();
            expect(getByText('Q1')).toBeTruthy();
            expect(getByText('Q2')).toBeTruthy();
        });
    });

    it('expands question on press to show details', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(MOCK_RESULT));

        const { getByText } = render(<ExamResultsScreen />);

        await waitFor(() => {
            expect(getByText('Q1')).toBeTruthy();
        });

        // Press Q2 to expand — it has an explanation
        fireEvent.press(getByText('Q2'));

        await waitFor(() => {
            expect(getByText('What is 2+2?')).toBeTruthy();
            expect(getByText('Basic math')).toBeTruthy();
        });
    });

    it('shows auto-submitted note', async () => {
        const autoResult = { ...MOCK_RESULT, status: 'auto_submitted' };
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(autoResult));

        const { getByText } = render(<ExamResultsScreen />);

        await waitFor(() => {
            expect(getByText('Auto-submitted (time expired)')).toBeTruthy();
        });
    });

    it('renders failed result correctly', async () => {
        const failedResult = { ...MOCK_RESULT, passed: false, score: 2, percentage: 40 };
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(failedResult));

        const { getByText } = render(<ExamResultsScreen />);

        await waitFor(() => {
            expect(getByText('FAILED')).toBeTruthy();
            expect(getByText('40%')).toBeTruthy();
        });
    });

    it('navigates back on done press', async () => {
        const { getByText } = render(<ExamResultsScreen />);

        await waitFor(() => {
            expect(getByText('Result not found')).toBeTruthy();
        });

        fireEvent.press(getByText('Back to Exams'));
        expect(mockBack).toHaveBeenCalled();
    });
});
