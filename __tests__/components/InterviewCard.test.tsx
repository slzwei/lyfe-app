import React from 'react';
import { render } from '@testing-library/react-native';
import InterviewCard from '@/components/InterviewCard';

jest.mock('@/lib/dateTime', () => ({
    formatDateTime: jest.fn((d: string) => d),
}));

const COLORS: any = {
    surfacePrimary: '#F5F5F5',
    background: '#FFF',
    border: '#E0E0E0',
    textPrimary: '#000',
    textTertiary: '#999',
    textSecondary: '#666',
    accent: '#007AFF',
};

const MOCK_INTERVIEW = {
    id: 'i1',
    candidate_id: 'c1',
    manager_id: 'm1',
    scheduled_by_id: 'u1',
    round_number: 1,
    datetime: '2099-01-01T10:00:00Z',
    type: 'zoom' as const,
    status: 'scheduled' as const,
    zoom_link: 'https://zoom.us/j/123',
    location: null,
    google_calendar_event_id: null,
    notes: 'Test notes',
    created_at: '2026-01-01',
};

describe('InterviewCard', () => {
    it('renders interview details', () => {
        const { getByText } = render(
            <InterviewCard interview={MOCK_INTERVIEW} colors={COLORS} onEdit={() => {}} onDelete={() => {}} />,
        );
        expect(getByText('R1')).toBeTruthy();
        expect(getByText('Scheduled')).toBeTruthy();
    });

    it('calls onEdit and onDelete callbacks exist without error', () => {
        const onEdit = jest.fn();
        const onDelete = jest.fn();
        const { getByText } = render(
            <InterviewCard interview={MOCK_INTERVIEW} colors={COLORS} onEdit={onEdit} onDelete={onDelete} />,
        );
        expect(getByText('R1')).toBeTruthy();
        expect(onEdit).not.toHaveBeenCalled();
    });

    it('shows zoom link for upcoming interviews', () => {
        const { getByText } = render(
            <InterviewCard interview={MOCK_INTERVIEW} colors={COLORS} onEdit={() => {}} onDelete={() => {}} />,
        );
        expect(getByText('Join Zoom Meeting')).toBeTruthy();
    });

    it('shows notes when present', () => {
        const { getByText } = render(
            <InterviewCard interview={MOCK_INTERVIEW} colors={COLORS} onEdit={() => {}} onDelete={() => {}} />,
        );
        expect(getByText('Test notes')).toBeTruthy();
    });

    it('shows location when present', () => {
        const withLocation = { ...MOCK_INTERVIEW, location: 'Office Room 3' };
        const { getByText } = render(
            <InterviewCard interview={withLocation} colors={COLORS} onEdit={() => {}} onDelete={() => {}} />,
        );
        expect(getByText('Office Room 3')).toBeTruthy();
    });
});
