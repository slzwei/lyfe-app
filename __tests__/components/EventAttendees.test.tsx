import React from 'react';
import { render } from '@testing-library/react-native';
import { EventAttendees } from '@/components/events/EventAttendees';
import type { AttendeeRole, EventAttendee, ExternalAttendee } from '@/types/event';

jest.mock('@/components/Avatar', () => {
    const { View } = require('react-native');
    return function MockAvatar() {
        return <View testID="avatar" />;
    };
});

jest.mock('@/constants/ui', () => ({
    ATTENDEE_ROLE_ORDER: ['host', 'duty_manager', 'presenter', 'attendee'] as const,
    ATTENDEE_ROLE_LABELS: {
        host: 'Host',
        duty_manager: 'Duty Manager',
        presenter: 'Presenter',
        attendee: 'Attendee',
    },
    ATTENDEE_ROLE_COLORS: {
        host: '#E11D48',
        duty_manager: '#6366F1',
        presenter: '#FF7600',
        attendee: '#8B5CF6',
    },
    AVATAR_COLORS: ['#6366F1', '#FF7600', '#E11D48', '#F59E0B', '#8B5CF6', '#06B6D4'],
}));

const COLORS = {
    textPrimary: '#000000',
    textSecondary: '#666666',
    textTertiary: '#999999',
    accent: '#007AFF',
    accentLight: '#E0F0FF',
    cardBackground: '#FFFFFF',
    background: '#F5F5F5',
    border: '#E0E0E0',
    success: '#34C759',
    error: '#FF3B30',
    warning: '#EAB308',
} as any;

const emptyGrouped: Record<AttendeeRole, EventAttendee[]> = {
    host: [],
    duty_manager: [],
    presenter: [],
    attendee: [],
};

const makeAttendee = (overrides?: Partial<EventAttendee>): EventAttendee => ({
    id: 'a1',
    event_id: 'e1',
    user_id: 'u1',
    attendee_role: 'attendee',
    full_name: 'Alice Tan',
    avatar_url: null,
    ...overrides,
});

beforeEach(() => jest.clearAllMocks());

describe('EventAttendees', () => {
    it('renders grouped attendees by role', () => {
        const grouped = {
            ...emptyGrouped,
            host: [makeAttendee({ id: 'h1', attendee_role: 'host', full_name: 'Host User' })],
            attendee: [
                makeAttendee({ id: 'a1', full_name: 'Alice Tan' }),
                makeAttendee({ id: 'a2', user_id: 'u2', full_name: 'Bob Lee' }),
            ],
        };
        const { getByText, getAllByText } = render(
            <EventAttendees colors={COLORS} grouped={grouped} totalAttendees={3} externalAttendees={[]} />,
        );

        expect(getByText('Attendees (3)')).toBeTruthy();
        expect(getByText('Host User')).toBeTruthy();
        expect(getByText('Alice Tan')).toBeTruthy();
        expect(getByText('Bob Lee')).toBeTruthy();
        // "Host" appears both as group label and as role badge — use getAllByText
        expect(getAllByText('Host').length).toBeGreaterThanOrEqual(1);
    });

    it('renders external guests section', () => {
        const externals: ExternalAttendee[] = [{ name: 'External Person', attendee_role: 'attendee' }];
        const { getByText } = render(
            <EventAttendees
                colors={COLORS}
                grouped={{ ...emptyGrouped, attendee: [makeAttendee()] }}
                totalAttendees={2}
                externalAttendees={externals}
            />,
        );

        expect(getByText('External Guests')).toBeTruthy();
        expect(getByText('External Person')).toBeTruthy();
    });

    it('renders empty state when no attendees', () => {
        const { getByText } = render(
            <EventAttendees colors={COLORS} grouped={emptyGrouped} totalAttendees={0} externalAttendees={[]} />,
        );

        expect(getByText('Attendees (0)')).toBeTruthy();
        expect(getByText('No attendees added yet')).toBeTruthy();
    });

    it('does not render role groups with zero attendees', () => {
        const grouped = {
            ...emptyGrouped,
            attendee: [makeAttendee()],
        };
        const { queryByText } = render(
            <EventAttendees colors={COLORS} grouped={grouped} totalAttendees={1} externalAttendees={[]} />,
        );

        expect(queryByText('Host')).toBeNull();
        expect(queryByText('Duty Manager')).toBeNull();
        expect(queryByText('Presenter')).toBeNull();
    });
});
