/**
 * Tests for app/(tabs)/exams/take/[paperId].tsx — Exam take screen
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/lib/exams');
jest.mock('@/lib/vark');
jest.mock('@/lib/enneagram');

// Override expo-router mock to include useSegments
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
        default: function MockConfirmDialog({ visible, title, message, buttons }: any) {
            if (!visible) return null;
            return (
                <View testID="confirm-dialog">
                    <Text testID="dialog-title">{title}</Text>
                    <Text testID="dialog-message">{message}</Text>
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
        return <Text testID="error-banner">{message}</Text>;
    };
});

jest.mock('@/components/MathRenderer', () => {
    const { Text } = require('react-native');
    return function MockMathRenderer({ content }: { content: string }) {
        return <Text>{content}</Text>;
    };
});

const mockSupa = supabase as any;

import TakeExamScreen from '@/app/(tabs)/exams/take/[paperId]';

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
];

const mockReplace = jest.fn();
const mockBack = jest.fn();

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
        back: mockBack,
    });
    (useSegments as jest.Mock).mockReturnValue(['(tabs)', 'exams', 'take', 'paper-1']);

    // Mock supabase chain for exam_questions
    const questionsChain = mockSupa.__getChain('exam_questions');
    questionsChain.__resolveWith({ data: MOCK_QUESTIONS, error: null });

    // Mock supabase chain for exam_papers
    const papersChain = mockSupa.__getChain('exam_papers');
    papersChain.__resolveWith({
        data: { duration_minutes: 60, allow_multiple_answers: false, title: 'Module 5' },
        error: null,
    });

    // No saved state
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
});

afterEach(() => {
    jest.useRealTimers();
    mockSupa.__resetChains();
});

describe('TakeExamScreen', () => {
    it('shows loading state while fetching questions', () => {
        // Override to return a pending promise
        const questionsChain = mockSupa.__getChain('exam_questions');
        questionsChain.__resolveWith(new Promise(() => {}));

        const { getByText } = render(<TakeExamScreen />);
        expect(getByText('Loading questions...')).toBeTruthy();
    });

    it('renders first question after loading', async () => {
        const { getByText } = render(<TakeExamScreen />);

        await waitFor(() => {
            expect(getByText('What is insurance?')).toBeTruthy();
            expect(getByText('Question 1')).toBeTruthy();
            expect(getByText('1 / 2')).toBeTruthy();
        });
    });

    it('displays all answer options', async () => {
        const { getByText } = render(<TakeExamScreen />);

        await waitFor(() => {
            expect(getByText('Coverage')).toBeTruthy();
            expect(getByText('Gambling')).toBeTruthy();
            expect(getByText('Savings')).toBeTruthy();
            expect(getByText('Tax')).toBeTruthy();
        });
    });

    it('selects an answer when option is pressed', async () => {
        const { getByLabelText, getByText } = render(<TakeExamScreen />);

        await waitFor(() => {
            expect(getByText('What is insurance?')).toBeTruthy();
        });

        fireEvent.press(getByLabelText('Option A: Coverage'));
        // The option should now be selected (accessibility state)
        expect(getByLabelText('Option A: Coverage').props.accessibilityState.selected).toBe(true);
    });

    it('navigates to next question', async () => {
        const { getByText } = render(<TakeExamScreen />);

        await waitFor(() => {
            expect(getByText('What is insurance?')).toBeTruthy();
        });

        fireEvent.press(getByText('Next'));

        await waitFor(() => {
            expect(getByText('What is a premium?')).toBeTruthy();
            expect(getByText('2 / 2')).toBeTruthy();
        });
    });

    it('has reduced opacity on Prev button on first question', async () => {
        const { getByText } = render(<TakeExamScreen />);

        await waitFor(() => {
            expect(getByText('What is insurance?')).toBeTruthy();
        });

        // On first question, the Prev button container has opacity 0.3
        const prevText = getByText('Prev');
        // Walk up the tree to find the TouchableOpacity with disabled prop
        let node = prevText.parent;
        while (node && node.props.disabled === undefined) {
            node = node.parent;
        }
        expect(node?.props.disabled).toBe(true);
    });

    it('shows Submit button on last question', async () => {
        const { getByText } = render(<TakeExamScreen />);

        await waitFor(() => {
            expect(getByText('What is insurance?')).toBeTruthy();
        });

        // Navigate to last question
        fireEvent.press(getByText('Next'));

        await waitFor(() => {
            expect(getByText('Submit')).toBeTruthy();
        });
    });

    it('shows paper code in top bar', async () => {
        const { getByText } = render(<TakeExamScreen />);

        await waitFor(() => {
            expect(getByText('Module 5')).toBeTruthy();
        });
    });

    it('shows question grid toggle button', async () => {
        const { getByText, queryByText } = render(<TakeExamScreen />);

        await waitFor(() => {
            expect(getByText('What is insurance?')).toBeTruthy();
        });

        // Question Navigator should not be visible initially
        expect(queryByText('Question Navigator')).toBeNull();
    });
});
