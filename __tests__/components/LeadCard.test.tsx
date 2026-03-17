import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import LeadCard from '@/components/LeadCard';
import type { Lead } from '@/types/lead';

jest.mock('@/contexts/ThemeContext', () => ({
    useTheme: jest.fn(() => ({
        colors: require('@/constants/Colors').Colors.light,
        isDark: false,
        mode: 'light' as const,
        resolved: 'light' as const,
        setMode: jest.fn(),
    })),
}));

const MOCK_LEAD: Lead = {
    id: 'lead-1',
    assigned_to: 'agent-1',
    created_by: 'agent-1',
    full_name: 'Alice Tan',
    phone: '+6591234567',
    email: 'alice@example.com',
    source: 'referral',
    source_name: null,
    external_id: null,
    status: 'new',
    product_interest: 'life',
    notes: null,
    updated_at: new Date().toISOString(),
    created_at: '2026-01-01T00:00:00Z',
};

describe('LeadCard', () => {
    const onPress = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders lead name', () => {
        const { getByText } = render(<LeadCard lead={MOCK_LEAD} onPress={onPress} />);
        expect(getByText('Alice Tan')).toBeTruthy();
    });

    it('renders avatar initial', () => {
        const { getByText } = render(<LeadCard lead={MOCK_LEAD} onPress={onPress} />);
        expect(getByText('A')).toBeTruthy();
    });

    it('renders phone number', () => {
        const { getByText } = render(<LeadCard lead={MOCK_LEAD} onPress={onPress} />);
        expect(getByText('+6591234567')).toBeTruthy();
    });

    it('does not render phone when null', () => {
        const lead = { ...MOCK_LEAD, phone: null };
        const { queryByText } = render(<LeadCard lead={lead} onPress={onPress} />);
        expect(queryByText('+6591234567')).toBeNull();
    });

    it('renders product interest label', () => {
        const { getByText } = render(<LeadCard lead={MOCK_LEAD} onPress={onPress} />);
        expect(getByText('Life Insurance')).toBeTruthy();
    });

    it('renders status badge', () => {
        const { getByText } = render(<LeadCard lead={MOCK_LEAD} onPress={onPress} />);
        expect(getByText('New')).toBeTruthy();
    });

    it('calls onPress when tapped', () => {
        const { getByRole } = render(<LeadCard lead={MOCK_LEAD} onPress={onPress} />);
        fireEvent.press(getByRole('button'));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('renders agent name when provided', () => {
        const { getByText } = render(<LeadCard lead={MOCK_LEAD} onPress={onPress} agentName="Bob" />);
        expect(getByText('Bob')).toBeTruthy();
    });

    it('does not render agent name when not provided', () => {
        const { queryByText } = render(<LeadCard lead={MOCK_LEAD} onPress={onPress} />);
        expect(queryByText('Bob')).toBeNull();
    });

    it('renders last activity when provided', () => {
        const { getByText } = render(
            <LeadCard lead={MOCK_LEAD} onPress={onPress} lastActivity="Called about renewal" />,
        );
        expect(getByText('Called about renewal')).toBeTruthy();
    });

    it('renders "Just now" for recently updated lead', () => {
        const lead = { ...MOCK_LEAD, updated_at: new Date().toISOString() };
        const { getByText } = render(<LeadCard lead={lead} onPress={onPress} />);
        expect(getByText('Just now')).toBeTruthy();
    });

    it('renders time ago for older leads', () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const lead = { ...MOCK_LEAD, updated_at: twoHoursAgo };
        const { getByText } = render(<LeadCard lead={lead} onPress={onPress} />);
        expect(getByText('2h ago')).toBeTruthy();
    });

    it('has correct accessibility label', () => {
        const { getByRole } = render(<LeadCard lead={MOCK_LEAD} onPress={onPress} />);
        const button = getByRole('button');
        expect(button.props.accessibilityLabel).toBe('Lead: Alice Tan, Status: new');
    });

    it('renders different product interests', () => {
        const healthLead = { ...MOCK_LEAD, product_interest: 'health' as const };
        const { getByText } = render(<LeadCard lead={healthLead} onPress={onPress} />);
        expect(getByText('Health Insurance')).toBeTruthy();
    });
});
