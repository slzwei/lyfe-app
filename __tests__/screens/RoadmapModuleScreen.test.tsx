/**
 * Tests for app/(tabs)/roadmap/module/[moduleId].tsx — Module detail screen
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import {
    fetchModule,
    fetchModuleItems,
    fetchModuleResources,
    fetchModuleProgressForCandidate,
    fetchModuleItemsWithProgress,
    getCandidateIdForUser,
} from '@/lib/roadmap';

import ModuleDetailScreen from '@/app/(tabs)/roadmap/module/[moduleId]';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/lib/roadmap');
jest.mock('react-native-webview', () => {
    const { View } = require('react-native');
    return {
        __esModule: true,
        default: View,
    };
});

jest.mock('@/components/ScreenHeader', () => {
    const { Text } = require('react-native');
    return function MockScreenHeader({ title }: { title: string }) {
        return <Text testID="screen-header">{title}</Text>;
    };
});

jest.mock('@/components/ErrorBanner', () => {
    const { Text } = require('react-native');
    return function MockErrorBanner({ message }: { message: string }) {
        return <Text testID="error-banner">{message}</Text>;
    };
});

jest.mock('@/components/roadmap/ModuleCard', () => {
    const { Text } = require('react-native');
    return function MockModuleCard({ module }: any) {
        return <Text testID="module-card">{module.title}</Text>;
    };
});

jest.mock('@/components/roadmap/ModuleItemRow', () => {
    const { Text } = require('react-native');
    return function MockModuleItemRow({ item }: any) {
        return <Text testID="module-item-row">{item.title}</Text>;
    };
});

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
        user: { id: 'user-1', full_name: 'Test User', role: 'candidate' },
    });

    (useLocalSearchParams as jest.Mock).mockReturnValue({ moduleId: 'mod-1' });

    // users.id → candidates.id bridge (candidate_profiles). Progress tables key
    // on candidates.id, so the screen must resolve this before querying.
    (getCandidateIdForUser as jest.Mock).mockResolvedValue('cand-1');
});

describe('ModuleDetailScreen', () => {
    it('shows loading state while fetching data', () => {
        (fetchModule as jest.Mock).mockReturnValue(new Promise(() => {}));
        (fetchModuleResources as jest.Mock).mockReturnValue(new Promise(() => {}));
        (fetchModuleProgressForCandidate as jest.Mock).mockReturnValue(new Promise(() => {}));

        const { getByText } = render(<ModuleDetailScreen />);
        expect(getByText('Loading module...')).toBeTruthy();
    });

    it('renders module details on success', async () => {
        (fetchModule as jest.Mock).mockResolvedValue({
            data: {
                id: 'mod-1',
                title: 'Insurance Basics',
                description: 'Learn the fundamentals',
                module_type: 'training',
                archived_at: null,
                exam_paper_id: null,
            },
            error: null,
        });
        (fetchModuleResources as jest.Mock).mockResolvedValue({
            data: [{ id: 'res-1', title: 'Guide PDF', file_url: 'https://example.com/file.pdf' }],
            error: null,
        });
        (fetchModuleProgressForCandidate as jest.Mock).mockResolvedValue({
            data: { status: 'in_progress', completed_at: null },
            error: null,
        });
        (fetchModuleItemsWithProgress as jest.Mock).mockResolvedValue({
            data: [
                {
                    id: 'item-1',
                    title: 'Read material',
                    item_type: 'material',
                    progress: { status: 'completed' },
                },
                {
                    id: 'item-2',
                    title: 'Take quiz',
                    item_type: 'quiz',
                    progress: null,
                },
            ],
            error: null,
        });

        const { getByTestId, getAllByTestId } = render(<ModuleDetailScreen />);

        await waitFor(() => {
            expect(getByTestId('module-card')).toBeTruthy();
        });

        // Wait for items to load
        await waitFor(() => {
            expect(getAllByTestId('module-item-row')).toHaveLength(2);
        });
    });

    it('shows error banner when module fetch fails', async () => {
        (fetchModule as jest.Mock).mockResolvedValue({
            data: null,
            error: 'Module not found',
        });
        (fetchModuleResources as jest.Mock).mockResolvedValue({
            data: [],
            error: null,
        });
        (fetchModuleProgressForCandidate as jest.Mock).mockResolvedValue({
            data: null,
            error: null,
        });

        const { getByTestId } = render(<ModuleDetailScreen />);

        await waitFor(() => {
            expect(getByTestId('error-banner')).toBeTruthy();
        });
    });

    it('shows "Module not found" when module data is null', async () => {
        (fetchModule as jest.Mock).mockResolvedValue({
            data: null,
            error: null,
        });
        (fetchModuleResources as jest.Mock).mockResolvedValue({
            data: [],
            error: null,
        });
        (fetchModuleProgressForCandidate as jest.Mock).mockResolvedValue({
            data: null,
            error: null,
        });

        const { getByText } = render(<ModuleDetailScreen />);

        await waitFor(() => {
            expect(getByText('This module is not available.')).toBeTruthy();
        });
    });

    it('shows checklist header with completion count', async () => {
        (fetchModule as jest.Mock).mockResolvedValue({
            data: {
                id: 'mod-1',
                title: 'Test Module',
                module_type: 'training',
                archived_at: null,
                exam_paper_id: null,
            },
            error: null,
        });
        (fetchModuleResources as jest.Mock).mockResolvedValue({
            data: [],
            error: null,
        });
        (fetchModuleProgressForCandidate as jest.Mock).mockResolvedValue({
            data: null,
            error: null,
        });
        (fetchModuleItemsWithProgress as jest.Mock).mockResolvedValue({
            data: [
                {
                    id: 'item-1',
                    title: 'Item 1',
                    item_type: 'material',
                    progress: { status: 'completed' },
                },
                {
                    id: 'item-2',
                    title: 'Item 2',
                    item_type: 'quiz',
                    progress: null,
                },
            ],
            error: null,
        });

        const { getByText } = render(<ModuleDetailScreen />);

        await waitFor(() => {
            expect(getByText('Checklist')).toBeTruthy();
            expect(getByText('1/2')).toBeTruthy();
        });
    });

    it('sets header title to module title', async () => {
        (fetchModule as jest.Mock).mockResolvedValue({
            data: {
                id: 'mod-1',
                title: 'Advanced Sales',
                module_type: 'training',
                archived_at: null,
                exam_paper_id: null,
            },
            error: null,
        });
        (fetchModuleResources as jest.Mock).mockResolvedValue({
            data: [],
            error: null,
        });
        (fetchModuleProgressForCandidate as jest.Mock).mockResolvedValue({
            data: null,
            error: null,
        });
        (fetchModuleItemsWithProgress as jest.Mock).mockResolvedValue({
            data: [],
            error: null,
        });

        const { getByTestId } = render(<ModuleDetailScreen />);

        await waitFor(() => {
            expect(getByTestId('screen-header').children[0]).toBe('Advanced Sales');
        });
    });

    it('shows default header title while loading', () => {
        (fetchModule as jest.Mock).mockReturnValue(new Promise(() => {}));
        (fetchModuleResources as jest.Mock).mockReturnValue(new Promise(() => {}));
        (fetchModuleProgressForCandidate as jest.Mock).mockReturnValue(new Promise(() => {}));

        const { getByTestId } = render(<ModuleDetailScreen />);
        expect(getByTestId('screen-header').children[0]).toBe('Module');
    });

    // Regression for TRACKER bug #32: progress tables key on candidates.id, but the
    // screen passed users.id — RLS (can_access_candidate_user) then returned zero
    // rows, so a candidate's module always rendered as not-started.
    it('queries progress and items with the resolved candidates.id, never users.id', async () => {
        (fetchModule as jest.Mock).mockResolvedValue({
            data: {
                id: 'mod-1',
                title: 'Test Module',
                module_type: 'training',
                archived_at: null,
                exam_paper_id: null,
            },
            error: null,
        });
        (fetchModuleResources as jest.Mock).mockResolvedValue({ data: [], error: null });
        (fetchModuleProgressForCandidate as jest.Mock).mockResolvedValue({
            data: { status: 'completed', completed_at: '2026-07-01T00:00:00Z' },
            error: null,
        });
        (fetchModuleItemsWithProgress as jest.Mock).mockResolvedValue({ data: [], error: null });

        render(<ModuleDetailScreen />);

        await waitFor(() => {
            expect(fetchModuleProgressForCandidate).toHaveBeenCalledWith('cand-1', 'mod-1');
            expect(fetchModuleItemsWithProgress).toHaveBeenCalledWith('mod-1', 'cand-1');
        });
        expect(getCandidateIdForUser).toHaveBeenCalledWith('user-1');
        expect(fetchModuleProgressForCandidate).not.toHaveBeenCalledWith('user-1', 'mod-1');
        expect(fetchModuleItemsWithProgress).not.toHaveBeenCalledWith('mod-1', 'user-1');
    });

    it('renders the checklist unticked when no candidate record is linked', async () => {
        (getCandidateIdForUser as jest.Mock).mockResolvedValue(null);
        (fetchModule as jest.Mock).mockResolvedValue({
            data: {
                id: 'mod-1',
                title: 'Test Module',
                module_type: 'training',
                archived_at: null,
                exam_paper_id: null,
            },
            error: null,
        });
        (fetchModuleResources as jest.Mock).mockResolvedValue({ data: [], error: null });
        (fetchModuleItems as jest.Mock).mockResolvedValue({
            data: [{ id: 'item-1', title: 'Read material', item_type: 'material' }],
            error: null,
        });

        const { getAllByTestId, getByText } = render(<ModuleDetailScreen />);

        await waitFor(() => {
            expect(getAllByTestId('module-item-row')).toHaveLength(1);
            expect(getByText('0/1')).toBeTruthy();
        });
        expect(fetchModuleProgressForCandidate).not.toHaveBeenCalled();
        expect(fetchModuleItemsWithProgress).not.toHaveBeenCalled();
    });
});
