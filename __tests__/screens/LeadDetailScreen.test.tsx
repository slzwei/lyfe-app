/**
 * Tests for app/(tabs)/leads/[leadId].tsx — Lead detail screen (mktr-leads UI/UX recompose).
 *
 * The screen was recomposed to the leads-scoped design (Monogram identity, big
 * Call/WhatsApp CTAs, tappable status-pill grid, rich ActivityFeed) — so these
 * tests assert the NEW structure while preserving the same behavioral coverage:
 * loading, not-found, identity, activity timeline + count + empty, agent actions,
 * manager gating + banner, recording/transcript.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import { Colors } from '@/constants/Colors';
import { fetchLead, fetchLeadActivities } from '@/lib/leads';

import LeadDetailScreen from '@/app/(tabs)/leads/[leadId]';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/contexts/ViewModeContext');
jest.mock('@/lib/leads');
jest.mock('expo-haptics');

jest.mock('expo-router', () => ({
    useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() })),
    useLocalSearchParams: jest.fn(() => ({})),
    useSegments: jest.fn(() => []),
    useFocusEffect: jest.fn((cb: any) => cb()),
    Link: 'Link',
    Tabs: { Screen: 'Screen' },
}));

// Reused leads-local modals that mount continuously — mock to bare views.
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
jest.mock('@/components/leads/NoteInput', () => {
    const { View } = require('react-native');
    return function MockNoteInput() {
        return <View testID="note-input" />;
    };
});
jest.mock('@/components/leads/LogActivitySheet', () => {
    const { View } = require('react-native');
    return { LogActivitySheet: () => <View testID="log-activity-sheet" /> };
});
jest.mock('@/components/leads/FollowUpSheet', () => {
    const { View } = require('react-native');
    return { FollowUpSheet: () => <View testID="follow-up-sheet" /> };
});

const MOCK_LEAD = {
    id: 'lead-1',
    full_name: 'John Doe',
    phone: '+6591234567',
    email: 'john@example.com',
    status: 'new' as const,
    source: 'referral' as const,
    source_name: null,
    external_id: null,
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

beforeEach(() => {
    jest.clearAllMocks();

    (useTheme as jest.Mock).mockReturnValue({
        colors: Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    });
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'user-1', full_name: 'Test User', role: 'agent' } });
    (useViewMode as jest.Mock).mockReturnValue({
        viewMode: 'agent',
        canToggle: false,
        setViewMode: jest.fn(),
        isReady: true,
    });
    (useLocalSearchParams as jest.Mock).mockReturnValue({ leadId: 'lead-1' });
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn(), replace: jest.fn(), back: jest.fn() });
    (useSegments as jest.Mock).mockReturnValue(['(tabs)', 'leads', 'lead-1']);
    (fetchLead as jest.Mock).mockResolvedValue({ data: MOCK_LEAD, error: null });
    (fetchLeadActivities as jest.Mock).mockResolvedValue({ data: MOCK_ACTIVITIES, error: null });
});

describe('LeadDetailScreen', () => {
    it('shows loading state while fetching', () => {
        (fetchLead as jest.Mock).mockReturnValue(new Promise(() => {}));
        (fetchLeadActivities as jest.Mock).mockReturnValue(new Promise(() => {}));
        const { getByTestId } = render(<LeadDetailScreen />);
        expect(getByTestId('lead-detail-loading')).toBeTruthy();
    });

    it('renders identity, phone, email, status grid', async () => {
        const { getAllByText, getByText, getByTestId } = render(<LeadDetailScreen />);
        await waitFor(() => {
            expect(getAllByText('John Doe').length).toBeGreaterThanOrEqual(1);
            expect(getByText('+65 9123 4567')).toBeTruthy();
            expect(getByText('john@example.com')).toBeTruthy();
            expect(getByTestId('lead-status-grid')).toBeTruthy();
        });
    });

    it('shows "Lead not found" when lead is null', async () => {
        (fetchLead as jest.Mock).mockResolvedValue({ data: null, error: null });
        const { getByText } = render(<LeadDetailScreen />);
        await waitFor(() => expect(getByText('Lead not found')).toBeTruthy());
    });

    it('shows the activity timeline with count', async () => {
        const { getByText, getByTestId } = render(<LeadDetailScreen />);
        await waitFor(() => {
            expect(getByText('Activity')).toBeTruthy();
            expect(getByTestId('lead-activity-count').props.children).toBe(1);
            expect(getByTestId('lead-activity-list')).toBeTruthy();
            expect(getByText('Initial contact made')).toBeTruthy();
        });
    });

    it('shows empty activity state when no activities', async () => {
        (fetchLeadActivities as jest.Mock).mockResolvedValue({ data: [], error: null });
        const { getByTestId } = render(<LeadDetailScreen />);
        await waitFor(() => expect(getByTestId('lead-activity-empty')).toBeTruthy());
    });

    it('shows agent actions (Call, WhatsApp, status grid, Note)', async () => {
        const { getByTestId } = render(<LeadDetailScreen />);
        await waitFor(() => {
            expect(getByTestId('lead-call-action')).toBeTruthy();
            expect(getByTestId('lead-whatsapp-action')).toBeTruthy();
            expect(getByTestId('lead-status-grid')).toBeTruthy();
            expect(getByTestId('lead-status-pill-contacted')).toBeTruthy();
            expect(getByTestId('lead-note-action')).toBeTruthy();
        });
    });

    it('manager view shows Reassign and hides status grid / note', async () => {
        (useViewMode as jest.Mock).mockReturnValue({
            viewMode: 'manager',
            canToggle: true,
            setViewMode: jest.fn(),
            isReady: true,
        });
        const { getByTestId, queryByTestId } = render(<LeadDetailScreen />);
        await waitFor(() => {
            expect(getByTestId('lead-reassign-action')).toBeTruthy();
            expect(queryByTestId('lead-status-grid')).toBeNull();
            expect(queryByTestId('lead-note-action')).toBeNull();
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
        await waitFor(() => expect(getByTestId('manager-banner')).toBeTruthy());
    });

    it('shows "Lead not found" when fetch errors (lead null)', async () => {
        (fetchLead as jest.Mock).mockResolvedValue({ data: null, error: 'Server error' });
        const { getByText } = render(<LeadDetailScreen />);
        await waitFor(() => expect(getByText('Lead not found')).toBeTruthy());
    });

    it('renders a back control', async () => {
        (useSegments as jest.Mock).mockReturnValue(['(tabs)', 'team', 'agent', 'lead-1']);
        const { getByTestId } = render(<LeadDetailScreen />);
        await waitFor(() => expect(getByTestId('lead-back')).toBeTruthy());
    });

    it('renders recording card when recording_url exists', async () => {
        (fetchLead as jest.Mock).mockResolvedValue({
            data: { ...MOCK_LEAD, recording_url: 'https://example.com/call.mp3' },
            error: null,
        });
        const { getByText } = render(<LeadDetailScreen />);
        await waitFor(() => expect(getByText('Call Recording')).toBeTruthy());
    });

    it('renders transcript card when transcript exists', async () => {
        (fetchLead as jest.Mock).mockResolvedValue({
            data: { ...MOCK_LEAD, transcript: 'Hello, I am interested in insurance.' },
            error: null,
        });
        const { getByText } = render(<LeadDetailScreen />);
        await waitFor(() => expect(getByText('Call Transcript')).toBeTruthy());
    });

    it('renders a lead with contacted status', async () => {
        (fetchLead as jest.Mock).mockResolvedValue({ data: { ...MOCK_LEAD, status: 'contacted' }, error: null });
        const { getByTestId } = render(<LeadDetailScreen />);
        await waitFor(() => expect(getByTestId('lead-status-grid')).toBeTruthy());
    });

    it('renders a lead without email', async () => {
        (fetchLead as jest.Mock).mockResolvedValue({ data: { ...MOCK_LEAD, email: null }, error: null });
        const { queryByText } = render(<LeadDetailScreen />);
        await waitFor(() => expect(queryByText('john@example.com')).toBeNull());
    });

    it('renders a lead from MKTR source', async () => {
        (fetchLead as jest.Mock).mockResolvedValue({
            data: { ...MOCK_LEAD, source: 'online', source_name: 'mktr' },
            error: null,
        });
        const { getAllByText } = render(<LeadDetailScreen />);
        await waitFor(() => expect(getAllByText('John Doe').length).toBeGreaterThanOrEqual(1));
    });

    it('renders multiple activities with count', async () => {
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
        const { getByTestId } = render(<LeadDetailScreen />);
        await waitFor(() => expect(getByTestId('lead-activity-count').props.children).toBe(2));
    });
});
