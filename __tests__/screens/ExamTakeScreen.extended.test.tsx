/**
 * Extended tests for app/(tabs)/exams/take/[paperId].tsx — deeper coverage
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { submitExamAttempt } from '@/lib/exams';
import AsyncStorage from '@react-native-async-storage/async-storage';

import TakeExamScreen from '@/app/(tabs)/exams/take/[paperId]';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/lib/exams');
jest.mock('@/lib/vark');
jest.mock('@/lib/enneagram');

jest.mock('expo-router', () => ({
    useRouter: jest.fn(() => ({
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
    })),
    useLocalSearchParams: jest.fn(() => ({})),
    useSegments: jest.fn(() => []),
    useFocusEffect: jest.fn((cb: any) => cb()),
    Link: 'Link',
    Tabs: { Screen: 'Screen' },
}));

jest.mock('@/components/ConfirmDialog', () => {
    const { View, Text, TouchableOpacity } = require('react-native');
    return {
        __esModule: true,
        default: function MockConfirmDialog({ visible, title, buttons }: any) {
            if (!visible) return null;
            return (
                <View testID="confirm-dialog">
                    <Text>{title}</Text>
                    {buttons?.map((btn: any, i: number) => (
                        <TouchableOpacity key={i} testID={`dialog-btn-${i}`} onPress={btn.onPress}>
                            <Text>{btn.text}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            );
        },
    };
});

jest.mock('@/components/ErrorBanner', () => {
    const { Text } = require('react-native');
    return function MockErrorBanner({ message }: { message: string }) {
        return <Text>{message}</Text>;
    };
});

jest.mock('@/components/MathRenderer', () => {
    const { Text } = require('react-native');
    return function MockMathRenderer({ content }: { content: string }) {
        return <Text>{content}</Text>;
    };
});

const mockSupa = supabase as any;

const MOCK_QUESTIONS = [
    {
        id: 'q1',
        paper_id: 'paper-1',
        question_number: 1,
        question_text: 'What is insurance?',
        options: { A: 'Coverage', B: 'Gambling', C: 'Savings', D: 'Tax' },
        correct_answer: 'A',
        explanation: null,
        has_latex: false,
    },
    {
        id: 'q2',
        paper_id: 'paper-1',
        question_number: 2,
        question_text: 'What is a premium?',
        options: { A: 'Payment', B: 'Discount', C: 'Bonus', D: 'Fee' },
        correct_answer: 'A',
        explanation: null,
        has_latex: false,
    },
    {
        id: 'q3',
        paper_id: 'paper-1',
        question_number: 3,
        question_text: 'What is a deductible?',
        options: { A: 'Co-pay', B: 'Threshold', C: 'Amount', D: 'Clause' },
        correct_answer: 'B',
        explanation: 'A deductible is the amount you pay before insurance kicks in.',
        has_latex: false,
    },
];

const mockReplace = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    (useTheme as jest.Mock).mockReturnValue({
        colors: Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    });

    (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'user-1', full_name: 'Test User', role: 'candidate' },
    });

    (useLocalSearchParams as jest.Mock).mockReturnValue({ paperId: 'paper-1' });
    (useRouter as jest.Mock).mockReturnValue({
        push: jest.fn(),
        replace: mockReplace,
        back: jest.fn(),
    });
    (useSegments as jest.Mock).mockReturnValue(['(tabs)', 'exams', 'take', 'paper-1']);

    mockSupa.rpc.mockImplementation((fn: string) => {
        if (fn === 'get_exam_questions') {
            return Promise.resolve({ data: MOCK_QUESTIONS, error: null });
        }
        return Promise.resolve({ data: null, error: null });
    });

    const papersChain = mockSupa.__getChain('exam_papers');
    papersChain.__resolveWith({
        data: { duration_minutes: 60, allow_multiple_answers: false, title: 'Module 9' },
        error: null,
    });

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

    (submitExamAttempt as jest.Mock).mockResolvedValue({
        data: { id: 'attempt-1', score: 3, totalQuestions: 3, percentage: 100, passed: true, paperCode: 'M9' },
        error: null,
    });
});

afterEach(() => {
    jest.useRealTimers();
    mockSupa.__resetChains();
});

describe('TakeExamScreen extended', () => {
    it('navigates through all questions using Next', async () => {
        const { getByText } = render(<TakeExamScreen />);

        await waitFor(() => {
            expect(getByText('What is insurance?')).toBeTruthy();
        });

        fireEvent.press(getByText('Next'));
        await waitFor(() => {
            expect(getByText('What is a premium?')).toBeTruthy();
        });

        fireEvent.press(getByText('Next'));
        await waitFor(() => {
            expect(getByText('What is a deductible?')).toBeTruthy();
        });
    });

    it('navigates back using Prev', async () => {
        const { getByText } = render(<TakeExamScreen />);

        await waitFor(() => {
            expect(getByText('What is insurance?')).toBeTruthy();
        });

        fireEvent.press(getByText('Next'));
        await waitFor(() => {
            expect(getByText('What is a premium?')).toBeTruthy();
        });

        fireEvent.press(getByText('Prev'));
        await waitFor(() => {
            expect(getByText('What is insurance?')).toBeTruthy();
        });
    });

    it('displays timer', async () => {
        const { getByText } = render(<TakeExamScreen />);

        await waitFor(() => {
            expect(getByText('60:00')).toBeTruthy();
        });
    });

    it('auto-saves answers to AsyncStorage', async () => {
        const { getByText, getByLabelText } = render(<TakeExamScreen />);

        await waitFor(() => {
            expect(getByText('What is insurance?')).toBeTruthy();
        });

        fireEvent.press(getByLabelText('Option A: Coverage'));

        // AsyncStorage should be called for auto-save
        await waitFor(() => {
            expect(AsyncStorage.setItem).toHaveBeenCalled();
        });
    });

    it('displays question count in progress indicator', async () => {
        const { getByText } = render(<TakeExamScreen />);

        await waitFor(() => {
            expect(getByText('1 / 3')).toBeTruthy();
        });
    });

    it('shows Submit button on last question', async () => {
        const { getByText } = render(<TakeExamScreen />);

        await waitFor(() => {
            expect(getByText('What is insurance?')).toBeTruthy();
        });

        fireEvent.press(getByText('Next'));
        fireEvent.press(getByText('Next'));

        await waitFor(() => {
            expect(getByText('Submit')).toBeTruthy();
        });
    });

    it('shows unanswered warning dialog on submit without answering', async () => {
        const { getByText } = render(<TakeExamScreen />);

        await waitFor(() => {
            expect(getByText('What is insurance?')).toBeTruthy();
        });

        // Navigate to last and press Submit without answering
        fireEvent.press(getByText('Next'));
        fireEvent.press(getByText('Next'));
        fireEvent.press(getByText('Submit'));

        await waitFor(() => {
            expect(getByText('Unanswered Questions')).toBeTruthy();
        });
    });

    it('submits exam and navigates to results on confirm', async () => {
        const { getByText, getByLabelText, getByTestId } = render(<TakeExamScreen />);

        await waitFor(() => {
            expect(getByText('What is insurance?')).toBeTruthy();
        });

        // Answer all questions
        fireEvent.press(getByLabelText('Option A: Coverage'));
        fireEvent.press(getByText('Next'));
        await waitFor(() => expect(getByText('What is a premium?')).toBeTruthy());
        fireEvent.press(getByLabelText('Option A: Payment'));
        fireEvent.press(getByText('Next'));
        await waitFor(() => expect(getByText('What is a deductible?')).toBeTruthy());
        fireEvent.press(getByLabelText('Option B: Threshold'));

        // Submit
        fireEvent.press(getByText('Submit'));
        await waitFor(() => expect(getByText('Submit Exam')).toBeTruthy());

        // Confirm submit
        await act(async () => {
            fireEvent.press(getByTestId('dialog-btn-1')); // "Submit" button
        });

        await waitFor(() => {
            expect(submitExamAttempt).toHaveBeenCalled();
            expect(mockReplace).toHaveBeenCalled();
        });
    });
});

// ── VARK multi-select mode ──

describe('TakeExamScreen VARK multi-select', () => {
    const VARK_QUESTIONS = [
        {
            id: 'vq1',
            paper_id: 'p-vark',
            question_number: 1,
            question_text: 'How do you learn best?',
            options: { A: 'Diagrams', B: 'Listening', C: 'Reading', D: 'Practice' },
            correct_answer: 'A:V,B:A,C:R,D:K',
            explanation: '{"quiz_type":"vark","types":{"A":"V","B":"A","C":"R","D":"K"}}',
            has_latex: false,
        },
        {
            id: 'vq2',
            paper_id: 'p-vark',
            question_number: 2,
            question_text: 'When studying...',
            options: { A: 'Charts', B: 'Discussion', C: 'Notes', D: 'Hands-on' },
            correct_answer: 'A:V,B:A,C:R,D:K',
            explanation: '{"quiz_type":"vark","types":{"A":"V","B":"A","C":"R","D":"K"}}',
            has_latex: false,
        },
    ];

    beforeEach(() => {
        mockSupa.rpc.mockImplementation((fn: string) => {
            if (fn === 'get_exam_questions') {
                return Promise.resolve({ data: VARK_QUESTIONS, error: null });
            }
            return Promise.resolve({ data: null, error: null });
        });

        mockSupa.__resetChains();
        const papersChain = mockSupa.__getChain('exam_papers');
        papersChain.__resolveWith({
            data: { duration_minutes: 30, allow_multiple_answers: true, title: 'VARK' },
            error: null,
        });
    });

    it('renders VARK quiz with multi-select options', async () => {
        const { getByText } = render(<TakeExamScreen />);

        await waitFor(() => {
            expect(getByText('How do you learn best?')).toBeTruthy();
        });
    });

    it('shows all-questions-required dialog for personality quiz with unanswered', async () => {
        const { getByText } = render(<TakeExamScreen />);

        await waitFor(() => {
            expect(getByText('How do you learn best?')).toBeTruthy();
        });

        // Navigate to last question without answering
        fireEvent.press(getByText('Next'));
        await waitFor(() => expect(getByText('When studying...')).toBeTruthy());

        // Submit without answering all
        fireEvent.press(getByText('Submit'));

        await waitFor(() => {
            expect(getByText('All Questions Required')).toBeTruthy();
        });
    });
});
