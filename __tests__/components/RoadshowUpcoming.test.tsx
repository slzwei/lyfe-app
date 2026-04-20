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
    accentDark: '#0055BB',
    cardBackground: '#FFFFFF',
    cardBorder: '#E0E0E0',
    background: '#F5F5F5',
    border: '#E0E0E0',
    hairline: '#E0E0E0',
    surfacePrimary: '#FFFFFF',
    tintTerra: '#F7E7DC',
    tintSage: '#E8EDE0',
    tintButter: '#F7ECCF',
    tintPink: '#F2E0E7',
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
    it('renders tariff stats when config exists', () => {
        const config = makeConfig();
        const { getByText } = render(<RoadshowUpcoming roadshowConfig={config} colors={COLORS} />);

        // Eyebrow heading + cost values (prototype tariff: weekly + slots + per-slot)
        expect(getByText('THE TARIFF')).toBeTruthy();
        expect(getByText('$700')).toBeTruthy();
        expect(getByText('5')).toBeTruthy();
        // Per-slot with .toFixed(2) still renders two decimals
        expect(getByText('$28.00')).toBeTruthy();
    });

    it('renders empty state message when config is null', () => {
        const { getByText } = render(<RoadshowUpcoming roadshowConfig={null} colors={COLORS} />);

        expect(getByText('THE TARIFF')).toBeTruthy();
        expect(getByText('No booth configuration yet.')).toBeTruthy();
    });

    it('renders suggested daily targets derived from config', () => {
        const config = makeConfig({ suggested_sitdowns: 6, suggested_pitches: 3, suggested_closed: 2 });
        const { getByText, getByLabelText } = render(<RoadshowUpcoming roadshowConfig={config} colors={COLORS} />);

        // Section present (a11y label preserves legacy string for test regression safety)
        expect(getByLabelText('Suggested Daily Targets')).toBeTruthy();
        expect(getByText('6')).toBeTruthy();
        expect(getByText('3')).toBeTruthy();
        expect(getByText('2')).toBeTruthy();
        expect(getByText('SITDOWNS')).toBeTruthy();
        expect(getByText('PITCHES')).toBeTruthy();
        expect(getByText('CLOSED')).toBeTruthy();
    });

    it('does not render targets section when config is null', () => {
        const { queryByLabelText } = render(<RoadshowUpcoming roadshowConfig={null} colors={COLORS} />);

        expect(queryByLabelText('Suggested Daily Targets')).toBeNull();
    });
});
