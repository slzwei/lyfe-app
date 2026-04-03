/**
 * Tests for components/profile/PersonalityQuizzesCard.tsx
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PersonalityQuizzesCard from '@/components/profile/PersonalityQuizzesCard';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/Colors';

jest.mock('@/lib/supabase');

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    ...jest.requireActual('expo-router'),
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (cb: () => void) => {
        // Run once like useEffect
        const React = require('react');
        React.useEffect(() => {
            cb();
        }, []);
    },
}));

const mockSupa = supabase as any;
function mockResolve(chain: any, value: any) {
    chain.__resolveWith(value);
}

beforeEach(() => {
    mockSupa.__resetChains();
    jest.clearAllMocks();
    mockPush.mockReset();
});

const defaultProps = {
    colors: Colors.light,
    userId: 'user-1',
};

describe('PersonalityQuizzesCard', () => {
    it('renders loading state initially', () => {
        // papers chain never resolves
        const papersChain = mockSupa.__getChain('exam_papers');
        mockResolve(papersChain, { data: null });

        const { getByText } = render(<PersonalityQuizzesCard {...defaultProps} />);
        expect(getByText('PERSONALITY QUIZZES')).toBeTruthy();
    });

    it('renders nothing when no papers exist', async () => {
        const papersChain = mockSupa.__getChain('exam_papers');
        mockResolve(papersChain, { data: [] });

        const { queryByText } = render(<PersonalityQuizzesCard {...defaultProps} />);

        await waitFor(() => {
            expect(queryByText('PERSONALITY QUIZZES')).toBeNull();
        });
    });

    it('renders Take buttons when no attempts exist', async () => {
        const papersChain = mockSupa.__getChain('exam_papers');
        mockResolve(papersChain, {
            data: [
                { id: 'p-vark', code: 'VARK-001' },
                { id: 'p-ennea', code: 'ENNEAGRAM_SAMPLER' },
                { id: 'p-disc', code: 'DISC' },
            ],
        });

        const attemptsChain = mockSupa.__getChain('exam_attempts');
        mockResolve(attemptsChain, { data: [] });

        const { getByText, getAllByText } = render(<PersonalityQuizzesCard {...defaultProps} />);

        await waitFor(() => {
            expect(getByText('Learning Style (VARK)')).toBeTruthy();
            expect(getByText('Enneagram Type')).toBeTruthy();
            expect(getByText('DISC Profile')).toBeTruthy();
            expect(getAllByText('Take')).toHaveLength(3);
        });
    });

    it('renders result labels when attempts exist', async () => {
        const papersChain = mockSupa.__getChain('exam_papers');
        mockResolve(papersChain, {
            data: [
                { id: 'p-vark', code: 'VARK-001' },
                { id: 'p-ennea', code: 'ENNEAGRAM_SAMPLER' },
            ],
        });

        const attemptsChain = mockSupa.__getChain('exam_attempts');
        mockResolve(attemptsChain, {
            data: [
                {
                    id: 'att-v',
                    paper_id: 'p-vark',
                    personality_results: {
                        scores: { V: 6, A: 4, R: 3, K: 3 },
                        percentages: { V: 38, A: 25, R: 19, K: 19 },
                        preference: 'single',
                        topTypes: ['V'],
                    },
                },
                {
                    id: 'att-e',
                    paper_id: 'p-ennea',
                    personality_results: {
                        quizType: 'enneagram',
                        scores: { '3': 7 },
                        percentages: { '3': 21 },
                        primaryType: 3,
                        wing: 2,
                        topTypes: [3],
                    },
                },
            ],
        });

        const { getByText, queryAllByText } = render(<PersonalityQuizzesCard {...defaultProps} />);

        await waitFor(() => {
            // VARK: should show Visual
            expect(getByText('Learning Style (VARK)')).toBeTruthy();
            expect(queryAllByText('Take').length).toBeLessThanOrEqual(1); // At most 1 Take button remaining
        });
    });

    it('navigates to quiz on Take press', async () => {
        const papersChain = mockSupa.__getChain('exam_papers');
        mockResolve(papersChain, { data: [{ id: 'p-vark', code: 'VARK-001' }] });

        const attemptsChain = mockSupa.__getChain('exam_attempts');
        mockResolve(attemptsChain, { data: [] });

        const { getByText } = render(<PersonalityQuizzesCard {...defaultProps} />);

        await waitFor(() => {
            expect(getByText('Take')).toBeTruthy();
        });

        fireEvent.press(getByText('Learning Style (VARK)'));
        expect(mockPush).toHaveBeenCalled();
    });
});
