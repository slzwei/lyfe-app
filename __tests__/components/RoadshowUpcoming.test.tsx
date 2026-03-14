import React from 'react';
import { render } from '@testing-library/react-native';
import { RoadshowUpcoming } from '@/components/events/RoadshowUpcoming';
import type { RoadshowConfig } from '@/types/event';

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

const makeConfig = (overrides?: Partial<RoadshowConfig>): RoadshowConfig => ({
    id: 'cfg-1',
    event_id: 'e1',
    weekly_cost: 700,
    slots_per_day: 5,
    expected_start_time: '09:00',
    late_grace_minutes: 15,
    suggested_sitdowns: 4,
    suggested_pitches: 2,
    suggested_closed: 1,
    daily_cost: 140,
    slot_cost: 28,
    ...overrides,
});

beforeEach(() => jest.clearAllMocks());

describe('RoadshowUpcoming', () => {
    it('renders cost breakdown when config exists', () => {
        const config = makeConfig();
        const { getByText } = render(<RoadshowUpcoming roadshowConfig={config} colors={COLORS} />);

        expect(getByText('Cost Overview')).toBeTruthy();
        expect(getByText('$700.00')).toBeTruthy();
        expect(getByText('$140.00')).toBeTruthy();
        expect(getByText('$28.00')).toBeTruthy();
    });

    it('renders "No config set" when config is null', () => {
        const { getByText } = render(<RoadshowUpcoming roadshowConfig={null} colors={COLORS} />);

        expect(getByText('Cost Overview')).toBeTruthy();
        expect(getByText('No config set')).toBeTruthy();
    });

    it('renders suggested daily targets', () => {
        const config = makeConfig({ suggested_sitdowns: 6, suggested_pitches: 3, suggested_closed: 2 });
        const { getByText } = render(<RoadshowUpcoming roadshowConfig={config} colors={COLORS} />);

        expect(getByText('Suggested Daily Targets')).toBeTruthy();
        expect(getByText('6')).toBeTruthy();
        expect(getByText('3')).toBeTruthy();
        expect(getByText('2')).toBeTruthy();
        expect(getByText('Sitdowns')).toBeTruthy();
        expect(getByText('Pitches')).toBeTruthy();
        expect(getByText('Closed')).toBeTruthy();
    });

    it('does not render targets section when config is null', () => {
        const { queryByText } = render(<RoadshowUpcoming roadshowConfig={null} colors={COLORS} />);

        expect(queryByText('Suggested Daily Targets')).toBeNull();
    });
});
