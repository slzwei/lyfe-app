/**
 * Tests for app/(tabs)/team/agent/[agentId].tsx — Agent detail screen
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { fetchTeamMember } from '@/lib/team';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/lib/team');

jest.mock('@/components/ScreenHeader', () => {
    const { Text } = require('react-native');
    return function MockScreenHeader({ title }: { title: string }) {
        return <Text testID="screen-header">{title}</Text>;
    };
});

jest.mock('@/components/LoadingState', () => {
    const { Text } = require('react-native');
    return function MockLoadingState() {
        return <Text testID="loading-state">Loading...</Text>;
    };
});

jest.mock('@/components/LeadCard', () => {
    const { Text, TouchableOpacity } = require('react-native');
    return function MockLeadCard({ lead, onPress }: any) {
        return (
            <TouchableOpacity testID={`lead-card-${lead.id}`} onPress={onPress}>
                <Text>{lead.full_name}</Text>
            </TouchableOpacity>
        );
    };
});

jest.mock('@/lib/dateTime', () => ({
    formatMonthYear: (date: string) => 'March 2026',
}));

import AgentDetailScreen from '@/app/(tabs)/team/agent/[agentId]';

const MOCK_AGENT = {
    id: 'agent-1',
    name: 'Alice Tan',
    role: 'agent' as const,
    phone: '+6591234567',
    email: 'alice@example.com',
    avatarUrl: null,
    isActive: true,
    joinedDate: '2026-01-15T00:00:00Z',
    leadsCount: 10,
    wonCount: 3,
    conversionRate: 30,
};

const MOCK_LEADS = [
    {
        id: 'lead-1',
        full_name: 'Bob Lead',
        status: 'new',
        phone: '+6599999999',
        email: null,
        source: 'referral',
        product_interest: 'life',
        assigned_to: 'agent-1',
        created_at: '2026-03-01T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z',
    },
    {
        id: 'lead-2',
        full_name: 'Carol Lead',
        status: 'won',
        phone: '+6588888888',
        email: 'carol@example.com',
        source: 'cold_call',
        product_interest: 'health',
        assigned_to: 'agent-1',
        created_at: '2026-02-15T00:00:00Z',
        updated_at: '2026-03-10T00:00:00Z',
    },
];

const mockPush = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();

    (useTheme as jest.Mock).mockReturnValue({
        colors: Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    });

    (useLocalSearchParams as jest.Mock).mockReturnValue({ agentId: 'agent-1' });
    (useRouter as jest.Mock).mockReturnValue({
        push: mockPush,
        replace: jest.fn(),
        back: jest.fn(),
    });

    (fetchTeamMember as jest.Mock).mockResolvedValue({
        member: MOCK_AGENT,
        leads: MOCK_LEADS,
        error: null,
    });
});

describe('AgentDetailScreen', () => {
    it('shows loading state while fetching data', () => {
        (fetchTeamMember as jest.Mock).mockReturnValue(new Promise(() => {}));

        const { getByTestId } = render(<AgentDetailScreen />);
        expect(getByTestId('loading-state')).toBeTruthy();
    });

    it('renders agent info on success', async () => {
        const { getByText } = render(<AgentDetailScreen />);

        await waitFor(() => {
            expect(getByText('Alice Tan')).toBeTruthy();
            expect(getByText('Agent')).toBeTruthy();
            expect(getByText('Active')).toBeTruthy();
            expect(getByText('Member since March 2026')).toBeTruthy();
        });
    });

    it('shows performance stats', async () => {
        const { getByText, getAllByText } = render(<AgentDetailScreen />);

        await waitFor(() => {
            expect(getByText('Performance')).toBeTruthy();
            expect(getByText('Total Leads')).toBeTruthy();
            // "Won" appears in both stats and pipeline legend
            expect(getAllByText('Won').length).toBeGreaterThanOrEqual(1);
            expect(getByText('30%')).toBeTruthy(); // Conv. rate
            expect(getByText('Conv. Rate')).toBeTruthy();
            expect(getByText('In Pipeline')).toBeTruthy();
        });
    });

    it('shows pipeline breakdown section', async () => {
        const { getByText } = render(<AgentDetailScreen />);

        await waitFor(() => {
            expect(getByText('Pipeline Breakdown')).toBeTruthy();
        });
    });

    it('shows leads list', async () => {
        const { getByText, getByTestId } = render(<AgentDetailScreen />);

        await waitFor(() => {
            expect(getByText('Leads (2)')).toBeTruthy();
            expect(getByTestId('lead-card-lead-1')).toBeTruthy();
            expect(getByTestId('lead-card-lead-2')).toBeTruthy();
        });
    });

    it('shows empty leads message when no leads', async () => {
        (fetchTeamMember as jest.Mock).mockResolvedValue({
            member: { ...MOCK_AGENT, leadsCount: 0, wonCount: 0, conversionRate: 0 },
            leads: [],
            error: null,
        });

        const { getByText } = render(<AgentDetailScreen />);

        await waitFor(() => {
            expect(getByText('No leads assigned yet')).toBeTruthy();
        });
    });

    it('shows "Agent not found" when member is null', async () => {
        (fetchTeamMember as jest.Mock).mockResolvedValue({
            member: null,
            leads: [],
            error: 'Not found',
        });

        const { getByText } = render(<AgentDetailScreen />);

        await waitFor(() => {
            expect(getByText('Agent not found')).toBeTruthy();
        });
    });

    it('shows Manager role badge for manager members', async () => {
        (fetchTeamMember as jest.Mock).mockResolvedValue({
            member: { ...MOCK_AGENT, name: 'Manager Bob', role: 'manager' },
            leads: [],
            error: null,
        });

        const { getByText } = render(<AgentDetailScreen />);

        await waitFor(() => {
            expect(getByText('Manager')).toBeTruthy();
        });
    });

    it('shows Inactive status for inactive agents', async () => {
        (fetchTeamMember as jest.Mock).mockResolvedValue({
            member: { ...MOCK_AGENT, isActive: false },
            leads: [],
            error: null,
        });

        const { getByText } = render(<AgentDetailScreen />);

        await waitFor(() => {
            expect(getByText('Inactive')).toBeTruthy();
        });
    });

    it('shows Call and Email action buttons', async () => {
        const { getByText } = render(<AgentDetailScreen />);

        await waitFor(() => {
            expect(getByText('Call')).toBeTruthy();
            expect(getByText('Email')).toBeTruthy();
        });
    });
});
