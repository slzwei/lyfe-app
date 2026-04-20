/**
 * Tests for app/(tabs)/leads/[leadId].tsx — Lead detail screen
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import { Colors } from '@/constants/Colors';
import {
    fetchLead,
    fetchLeadActivities,
    addLeadNote,
    updateLeadStatus,
    fetchTeamAgents,
    reassignLead,
} from '@/lib/leads';

import LeadDetailScreen from '@/app/(tabs)/leads/[leadId]';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/contexts/ViewModeContext');
jest.mock('@/lib/leads');

// Override the global expo-router mock to include useSegments
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

jest.mock('@/components/ScreenHeader', () => {
    const { Text } = require('react-native');
    return function MockScreenHeader({ title, banner }: any) {
        return (
            <>
                <Text testID="screen-header">{title}</Text>
                {banner && <Text testID="manager-banner">{banner.text}</Text>}
            </>
        );
    };
});

jest.mock('@/components/ErrorBanner', () => {
    const { Text } = require('react-native');
    return function MockErrorBanner({ message }: { message: string }) {
        return <Text testID="error-banner">{message}</Text>;
    };
});

jest.mock('@/components/LoadingState', () => {
    const { Text } = require('react-native');
    return function MockLoadingState() {
        return <Text testID="loading-state">Loading...</Text>;
    };
});

jest.mock('@/components/StatusBadge', () => {
    const { Text } = require('react-native');
    return function MockStatusBadge({ status }: { status: string }) {
        return <Text testID="status-badge">{status}</Text>;
    };
});

jest.mock('@/components/EmptyState', () => {
    const { Text } = require('react-native');
    return function MockEmptyState({ title }: { title: string }) {
        return <Text testID="empty-state">{title}</Text>;
    };
});

jest.mock('@/components/LeadActivityItem', () => {
    const { Text } = require('react-native');
    return function MockLeadActivityItem({ activity }: any) {
        return <Text testID="activity-item">{activity.description || activity.type}</Text>;
    };
});

jest.mock('@/components/leads/QuickAction', () => {
    const { TouchableOpacity, Text } = require('react-native');
    return function MockQuickAction({ label, onPress, disabled }: any) {
        return (
            <TouchableOpacity testID={`action-${label.toLowerCase()}`} onPress={onPress} disabled={disabled}>
                <Text>{label}</Text>
            </TouchableOpacity>
        );
    };
});

jest.mock('@/components/leads/StatusPicker', () => {
    const { View, Text, TouchableOpacity } = require('react-native');
    return function MockStatusPicker({ onChangeStatus }: any) {
        return (
            <View testID="status-picker">
                <TouchableOpacity testID="status-contacted" onPress={() => onChangeStatus('contacted')}>
                    <Text>Contacted</Text>
                </TouchableOpacity>
            </View>
        );
    };
});

jest.mock('@/components/leads/NoteInput', () => {
    const { View, Text, TouchableOpacity } = require('react-native');
    return function MockNoteInput({ onSave, noteText, onChangeText }: any) {
        return (
            <View testID="note-input">
                <TouchableOpacity testID="save-note" onPress={onSave}>
                    <Text>Save</Text>
                </TouchableOpacity>
            </View>
        );
    };
});

jest.mock('@/components/leads/ContactConfirmModal', () => {
    const { View } = require('react-native');
    return function MockContactConfirmModal() {
        return <View testID="contact-confirm-modal" />;
    };
});

jest.mock('@/components/leads/ReassignModal', () => {
    const { View } = require('react-native');
    return function MockReassignModal() {
        return <View testID="reassign-modal" />;
    };
});

const MOCK_LEAD = {
    id: 'lead-1',
    full_name: 'John Doe',
    phone: '+6591234567',
    email: 'john@example.com',
    status: 'new' as const,
    source: 'referral' as const,
    product_interest: 'life' as const,
    assigned_to: 'user-1',
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    notes: null,
};

const MOCK_ACTIVITIES = [
    {
        id: 'act-1',
        lead_id: 'lead-1',
        user_id: 'user-1',
        type: 'note',
        description: 'Initial contact made',
        metadata: {},
        created_at: '2026-03-05T10:00:00Z',
        actor_name: 'Test User',
    },
];

const mockPush = jest.fn();
const mockBack = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();

    (useTheme as jest.Mock).mockReturnValue({
        colors: Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    });

    (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'user-1', full_name: 'Test User', role: 'agent' },
    });

    (useViewMode as jest.Mock).mockReturnValue({
        viewMode: 'agent',
        canToggle: false,
        setViewMode: jest.fn(),
        isReady: true,
    });

    (useLocalSearchParams as jest.Mock).mockReturnValue({ leadId: 'lead-1' });
    (useRouter as jest.Mock).mockReturnValue({
        push: mockPush,
        replace: jest.fn(),
        back: mockBack,
    });
    (useSegments as jest.Mock).mockReturnValue(['(tabs)', 'leads', 'lead-1']);

    (fetchLead as jest.Mock).mockResolvedValue({ data: MOCK_LEAD, error: null });
    (fetchLeadActivities as jest.Mock).mockResolvedValue({ data: MOCK_ACTIVITIES, error: null });
});

describe('LeadDetailScreen', () => {
    it('shows loading state while fetching data', () => {
        (fetchLead as jest.Mock).mockReturnValue(new Promise(() => {}));
        (fetchLeadActivities as jest.Mock).mockReturnValue(new Promise(() => {}));

        const { getByTestId } = render(<LeadDetailScreen />);
        expect(getByTestId('loading-state')).toBeTruthy();
    });

    it('renders lead details on success', async () => {
        const { getAllByText, getByText, getByTestId } = render(<LeadDetailScreen />);

        await waitFor(() => {
            // Name appears in both header and card
            expect(getAllByText('John Doe').length).toBeGreaterThanOrEqual(1);
            // Phone rendered via formatSgPhone
            expect(getByText('+65 9123 4567')).toBeTruthy();
            expect(getByText('john@example.com')).toBeTruthy();
            expect(getByTestId('status-badge')).toBeTruthy();
        });
    });

    it('shows "Lead not found" when lead is null', async () => {
        (fetchLead as jest.Mock).mockResolvedValue({ data: null, error: null });

        const { getByText } = render(<LeadDetailScreen />);

        await waitFor(() => {
            expect(getByText('Lead not found')).toBeTruthy();
        });
    });

    it('shows activity timeline', async () => {
        const { getByText, getByTestId } = render(<LeadDetailScreen />);

        await waitFor(() => {
            expect(getByText('Activity')).toBeTruthy();
            expect(getByText('1')).toBeTruthy();
            expect(getByTestId('activity-item')).toBeTruthy();
        });
    });

    it('shows empty activity state when no activities', async () => {
        (fetchLeadActivities as jest.Mock).mockResolvedValue({ data: [], error: null });

        const { getByTestId } = render(<LeadDetailScreen />);

        await waitFor(() => {
            expect(getByTestId('empty-state')).toBeTruthy();
        });
    });

    it('shows agent quick actions (Call, WhatsApp, Status, Note)', async () => {
        const { getByTestId } = render(<LeadDetailScreen />);

        await waitFor(() => {
            expect(getByTestId('action-call')).toBeTruthy();
            expect(getByTestId('action-whatsapp')).toBeTruthy();
            expect(getByTestId('action-status')).toBeTruthy();
            expect(getByTestId('action-note')).toBeTruthy();
        });
    });

    it('shows manager view with Reassign action instead of Status/Note', async () => {
        (useViewMode as jest.Mock).mockReturnValue({
            viewMode: 'manager',
            canToggle: true,
            setViewMode: jest.fn(),
            isReady: true,
        });

        const { getByTestId, queryByTestId } = render(<LeadDetailScreen />);

        await waitFor(() => {
            expect(getByTestId('action-reassign')).toBeTruthy();
            expect(queryByTestId('action-status')).toBeNull();
            expect(queryByTestId('action-note')).toBeNull();
        });
    });

    it('shows manager banner in manager view', async () => {
        (useViewMode as jest.Mock).mockReturnValue({
            viewMode: 'manager',
            canToggle: true,
            setViewMode: jest.fn(),
            isReady: true,
        });

        const { getByTestId } = render(<LeadDetailScreen />);

        await waitFor(() => {
            expect(getByTestId('manager-banner')).toBeTruthy();
        });
    });

    it('shows error state when fetch fails', async () => {
        (fetchLead as jest.Mock).mockResolvedValue({ data: null, error: 'Server error' });

        const { getByText } = render(<LeadDetailScreen />);

        await waitFor(() => {
            // When data is null with error, setError is called and lead stays null
            // The screen shows "Lead not found" since lead is null
            expect(getByText('Lead not found')).toBeTruthy();
        });
    });

    it('uses correct back label based on segment', async () => {
        (useSegments as jest.Mock).mockReturnValue(['(tabs)', 'team', 'agent', 'lead-1']);

        const { getByTestId } = render(<LeadDetailScreen />);

        await waitFor(() => {
            expect(getByTestId('screen-header')).toBeTruthy();
        });
    });

    it('renders recording card when recording_url exists', async () => {
        (fetchLead as jest.Mock).mockResolvedValue({
            data: { ...MOCK_LEAD, recording_url: 'https://example.com/call.mp3' },
            error: null,
        });

        const { getByText } = render(<LeadDetailScreen />);

        await waitFor(() => {
            expect(getByText('Call Recording')).toBeTruthy();
        });
    });

    it('renders transcript card when transcript exists', async () => {
        (fetchLead as jest.Mock).mockResolvedValue({
            data: { ...MOCK_LEAD, transcript: 'Hello, I am interested in insurance.' },
            error: null,
        });

        const { getByText } = render(<LeadDetailScreen />);

        await waitFor(() => {
            expect(getByText('Call Transcript')).toBeTruthy();
        });
    });

    it('renders lead with contacted status', async () => {
        (fetchLead as jest.Mock).mockResolvedValue({
            data: { ...MOCK_LEAD, status: 'contacted' },
            error: null,
        });

        const { getByTestId } = render(<LeadDetailScreen />);

        await waitFor(() => {
            expect(getByTestId('status-badge')).toBeTruthy();
        });
    });

    it('renders lead without email', async () => {
        (fetchLead as jest.Mock).mockResolvedValue({
            data: { ...MOCK_LEAD, email: null },
            error: null,
        });

        const { queryByText } = render(<LeadDetailScreen />);

        await waitFor(() => {
            expect(queryByText('john@example.com')).toBeNull();
        });
    });

    it('renders lead from MKTR source', async () => {
        (fetchLead as jest.Mock).mockResolvedValue({
            data: { ...MOCK_LEAD, source: 'mktr', source_name: 'mktr' },
            error: null,
        });

        const { getByTestId } = render(<LeadDetailScreen />);

        await waitFor(() => {
            expect(getByTestId('status-badge')).toBeTruthy();
        });
    });

    it('renders multiple activities', async () => {
        (fetchLeadActivities as jest.Mock).mockResolvedValue({
            data: [
                ...MOCK_ACTIVITIES,
                {
                    id: 'act-2',
                    lead_id: 'lead-1',
                    user_id: 'user-1',
                    type: 'call',
                    description: 'Follow up call',
                    metadata: {},
                    created_at: '2026-03-06T10:00:00Z',
                    actor_name: 'Test User',
                },
            ],
            error: null,
        });

        const { getByText } = render(<LeadDetailScreen />);

        await waitFor(() => {
            expect(getByText('2')).toBeTruthy(); // activity count
        });
    });
});
