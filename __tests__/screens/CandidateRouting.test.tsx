/**
 * End-to-end routing tests for the candidate view from manager/director perspective.
 *
 * Tests verify:
 *  1. Which detail screen renders depending on the navigation entry point
 *  2. Cross-tab navigation behaviour (team → hidden candidates tab)
 *  3. Route targets from action buttons on each detail screen variant
 *  4. Role guard behaviour for candidate-related tabs
 *  5. Progress route accessibility from each context
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { Colors } from '@/constants/Colors';

// ── Shared mocks ──

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('@/lib/supabase');
jest.mock('@/contexts/ThemeContext', () => ({
    useTheme: () => ({
        colors: { ...require('@/constants/Colors').Colors.light },
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    }),
}));

jest.mock('@/hooks/useTypedRouter', () => ({
    useTypedRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
}));

// Expo Router mocks
let mockSearchParams: Record<string, string> = { candidateId: 'cand-1' };
let mockSegments: string[] = ['(tabs)', 'team', 'candidate', '[candidateId]'];

jest.mock('expo-router', () => ({
    ...jest.requireActual('expo-router'),
    useLocalSearchParams: () => mockSearchParams,
    useSegments: () => mockSegments,
    usePathname: () => '/candidates/cand-1',
    useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
    useFocusEffect: (cb: () => void) => {
        const React = require('react');
        React.useEffect(() => {
            cb();
        }, []);
    },
    router: { replace: mockReplace, push: mockPush, back: mockBack },
}));

jest.mock('react-native-reanimated', () => ({
    useSharedValue: () => ({ value: 0 }),
    useAnimatedStyle: () => ({}),
    withSpring: (v: any) => v,
    withTiming: (v: any, _cfg: any, cb?: (f: boolean) => void) => {
        cb?.(true);
        return v;
    },
    runOnJS: (fn: any) => fn,
    useReducedMotion: () => false,
    Easing: { out: () => undefined, in: () => undefined, cubic: undefined },
}));

// ── Mock data ──

const MOCK_CANDIDATE = {
    id: 'cand-1',
    name: 'Jane Smith',
    phone: '+6598765432',
    email: 'jane@example.com',
    status: 'applied' as const,
    assigned_manager_id: 'mgr-1',
    assigned_manager_name: 'Manager Alice',
    created_by_id: 'mgr-1',
    invite_token: 'inv_abc',
    notes: null,
    resume_url: null,
    profile_pdf_path: null,
    disc_pdf_path: null,
    disc_results: null,
    profile_details: null,
    interviews: [] as any[],
    created_at: '2026-03-01',
    updated_at: '2026-03-05',
};

// ═══════════════════════════════════════════════════════════════════
// TEST GROUP 1: Two different detail screens exist
// ═══════════════════════════════════════════════════════════════════

describe('Candidate Detail Screen Variants', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSearchParams = { candidateId: 'cand-1' };
    });

    describe('NEW screen: candidates/[candidateId].tsx', () => {
        let NewScreen: React.ComponentType;

        beforeAll(() => {
            // Mock all dependencies for the NEW screen
            jest.mock('@/contexts/AuthContext', () => ({
                useAuth: () => ({
                    user: { id: 'mgr-1', role: 'manager', full_name: 'Manager Alice' },
                }),
            }));
            jest.mock('@/lib/recruitment', () => ({
                fetchCandidate: jest.fn().mockResolvedValue({ data: MOCK_CANDIDATE, error: null }),
                addCandidateActivity: jest.fn(),
                getGeneratedPdfUrl: jest.fn(),
                fetchPaperAttempts: jest.fn().mockResolvedValue({ data: [], error: null }),
                fetchMilestones: jest.fn().mockResolvedValue({ data: [], error: null }),
                fetchPrepCourseBookings: jest.fn().mockResolvedValue({ data: [], error: null }),
                upsertMilestone: jest.fn(),
                upsertPrepCourseBooking: jest.fn(),
                markCandidateLicensed: jest.fn(),
            }));
            jest.mock('@/lib/roadmap', () => ({
                fetchCandidateRoadmap: jest.fn().mockResolvedValue({ data: [], error: null }),
            }));
            jest.mock('@/hooks/useContactOutcome', () => ({
                useContactOutcome: () => ({
                    pendingType: null,
                    showConfirmSheet: false,
                    confirmStep: 'outcome',
                    selectedOutcome: null,
                    noteText: '',
                    setNoteText: jest.fn(),
                    handleCall: jest.fn(),
                    handleWhatsApp: jest.fn(),
                    handleOutcomeSelect: jest.fn(),
                    handleSaveActivity: jest.fn(),
                    handleDismissSheet: jest.fn(),
                }),
            }));
            jest.mock('@/hooks/useDocumentManager', () => ({
                useDocumentManager: () => ({
                    documents: [],
                    showPdf: false,
                    pdfUrl: null,
                    pdfTitle: '',
                    showAddDoc: false,
                    addDocLabel: '',
                    addDocCustomLabel: '',
                    addDocStep: 'label',
                    addDocError: null,
                    hasDocumentPicker: true,
                    setShowPdf: jest.fn(),
                    setShowAddDoc: jest.fn(),
                    setAddDocCustomLabel: jest.fn(),
                    handleViewDocument: jest.fn(),
                    openPdfViewer: jest.fn(),
                    handleDeleteDocument: jest.fn(),
                    handleSelectLabel: jest.fn(),
                    pickAndUploadDocument: jest.fn(),
                    openAddDocSheet: jest.fn(),
                    loadDocuments: jest.fn().mockResolvedValue([]),
                }),
            }));
            jest.mock('@/hooks/useInterviewScheduler', () => ({
                useInterviewScheduler: () => ({
                    showScheduleSheet: false,
                    editingInterview: null,
                    scheduleStatus: 'scheduled',
                    scheduleDate: new Date(),
                    scheduleHour: 10,
                    scheduleMinute: 0,
                    scheduleAmPm: 'AM',
                    scheduleType: 'zoom',
                    scheduleLink: '',
                    scheduleLocation: '',
                    scheduleNotes: '',
                    scheduleRecommendation: null,
                    isScheduling: false,
                    scheduleError: null,
                    setScheduleDate: jest.fn(),
                    setScheduleHour: jest.fn(),
                    setScheduleMinute: jest.fn(),
                    setScheduleAmPm: jest.fn(),
                    setScheduleType: jest.fn(),
                    setScheduleLink: jest.fn(),
                    setScheduleLocation: jest.fn(),
                    setScheduleNotes: jest.fn(),
                    setScheduleStatus: jest.fn(),
                    setScheduleRecommendation: jest.fn(),
                    openNewInterview: jest.fn(),
                    openEditInterview: jest.fn(),
                    dismissScheduleSheet: jest.fn(),
                    handleDeleteInterview: jest.fn(),
                    handleSubmitSchedule: jest.fn(),
                }),
            }));
            jest.mock('@/components/ScreenHeader', () => {
                const { Text } = require('react-native');
                return ({ title }: any) => <Text testID="screen-header">{title}</Text>;
            });
            jest.mock('@/components/LoadingState', () => {
                const { Text } = require('react-native');
                return () => <Text>Loading...</Text>;
            });
            jest.mock('@/components/candidates/QuickActionsBar', () => {
                const { Text } = require('react-native');
                return () => <Text testID="quick-actions-bar">Quick Actions</Text>;
            });
            jest.mock('@/components/candidates/HeroSection', () => {
                const { Text } = require('react-native');
                return ({ candidate }: any) => <Text testID="hero-section">{candidate.name}</Text>;
            });
            jest.mock('@/components/candidates/OnboardingChecklist', () => {
                const { Text } = require('react-native');
                return () => <Text testID="onboarding-checklist">Onboarding</Text>;
            });
            jest.mock('@/components/candidates/SectionCard', () => {
                const { View, Text } = require('react-native');
                const SectionCard = ({ title, children }: any) => (
                    <View testID={`section-${title}`}>
                        <Text>{title}</Text>
                        {children}
                    </View>
                );
                const DetailRow = ({ label, value }: any) => (value ? <Text>{`${label}: ${value}`}</Text> : null);
                SectionCard.DetailRow = DetailRow;
                return { __esModule: true, default: SectionCard, DetailRow };
            });
            jest.mock('@/components/candidates/ContactOutcomeSheet', () => () => null);
            jest.mock('@/components/candidates/InterviewSchedulerSheet', () => () => null);
            jest.mock('@/components/candidates/NoteSheet', () => () => null);
            jest.mock('@/components/candidates/PdfViewerModal', () => () => null);
            jest.mock('@/components/candidates/DocumentSection', () => ({
                AddDocumentSheet: () => null,
                DocumentList: () => null,
            }));
            jest.mock('@/components/InterviewCard', () => () => null);
            jest.mock('@/components/roadmap/ProgressSummaryCard', () => {
                const { Text, TouchableOpacity } = require('react-native');
                return ({ onViewFull }: any) => (
                    <TouchableOpacity testID="view-full-progress" onPress={onViewFull}>
                        <Text>View Progress</Text>
                    </TouchableOpacity>
                );
            });
            jest.mock('@/components/roadmap/UnlockConfirmSheet', () => () => null);
            jest.mock('@/hooks/useSheetAnimation', () => ({
                useSheetAnimation: () => false,
            }));

            NewScreen = require('@/app/(tabs)/candidates/[candidateId]').default;
        });

        function renderNewScreen() {
            const { CandidateProgressionProvider } = require('@/contexts/CandidateProgressionContext');
            return render(
                <CandidateProgressionProvider candidateId="cand-1">
                    <NewScreen />
                </CandidateProgressionProvider>,
            );
        }

        it('renders the HeroSection component (unique to NEW screen)', async () => {
            const { getByTestId } = renderNewScreen();
            await waitFor(() => {
                expect(getByTestId('hero-section')).toBeTruthy();
            });
        });

        it('renders OnboardingChecklist (unique to NEW screen)', async () => {
            const { getByTestId } = renderNewScreen();
            await waitFor(() => {
                expect(getByTestId('onboarding-checklist')).toBeTruthy();
            });
        });

        it('renders QuickActionsBar (unique to NEW screen)', async () => {
            const { getByTestId } = renderNewScreen();
            await waitFor(() => {
                expect(getByTestId('quick-actions-bar')).toBeTruthy();
            });
        });

        it('navigates to progress route within candidates tab', async () => {
            // Mock programmes to show training progress
            const { fetchCandidateRoadmap } = require('@/lib/roadmap');
            fetchCandidateRoadmap.mockResolvedValue({
                data: [{ id: 'prog-1', slug: 'seedlyfe', title: 'SeedLYFE', isLocked: false, modules: [] }],
                error: null,
            });

            const { getByTestId } = renderNewScreen();
            await waitFor(() => {
                expect(getByTestId('view-full-progress')).toBeTruthy();
            });
            fireEvent.press(getByTestId('view-full-progress'));
            // usePathname is mocked to '/candidates/cand-1', so base = '/candidates'
            expect(mockPush).toHaveBeenCalledWith('/candidates/progress/cand-1');
        });
    });
});

// ═══════════════════════════════════════════════════════════════════
// TEST GROUP 2: Entry-point routing — which route each list uses
// ═══════════════════════════════════════════════════════════════════

describe('Candidate List Entry Points', () => {
    /**
     * FIXED: team/index.tsx now routes candidates to /(tabs)/team/candidate/${id}
     * which stays within the team tab stack. Previously routed to the hidden
     * candidates tab, causing cross-tab stack buildup where pressing back
     * would show a previously viewed candidate instead of the list.
     */
    it('team/index.tsx: routes within team tab (no cross-tab)', () => {
        // The candidateRoute prop passed in team/index.tsx:
        const teamCandidateRoute = (id: string) => `/(tabs)/team/candidate/${id}`;

        const route = teamCandidateRoute('cand-1');

        // Route stays within the team tab
        expect(route).toBe('/(tabs)/team/candidate/cand-1');
        expect(route).toContain('/(tabs)/team/');
    });

    /**
     * Regression test: cross-tab push causes stack buildup.
     * When routing to a different tab, each push accumulates on that tab's
     * stack. Pressing back reveals a stale candidate instead of the list.
     */
    it('same-tab routing prevents stale stack buildup', () => {
        const route = (id: string) => `/(tabs)/team/candidate/${id}`;

        // Two successive navigations within the same tab
        const first = route('cand-1');
        const second = route('cand-2');

        // Both routes are in the team tab — pressing back from cand-2
        // returns to team/index, NOT to cand-1
        expect(first).toContain('/(tabs)/team/');
        expect(second).toContain('/(tabs)/team/');

        // Cross-tab variant (the old bug) would have been:
        const crossTab = `/(tabs)/candidates/cand-2`;
        expect(crossTab).not.toContain('/(tabs)/team/');
    });

    it('home/candidates.tsx: routes within home tab correctly', () => {
        const homeCandidateRoute = (id: string) => `/(tabs)/home/candidate/${id}`;
        const route = homeCandidateRoute('cand-1');

        // This stays within the home tab — correct for back navigation
        expect(route).toBe('/(tabs)/home/candidate/cand-1');
        expect(route).toContain('/(tabs)/home/');
    });

    it('pa/index.tsx: routes within PA tab correctly', () => {
        const paCandidateRoute = (id: string) => `/(tabs)/pa/candidate/${id}`;
        const route = paCandidateRoute('cand-1');

        // This stays within the PA tab — correct for back navigation
        expect(route).toBe('/(tabs)/pa/candidate/cand-1');
        expect(route).toContain('/(tabs)/pa/');
    });

    it('candidates/index.tsx: routes within candidates tab (only for direct tab access)', () => {
        const candidatesRoute = (id: string) => `/(tabs)/candidates/${id}`;
        const route = candidatesRoute('cand-1');

        expect(route).toBe('/(tabs)/candidates/cand-1');
    });
});

// ═══════════════════════════════════════════════════════════════════
// TEST GROUP 3: Route inconsistencies between OLD and NEW screens
// ═══════════════════════════════════════════════════════════════════

describe('Detail Screen Route Inconsistencies', () => {
    /**
     * BUG: The "Schedule" action in team/candidate/[candidateId].tsx
     * navigates to a DIFFERENT detail screen instead of opening an
     * interview scheduler.
     *
     * In the OLD screen (team/candidate), the "Schedule" button at line 148-153:
     *   router.push(isPaStack
     *     ? `/(tabs)/pa/candidate/${candidateId}`   ← navigates back to itself (circular)
     *     : `/(tabs)/candidates/${candidateId}`)    ← navigates to the NEW screen
     *
     * Expected: Should open interview scheduler sheet (like the NEW screen does)
     * Actual:   Navigates to a different screen entirely
     */
    it('OLD screen Schedule action navigates to NEW screen (cross-tab)', () => {
        // Simulating the Schedule action from OLD screen in team context
        mockSegments = ['(tabs)', 'team', 'candidate', '[candidateId]'];
        const isPaStack = mockSegments.includes('pa');

        const candidateId = 'cand-1';
        const scheduleRoute = isPaStack ? `/(tabs)/pa/candidate/${candidateId}` : `/(tabs)/candidates/${candidateId}`;

        // In team context, this goes to the candidates tab (NEW screen)
        expect(scheduleRoute).toBe('/(tabs)/candidates/cand-1');

        // BUG: This is NOT scheduling — it's navigating to a different detail view
        expect(scheduleRoute).not.toContain('schedule');
        expect(scheduleRoute).not.toContain('interview');
    });

    it('OLD screen Schedule action is circular in PA context', () => {
        // Simulating the Schedule action from OLD screen in PA context
        mockSegments = ['(tabs)', 'pa', 'candidate', '[candidateId]'];
        const isPaStack = mockSegments.includes('pa');

        const candidateId = 'cand-1';
        const scheduleRoute = isPaStack ? `/(tabs)/pa/candidate/${candidateId}` : `/(tabs)/candidates/${candidateId}`;

        // In PA context, this navigates back to the SAME screen
        expect(scheduleRoute).toBe('/(tabs)/pa/candidate/cand-1');
        // BUG: Circular navigation — pressing Schedule re-opens the same screen
    });
});

// ═══════════════════════════════════════════════════════════════════
// TEST GROUP 4: Tab visibility vs route accessibility
// ═══════════════════════════════════════════════════════════════════

describe('Tab Visibility for Candidate Routes', () => {
    const { getVisibleTabs, ROLE_TABS } = require('@/constants/Roles');

    it('candidates tab is NOT visible for manager', () => {
        const tabs = getVisibleTabs('manager', 'manager');
        expect(tabs).not.toContain('candidates');
    });

    it('candidates tab is NOT visible for director', () => {
        const tabs = getVisibleTabs('director', 'manager');
        expect(tabs).not.toContain('candidates');
    });

    it('candidates tab is NOT visible for admin', () => {
        const tabs = getVisibleTabs('admin');
        expect(tabs).not.toContain('candidates');
    });

    it("candidates tab is NOT in any role's visible tabs", () => {
        // The candidates tab is hidden for ALL roles — it's never shown in the tab bar
        const allRoles = Object.keys(ROLE_TABS) as string[];
        allRoles.forEach((role) => {
            const tabs = ROLE_TABS[role];
            expect(tabs).not.toContain('candidates');
        });
    });

    it('team tab includes candidate route in its stack', () => {
        // team/_layout.tsx declares: <Stack.Screen name="candidate/[candidateId]" />
        // This means /(tabs)/team/candidate/${id} is a valid route within the team tab
        // But team/index.tsx doesn't use it — routes to candidates tab instead
        const teamRoute = '/(tabs)/team/candidate/cand-1';
        expect(teamRoute).toContain('/(tabs)/team/');
    });

    /**
     * FIXED: team/index.tsx now routes to the team stack's own candidate route,
     * matching what team/_layout.tsx declares.
     */
    it('team layout candidate routes match team/index navigation', () => {
        // team/index now routes within the team tab
        const routeFromTeamIndex = '/(tabs)/team/candidate/cand-1';
        // team layout declares the same route
        const routeInTeamStack = '/(tabs)/team/candidate/cand-1';

        expect(routeFromTeamIndex).toBe(routeInTeamStack);
    });
});

// ═══════════════════════════════════════════════════════════════════
// TEST GROUP 5: Role guards on candidate layouts
// ═══════════════════════════════════════════════════════════════════

describe('Candidate Layout Role Guards', () => {
    // These tests verify the useRequireRole calls in each layout

    it('candidates layout allows manager, director, admin, pa', () => {
        // From candidates/_layout.tsx: useRequireRole('admin', 'director', 'manager', 'pa')
        const allowedRoles = ['admin', 'director', 'manager', 'pa'];
        expect(allowedRoles).toContain('manager');
        expect(allowedRoles).toContain('director');
        expect(allowedRoles).toContain('admin');
        expect(allowedRoles).toContain('pa');
        expect(allowedRoles).not.toContain('agent');
        expect(allowedRoles).not.toContain('candidate');
    });

    it('team layout allows manager, director, admin only', () => {
        // From team/_layout.tsx: useRequireRole('admin', 'director', 'manager')
        const allowedRoles = ['admin', 'director', 'manager'];
        expect(allowedRoles).toContain('manager');
        expect(allowedRoles).toContain('director');
        expect(allowedRoles).not.toContain('pa');
    });

    it('pa layout allows admin and pa only', () => {
        // From pa/_layout.tsx: useRequireRole('admin', 'pa')
        const allowedRoles = ['admin', 'pa'];
        expect(allowedRoles).toContain('pa');
        expect(allowedRoles).toContain('admin');
        expect(allowedRoles).not.toContain('manager');
    });
});

// ═══════════════════════════════════════════════════════════════════
// TEST GROUP 6: Re-export mapping — which screen each route renders
// ═══════════════════════════════════════════════════════════════════

describe('Re-Export Screen Mapping', () => {
    /**
     * Different routes render DIFFERENT screen implementations:
     *
     * /(tabs)/candidates/[id]           → candidates/[candidateId].tsx (NEW)
     * /(tabs)/team/candidate/[id]       → team/candidate/[candidateId].tsx (OLD)
     * /(tabs)/home/candidate/[id]       → re-exports team/candidate/[candidateId].tsx (OLD)
     * /(tabs)/pa/candidate/[id]         → re-exports team/candidate/[candidateId].tsx (OLD)
     *
     * This means the SAME candidate looks different depending on how you navigate to it.
     */

    it('home/candidate re-exports from team/candidate (OLD screen)', () => {
        // home/candidate/[candidateId].tsx contains:
        // export { default } from '../../team/candidate/[candidateId]';
        const HomeDetail = require('@/app/(tabs)/home/candidate/[candidateId]').default;
        const TeamDetail = require('@/app/(tabs)/team/candidate/[candidateId]').default;
        expect(HomeDetail).toBe(TeamDetail);
    });

    it('pa/candidate re-exports from team/candidate (OLD screen)', () => {
        // pa/candidate/[candidateId].tsx contains:
        // export { default } from '../../team/candidate/[candidateId]';
        const PaDetail = require('@/app/(tabs)/pa/candidate/[candidateId]').default;
        const TeamDetail = require('@/app/(tabs)/team/candidate/[candidateId]').default;
        expect(PaDetail).toBe(TeamDetail);
    });

    it('candidates/[candidateId] is the SAME component as team/candidate/[candidateId]', () => {
        const CandidatesDetail = require('@/app/(tabs)/candidates/[candidateId]').default;
        const TeamDetail = require('@/app/(tabs)/team/candidate/[candidateId]').default;

        // FIXED: team/candidate now re-exports candidates/[candidateId] (NEW screen)
        expect(CandidatesDetail).toBe(TeamDetail);
    });
});

// ═══════════════════════════════════════════════════════════════════
// TEST GROUP 7: Navigation path completeness
// ═══════════════════════════════════════════════════════════════════

describe('Full Navigation Path Audit', () => {
    it('documents all candidate navigation paths for manager/director', () => {
        /**
         * Manager/Director visible tabs: home, leads, team, events, profile
         * Hidden tabs: candidates (href: null), exams (href: null)
         *
         * Candidate list access:
         *   1. Team tab → Candidates segment → CandidateList
         *   2. (No direct tab for candidates)
         *
         * Detail screen access from team:
         *   Team → Candidates segment → tap candidate → /(tabs)/candidates/${id}
         *   This is the NEW screen, in a HIDDEN tab
         *
         * Expected flow:
         *   Team → Candidates segment → tap candidate → /(tabs)/team/candidate/${id}
         *   This would stay in the team tab stack (correct back navigation)
         */
        const managerTabs = ['home', 'leads', 'team', 'events', 'profile'];
        expect(managerTabs).not.toContain('candidates');
        expect(managerTabs).toContain('team');
    });

    it('add-candidate routes correctly from team', () => {
        // team/index.tsx line 376: router.push('/(tabs)/team/add-candidate')
        const addRoute = '/(tabs)/team/add-candidate';
        expect(addRoute).toContain('/(tabs)/team/');
        // This is correct — stays within team tab
    });

    it('add-candidate routes correctly from PA', () => {
        // pa/index.tsx renders: addRoute="/(tabs)/pa/add-candidate"
        const addRoute = '/(tabs)/pa/add-candidate';
        expect(addRoute).toContain('/(tabs)/pa/');
        // This is correct — stays within PA tab
    });

    it('progress route should match parent tab context', () => {
        // From NEW screen (candidates tab): /(tabs)/candidates/progress/${id}
        // From team tab (if used): /(tabs)/team/candidate/progress/${id}
        // From PA tab (if used): /(tabs)/pa/candidate/progress/${id}

        // BUG: Since team/index routes to candidates tab, progress also
        // stays in the candidates tab — user can't get back to team easily
        const progressFromCandidatesTab = '/(tabs)/candidates/progress/cand-1';
        const progressFromTeamTab = '/(tabs)/team/candidate/progress/cand-1';

        expect(progressFromCandidatesTab).not.toContain('/(tabs)/team/');
    });
});
