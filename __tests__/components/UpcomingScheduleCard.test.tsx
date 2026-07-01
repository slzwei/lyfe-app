import UpcomingScheduleCard from '@/components/home/UpcomingScheduleCard';
import type { CandidateScheduleItem } from '@/lib/recruitment/schedule';
import type { ThemeColors } from '@/types/theme';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

// The card transitively imports lib/recruitment/schedule → lib/supabase, which
// throws without env vars. Neutralise with the manual mock (card uses only pure
// helpers at runtime, never the client).
jest.mock('@/lib/supabase');

const colors = {
    cardBackground: '#fff',
    textPrimary: '#000',
    textSecondary: '#333',
    textTertiary: '#777',
    accent: '#D6552B',
    statusProposed: '#5C7A9E',
    info: '#3366BB',
    success: '#5E6F51',
} as unknown as ThemeColors;

const items: CandidateScheduleItem[] = [
    {
        kind: 'interview',
        id: 'iv1',
        code: 'zoom',
        startAt: '2026-07-04T07:00:00+08:00',
        endAt: null,
        location: null,
        isOnline: true,
        status: 'scheduled',
    },
    {
        kind: 'paper',
        id: 'pa1',
        code: 'M9',
        startAt: '2026-07-08T02:00:00+08:00',
        endAt: null,
        location: null,
        isOnline: false,
        status: 'scheduled',
    },
];

describe('UpcomingScheduleCard', () => {
    it('renders each item title + Online sub-line for an online interview', () => {
        const { getByText } = render(
            <UpcomingScheduleCard items={items} colors={colors} isLoading={false} onSeeAll={() => {}} />,
        );
        expect(getByText('Interview')).toBeTruthy();
        expect(getByText('Online')).toBeTruthy();
        expect(getByText('M9 exam')).toBeTruthy();
    });

    it('shows a teaching empty state when there are no items', () => {
        const { getByText, queryByText } = render(
            <UpcomingScheduleCard items={[]} colors={colors} isLoading={false} onSeeAll={() => {}} />,
        );
        expect(getByText(/Nothing scheduled yet/)).toBeTruthy();
        expect(queryByText('Interview')).toBeNull();
    });

    it('does not render items or empty text while loading', () => {
        const { queryByText } = render(
            <UpcomingScheduleCard items={[]} colors={colors} isLoading onSeeAll={() => {}} />,
        );
        expect(queryByText(/Nothing scheduled yet/)).toBeNull();
        expect(queryByText('Interview')).toBeNull();
    });

    it('fires onSeeAll when See All is pressed', () => {
        const onSeeAll = jest.fn();
        const { getByText } = render(
            <UpcomingScheduleCard items={items} colors={colors} isLoading={false} onSeeAll={onSeeAll} />,
        );
        fireEvent.press(getByText('See All'));
        expect(onSeeAll).toHaveBeenCalledTimes(1);
    });
});
