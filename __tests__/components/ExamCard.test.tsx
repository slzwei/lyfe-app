import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ExamCard from '@/components/ExamCard';
import type { ExamPaper, PaperStats } from '@/types/exam';

jest.mock('@/contexts/ThemeContext', () => ({
    useTheme: jest.fn(() => ({
        colors: require('@/constants/Colors').Colors.light,
        isDark: false,
        mode: 'light' as const,
        resolved: 'light' as const,
        setMode: jest.fn(),
    })),
}));

const MOCK_PAPER: ExamPaper = {
    id: 'paper-1',
    code: 'M5',
    title: 'Rules & Regulations of Financial Advisory Services',
    description: 'Covers MAS regulations and compliance.',
    duration_minutes: 60,
    pass_percentage: 70,
    question_count: 50,
    is_active: true,
    is_mandatory: true,
    display_order: 1,
    allow_multiple_answers: false,
};

const MOCK_STATS_WITH_ATTEMPTS: PaperStats = {
    attemptCount: 3,
    bestScore: 85,
    lastAttemptDate: '2026-01-15',
    bestPassed: true,
};

const MOCK_STATS_NO_ATTEMPTS: PaperStats = {
    attemptCount: 0,
    bestScore: null,
    lastAttemptDate: null,
    bestPassed: null,
};

describe('ExamCard', () => {
    const onPress = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders paper code and title', () => {
        const { getByText } = render(<ExamCard paper={MOCK_PAPER} stats={null} onPress={onPress} />);
        expect(getByText('M5')).toBeTruthy();
        expect(getByText(MOCK_PAPER.title)).toBeTruthy();
    });

    it('renders description when present', () => {
        const { getByText } = render(<ExamCard paper={MOCK_PAPER} stats={null} onPress={onPress} />);
        expect(getByText('Covers MAS regulations and compliance.')).toBeTruthy();
    });

    it('does not render description when absent', () => {
        const paper = { ...MOCK_PAPER, description: null };
        const { queryByText } = render(<ExamCard paper={paper} stats={null} onPress={onPress} />);
        expect(queryByText('Covers MAS regulations and compliance.')).toBeNull();
    });

    it('renders question count and duration', () => {
        const { getByText } = render(<ExamCard paper={MOCK_PAPER} stats={null} onPress={onPress} />);
        expect(getByText('50 questions')).toBeTruthy();
        expect(getByText('60 min')).toBeTruthy();
    });

    it('shows "Start" when no attempts', () => {
        const { getByText } = render(<ExamCard paper={MOCK_PAPER} stats={MOCK_STATS_NO_ATTEMPTS} onPress={onPress} />);
        expect(getByText('Start')).toBeTruthy();
    });

    it('shows best score when attempts exist', () => {
        const { getByText } = render(
            <ExamCard paper={MOCK_PAPER} stats={MOCK_STATS_WITH_ATTEMPTS} onPress={onPress} />,
        );
        expect(getByText('Best: 85%')).toBeTruthy();
    });

    it('shows "Passed" badge when bestPassed is true', () => {
        const { getByText } = render(
            <ExamCard paper={MOCK_PAPER} stats={MOCK_STATS_WITH_ATTEMPTS} onPress={onPress} />,
        );
        expect(getByText('Passed')).toBeTruthy();
    });

    it('shows "Required" badge for mandatory papers not yet passed', () => {
        const { getByText } = render(<ExamCard paper={MOCK_PAPER} stats={MOCK_STATS_NO_ATTEMPTS} onPress={onPress} />);
        expect(getByText('Required')).toBeTruthy();
    });

    it('does not show "Required" when already passed', () => {
        const { queryByText } = render(
            <ExamCard paper={MOCK_PAPER} stats={MOCK_STATS_WITH_ATTEMPTS} onPress={onPress} />,
        );
        expect(queryByText('Required')).toBeNull();
    });

    it('does not show "Required" for non-mandatory papers', () => {
        const paper = { ...MOCK_PAPER, is_mandatory: false };
        const { queryByText } = render(<ExamCard paper={paper} stats={MOCK_STATS_NO_ATTEMPTS} onPress={onPress} />);
        expect(queryByText('Required')).toBeNull();
    });

    it('calls onPress when tapped', () => {
        const { getByRole } = render(<ExamCard paper={MOCK_PAPER} stats={null} onPress={onPress} />);
        fireEvent.press(getByRole('button'));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('respects disabled prop', () => {
        const { getByRole } = render(<ExamCard paper={MOCK_PAPER} stats={null} onPress={onPress} disabled />);
        const button = getByRole('button');
        expect(button.props.accessibilityState?.disabled).toBe(true);
    });

    it('renders with null stats', () => {
        const { getByText } = render(<ExamCard paper={MOCK_PAPER} stats={null} onPress={onPress} />);
        expect(getByText('Start')).toBeTruthy();
    });
});
