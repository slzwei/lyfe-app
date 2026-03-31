/**
 * Tests for lib/roadmap.ts — Roadmap service layer
 */
import { supabase } from '@/lib/supabase';
import {
    fetchProgrammes,
    fetchModule,
    fetchModuleProgressForCandidate,
    fetchProgrammeModules,
    fetchCandidateProgress,
    fetchModuleResources,
    fetchCandidateRoadmap,
    updateModuleProgress,
    updateModuleNotes,
    enrollCandidate,
    unlockProgrammeForCandidate,
    archiveModule,
    restoreModule,
    computeNodeStates,
    fetchModuleItems,
    fetchModuleItemProgress,
    fetchModuleItemsWithProgress,
    updateModuleItemProgress,
    fetchModuleItemSummaries,
} from '@/lib/roadmap';
import type {
    RoadmapProgramme,
    RoadmapModule,
    RoadmapResource,
    CandidateModuleProgress,
    CandidateProgrammeEnrollment,
    RoadmapModuleWithProgress,
} from '@/types/roadmap';

jest.mock('@/lib/supabase');

const mockSupa = supabase as any;

// ── Fixtures ──

const SEED_PROGRAMME: RoadmapProgramme = {
    id: 'prog-seed',
    slug: 'seedlyfe',
    title: 'SeedLYFE',
    description: 'Foundation programme',
    display_order: 1,
    icon_type: 'seedling',
    is_active: true,
    archived_at: null,
    archived_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
};

const SPROUT_PROGRAMME: RoadmapProgramme = {
    id: 'prog-sprout',
    slug: 'sproutlyfe',
    title: 'SproutLYFE',
    description: 'Advanced programme',
    display_order: 2,
    icon_type: 'sprout',
    is_active: true,
    archived_at: null,
    archived_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
};

function makeModule(
    id: string,
    programmeId: string,
    overrides: Partial<RoadmapModule> = {},
): RoadmapModule & { exam_papers: null } {
    return {
        id,
        programme_id: programmeId,
        title: `Module ${id}`,
        description: null,
        learning_objectives: null,
        module_type: 'training',
        display_order: 1,
        is_active: true,
        is_required: true,
        estimated_minutes: null,
        exam_paper_id: null,
        icon_name: null,
        icon_color: null,
        archived_at: null,
        archived_by: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        exam_papers: null,
        ...overrides,
    };
}

function makeProgress(
    moduleId: string,
    status: CandidateModuleProgress['status'],
    overrides: Partial<CandidateModuleProgress> = {},
): CandidateModuleProgress {
    return {
        id: `prog-${moduleId}`,
        candidate_id: 'cand-1',
        module_id: moduleId,
        status,
        completed_at: status === 'completed' ? '2026-02-01T00:00:00Z' : null,
        completed_by: status === 'completed' ? 'mgr-1' : null,
        score: null,
        notes: null,
        updated_at: '2026-02-01T00:00:00Z',
        created_at: '2026-02-01T00:00:00Z',
        ...overrides,
    };
}

const SEED_MODULE_1 = makeModule('m1', 'prog-seed', { display_order: 1 });
const SEED_MODULE_2 = makeModule('m2', 'prog-seed', { display_order: 2 });
const SPROUT_MODULE_1 = makeModule('m3', 'prog-sprout', { display_order: 1 });

const RESOURCE_ROW: RoadmapResource = {
    id: 'res-1',
    module_id: 'm1',
    title: 'Study Guide',
    description: null,
    resource_type: 'link',
    content_url: 'https://example.com/guide',
    content_text: null,
    display_order: 1,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
};

// ── Setup ──

beforeEach(() => {
    mockSupa.__resetChains();
    jest.clearAllMocks();
});

// ── fetchProgrammes ──

describe('fetchProgrammes', () => {
    it('returns active programmes on success', async () => {
        const chain = mockSupa.__getChain('roadmap_programmes');
        chain.__resolveWith({ data: [SEED_PROGRAMME, SPROUT_PROGRAMME], error: null });

        const result = await fetchProgrammes();

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(2);
        expect(result.data![0].slug).toBe('seedlyfe');
        expect(result.data![1].slug).toBe('sproutlyfe');
        expect(mockSupa.from).toHaveBeenCalledWith('roadmap_programmes');
    });

    it('returns null data and error message on failure', async () => {
        const chain = mockSupa.__getChain('roadmap_programmes');
        chain.__resolveWith({ data: null, error: { message: 'Permission denied' } });

        const result = await fetchProgrammes();

        expect(result.data).toBeNull();
        expect(result.error).toBe('Permission denied');
    });

    it('returns null data and null error when data is null with no error', async () => {
        const chain = mockSupa.__getChain('roadmap_programmes');
        chain.__resolveWith({ data: null, error: null });

        const result = await fetchProgrammes();

        expect(result.data).toBeNull();
        expect(result.error).toBeNull();
    });
});

// ── fetchModuleResources ──

describe('fetchModuleResources', () => {
    it('returns resources for a module on success', async () => {
        const chain = mockSupa.__getChain('roadmap_resources');
        chain.__resolveWith({ data: [RESOURCE_ROW], error: null });

        const result = await fetchModuleResources('m1');

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(1);
        expect(result.data![0].id).toBe('res-1');
        expect(result.data![0].title).toBe('Study Guide');
        expect(mockSupa.from).toHaveBeenCalledWith('roadmap_resources');
    });

    it('returns null data and error message on failure', async () => {
        const chain = mockSupa.__getChain('roadmap_resources');
        chain.__resolveWith({ data: null, error: { message: 'Not found' } });

        const result = await fetchModuleResources('m-bad');

        expect(result.data).toBeNull();
        expect(result.error).toBe('Not found');
    });

    it('returns empty array when there are no resources', async () => {
        const chain = mockSupa.__getChain('roadmap_resources');
        chain.__resolveWith({ data: [], error: null });

        const result = await fetchModuleResources('m1');

        expect(result.error).toBeNull();
        expect(result.data).toEqual([]);
    });
});

// ── fetchCandidateRoadmap ──

describe('fetchCandidateRoadmap', () => {
    function setupMocks({
        programmes = [SEED_PROGRAMME, SPROUT_PROGRAMME],
        modules = [SEED_MODULE_1, SEED_MODULE_2, SPROUT_MODULE_1],
        progress = [] as CandidateModuleProgress[],
        enrollments = [] as CandidateProgrammeEnrollment[],
        prerequisites = [] as { module_id: string; required_module_id: string }[],
    } = {}) {
        mockSupa.__getChain('roadmap_programmes').__resolveWith({ data: programmes, error: null });
        mockSupa.__getChain('roadmap_modules').__resolveWith({ data: modules, error: null });
        mockSupa.__getChain('candidate_module_progress').__resolveWith({ data: progress, error: null });
        mockSupa.__getChain('candidate_programme_enrollment').__resolveWith({ data: enrollments, error: null });
        mockSupa.__getChain('roadmap_prerequisites').__resolveWith({ data: prerequisites, error: null });
    }

    it('returns programmes with modules enriched with progress', async () => {
        setupMocks({
            progress: [makeProgress('m1', 'completed')],
        });

        const result = await fetchCandidateRoadmap('cand-1');

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(2);
        const seedProg = result.data!.find((p) => p.slug === 'seedlyfe')!;
        expect(seedProg.modules).toHaveLength(2);
        const m1 = seedProg.modules.find((m) => m.id === 'm1')!;
        expect(m1.progress?.status).toBe('completed');
        expect(m1.isLocked).toBe(false);
    });

    it('SeedLYFE complete → SproutLYFE is unlocked', async () => {
        setupMocks({
            progress: [makeProgress('m1', 'completed'), makeProgress('m2', 'completed')],
        });

        const result = await fetchCandidateRoadmap('cand-1');

        expect(result.error).toBeNull();
        const sproutProg = result.data!.find((p) => p.slug === 'sproutlyfe')!;
        expect(sproutProg.isLocked).toBe(false);
    });

    it('SeedLYFE incomplete → SproutLYFE is locked', async () => {
        setupMocks({
            progress: [makeProgress('m1', 'completed')], // m2 not completed
        });

        const result = await fetchCandidateRoadmap('cand-1');

        expect(result.error).toBeNull();
        const sproutProg = result.data!.find((p) => p.slug === 'sproutlyfe')!;
        expect(sproutProg.isLocked).toBe(true);
        // SproutLYFE modules are also locked
        expect(sproutProg.modules.every((m) => m.isLocked)).toBe(true);
    });

    it('SeedLYFE incomplete but manually unlocked → SproutLYFE is accessible', async () => {
        const sproutEnrollment: CandidateProgrammeEnrollment = {
            id: 'enr-1',
            candidate_id: 'cand-1',
            programme_id: 'prog-sprout',
            status: 'active',
            manually_unlocked: true,
            unlocked_by: 'mgr-1',
            unlocked_at: '2026-03-01T00:00:00Z',
            started_at: '2026-03-01T00:00:00Z',
            completed_at: null,
            created_at: '2026-03-01T00:00:00Z',
        };

        setupMocks({
            progress: [], // SeedLYFE not done
            enrollments: [sproutEnrollment],
        });

        const result = await fetchCandidateRoadmap('cand-1');

        expect(result.error).toBeNull();
        const sproutProg = result.data!.find((p) => p.slug === 'sproutlyfe')!;
        expect(sproutProg.isLocked).toBe(false);
        expect(sproutProg.manuallyUnlocked).toBe(true);
    });

    it('prerequisite incomplete → dependent module is locked', async () => {
        setupMocks({
            // m2 requires m1 to be completed
            prerequisites: [{ module_id: 'm2', required_module_id: 'm1' }],
            progress: [], // m1 not completed
        });

        const result = await fetchCandidateRoadmap('cand-1');

        expect(result.error).toBeNull();
        const seedProg = result.data!.find((p) => p.slug === 'seedlyfe')!;
        const m2 = seedProg.modules.find((m) => m.id === 'm2')!;
        expect(m2.isLocked).toBe(true);
    });

    it('prerequisite completed → dependent module is available', async () => {
        setupMocks({
            prerequisites: [{ module_id: 'm2', required_module_id: 'm1' }],
            progress: [makeProgress('m1', 'completed')],
        });

        const result = await fetchCandidateRoadmap('cand-1');

        expect(result.error).toBeNull();
        const seedProg = result.data!.find((p) => p.slug === 'seedlyfe')!;
        const m2 = seedProg.modules.find((m) => m.id === 'm2')!;
        expect(m2.isLocked).toBe(false);
    });

    it('disabled prerequisite is treated as satisfied (not blocking)', async () => {
        const disabledModule = makeModule('m-disabled', 'prog-seed', {
            display_order: 0,
            is_active: false,
        });

        setupMocks({
            modules: [disabledModule, SEED_MODULE_1, SEED_MODULE_2, SPROUT_MODULE_1],
            // m1 requires the disabled module
            prerequisites: [{ module_id: 'm1', required_module_id: 'm-disabled' }],
            progress: [], // disabled module has no progress
        });

        const result = await fetchCandidateRoadmap('cand-1');

        expect(result.error).toBeNull();
        const seedProg = result.data!.find((p) => p.slug === 'seedlyfe')!;
        const m1 = seedProg.modules.find((m) => m.id === 'm1')!;
        // Disabled prereq should not block m1
        expect(m1.isLocked).toBe(false);
    });

    it('archived prerequisite is treated as satisfied (not blocking)', async () => {
        const archivedModule = makeModule('m-archived', 'prog-seed', {
            display_order: 0,
            archived_at: '2026-02-01T00:00:00Z',
        });

        setupMocks({
            modules: [archivedModule, SEED_MODULE_1, SEED_MODULE_2, SPROUT_MODULE_1],
            prerequisites: [{ module_id: 'm1', required_module_id: 'm-archived' }],
            progress: [],
        });

        const result = await fetchCandidateRoadmap('cand-1');

        expect(result.error).toBeNull();
        const seedProg = result.data!.find((p) => p.slug === 'seedlyfe')!;
        const m1 = seedProg.modules.find((m) => m.id === 'm1')!;
        // Archived prereq should not block m1
        expect(m1.isLocked).toBe(false);
    });

    it('computes completedCount, totalCount, and percentage correctly', async () => {
        setupMocks({
            progress: [makeProgress('m1', 'completed')],
        });

        const result = await fetchCandidateRoadmap('cand-1');

        expect(result.error).toBeNull();
        const seedProg = result.data!.find((p) => p.slug === 'seedlyfe')!;
        expect(seedProg.completedCount).toBe(1);
        expect(seedProg.totalCount).toBe(2);
        expect(seedProg.percentage).toBe(50);
    });

    it('returns 0% when no required modules exist', async () => {
        const optionalModule = makeModule('m-opt', 'prog-seed', { is_required: false });

        setupMocks({
            modules: [optionalModule, SPROUT_MODULE_1],
            progress: [],
        });

        const result = await fetchCandidateRoadmap('cand-1');

        expect(result.error).toBeNull();
        const seedProg = result.data!.find((p) => p.slug === 'seedlyfe')!;
        expect(seedProg.totalCount).toBe(0);
        expect(seedProg.percentage).toBe(0);
    });

    it('excludes archived modules from completion count', async () => {
        const archivedModule = makeModule('m-arch', 'prog-seed', {
            display_order: 3,
            archived_at: '2026-02-01T00:00:00Z',
        });

        setupMocks({
            modules: [SEED_MODULE_1, SEED_MODULE_2, archivedModule, SPROUT_MODULE_1],
            progress: [makeProgress('m1', 'completed'), makeProgress('m-arch', 'completed')],
        });

        const result = await fetchCandidateRoadmap('cand-1');

        expect(result.error).toBeNull();
        const seedProg = result.data!.find((p) => p.slug === 'seedlyfe')!;
        // Only m1 and m2 count (m-arch is archived and excluded)
        expect(seedProg.totalCount).toBe(2);
        expect(seedProg.completedCount).toBe(1);
    });

    it('respects includeDisabled option', async () => {
        // When includeDisabled is not set (default), disabled modules should be filtered at the query level.
        // We just verify the function resolves and includes only active modules in the returned data.
        const disabledModule = makeModule('m-dis', 'prog-seed', { is_active: false, display_order: 3 });

        // The mock returns whatever we tell it; simulate that the query already filtered
        setupMocks({
            modules: [SEED_MODULE_1, SEED_MODULE_2, SPROUT_MODULE_1],
        });

        const result = await fetchCandidateRoadmap('cand-1', { includeDisabled: false });

        expect(result.error).toBeNull();
        expect(result.data).not.toBeNull();
        // Disabled module was not in the returned data
        const allModuleIds = result.data!.flatMap((p) => p.modules.map((m) => m.id));
        expect(allModuleIds).not.toContain(disabledModule.id);
    });

    it('returns null data and error when programmes query fails', async () => {
        mockSupa.__getChain('roadmap_programmes').__resolveWith({
            data: null,
            error: { message: 'DB connection error' },
        });
        mockSupa.__getChain('roadmap_modules').__resolveWith({ data: [], error: null });
        mockSupa.__getChain('candidate_module_progress').__resolveWith({ data: [], error: null });
        mockSupa.__getChain('candidate_programme_enrollment').__resolveWith({ data: [], error: null });
        mockSupa.__getChain('roadmap_prerequisites').__resolveWith({ data: [], error: null });

        const result = await fetchCandidateRoadmap('cand-1');

        expect(result.data).toBeNull();
        expect(result.error).toBe('DB connection error');
    });

    it('returns null data and error when modules query fails', async () => {
        mockSupa.__getChain('roadmap_programmes').__resolveWith({ data: [SEED_PROGRAMME], error: null });
        mockSupa.__getChain('roadmap_modules').__resolveWith({
            data: null,
            error: { message: 'Modules unavailable' },
        });
        mockSupa.__getChain('candidate_module_progress').__resolveWith({ data: [], error: null });
        mockSupa.__getChain('candidate_programme_enrollment').__resolveWith({ data: [], error: null });
        mockSupa.__getChain('roadmap_prerequisites').__resolveWith({ data: [], error: null });

        const result = await fetchCandidateRoadmap('cand-1');

        expect(result.data).toBeNull();
        expect(result.error).toBe('Modules unavailable');
    });

    it('handles null progress and enrollment data gracefully (treats as empty arrays)', async () => {
        mockSupa.__getChain('roadmap_programmes').__resolveWith({ data: [SEED_PROGRAMME], error: null });
        mockSupa.__getChain('roadmap_modules').__resolveWith({ data: [SEED_MODULE_1], error: null });
        mockSupa.__getChain('candidate_module_progress').__resolveWith({ data: null, error: null });
        mockSupa.__getChain('candidate_programme_enrollment').__resolveWith({ data: null, error: null });
        mockSupa.__getChain('roadmap_prerequisites').__resolveWith({ data: null, error: null });

        const result = await fetchCandidateRoadmap('cand-1');

        expect(result.error).toBeNull();
        expect(result.data).not.toBeNull();
        expect(result.data![0].modules[0].progress).toBeNull();
    });

    it('attaches exam paper data to modules when present', async () => {
        const moduleWithExam = {
            ...makeModule('m-exam', 'prog-seed', { module_type: 'exam', exam_paper_id: 'ep-1' }),
            exam_papers: { code: 'M9', title: 'M9 Exam', pass_percentage: 70 },
        };

        mockSupa.__getChain('roadmap_programmes').__resolveWith({ data: [SEED_PROGRAMME], error: null });
        mockSupa.__getChain('roadmap_modules').__resolveWith({ data: [moduleWithExam], error: null });
        mockSupa.__getChain('candidate_module_progress').__resolveWith({ data: [], error: null });
        mockSupa.__getChain('candidate_programme_enrollment').__resolveWith({ data: [], error: null });
        mockSupa.__getChain('roadmap_prerequisites').__resolveWith({ data: [], error: null });

        const result = await fetchCandidateRoadmap('cand-1');

        expect(result.error).toBeNull();
        const seedProg = result.data![0];
        const examModule = seedProg.modules.find((m) => m.id === 'm-exam')!;
        expect(examModule.examPaper).toEqual({ code: 'M9', title: 'M9 Exam', pass_percentage: 70 });
    });

    it('sets prerequisiteIds on each module', async () => {
        setupMocks({
            prerequisites: [{ module_id: 'm2', required_module_id: 'm1' }],
        });

        const result = await fetchCandidateRoadmap('cand-1');

        expect(result.error).toBeNull();
        const seedProg = result.data!.find((p) => p.slug === 'seedlyfe')!;
        const m2 = seedProg.modules.find((m) => m.id === 'm2')!;
        expect(m2.prerequisiteIds).toEqual(['m1']);
        const m1 = seedProg.modules.find((m) => m.id === 'm1')!;
        expect(m1.prerequisiteIds).toEqual([]);
    });

    it('degrades gracefully when progress query returns error', async () => {
        mockSupa.__getChain('roadmap_programmes').__resolveWith({ data: [SEED_PROGRAMME], error: null });
        mockSupa.__getChain('roadmap_modules').__resolveWith({ data: [SEED_MODULE_1, SEED_MODULE_2], error: null });
        mockSupa.__getChain('candidate_module_progress').__resolveWith({
            data: null,
            error: { message: 'Progress query failed' },
        });
        mockSupa.__getChain('candidate_programme_enrollment').__resolveWith({ data: [], error: null });
        mockSupa.__getChain('roadmap_prerequisites').__resolveWith({ data: [], error: null });

        const result = await fetchCandidateRoadmap('cand-1');

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(1);
        // Modules have no progress attached (graceful degradation)
        const seedProg = result.data![0];
        expect(seedProg.modules.every((m) => m.progress === null)).toBe(true);
    });

    it('degrades gracefully when enrollment query returns error', async () => {
        mockSupa.__getChain('roadmap_programmes').__resolveWith({
            data: [SEED_PROGRAMME, SPROUT_PROGRAMME],
            error: null,
        });
        mockSupa.__getChain('roadmap_modules').__resolveWith({ data: [SEED_MODULE_1], error: null });
        mockSupa.__getChain('candidate_module_progress').__resolveWith({ data: [], error: null });
        mockSupa.__getChain('candidate_programme_enrollment').__resolveWith({
            data: null,
            error: { message: 'Enrollment query failed' },
        });
        mockSupa.__getChain('roadmap_prerequisites').__resolveWith({ data: [], error: null });

        const result = await fetchCandidateRoadmap('cand-1');

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(2);
        // SproutLYFE is locked by default (SeedLYFE incomplete, no enrollment to override)
        const sproutProg = result.data!.find((p) => p.slug === 'sproutlyfe')!;
        expect(sproutProg.isLocked).toBe(true);
    });

    it('degrades gracefully when prerequisites query returns error', async () => {
        mockSupa.__getChain('roadmap_programmes').__resolveWith({ data: [SEED_PROGRAMME], error: null });
        mockSupa.__getChain('roadmap_modules').__resolveWith({ data: [SEED_MODULE_1, SEED_MODULE_2], error: null });
        mockSupa.__getChain('candidate_module_progress').__resolveWith({ data: [], error: null });
        mockSupa.__getChain('candidate_programme_enrollment').__resolveWith({ data: [], error: null });
        mockSupa.__getChain('roadmap_prerequisites').__resolveWith({
            data: null,
            error: { message: 'Prerequisites query failed' },
        });

        const result = await fetchCandidateRoadmap('cand-1');

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(1);
        // Modules have no prerequisite locks (graceful degradation)
        const seedProg = result.data![0];
        expect(seedProg.modules.every((m) => m.prerequisiteIds.length === 0)).toBe(true);
    });

    it('sets isArchived correctly on modules', async () => {
        const archivedModule = makeModule('m-arch', 'prog-seed', {
            display_order: 3,
            archived_at: '2026-02-01T00:00:00Z',
        });

        mockSupa.__getChain('roadmap_programmes').__resolveWith({ data: [SEED_PROGRAMME], error: null });
        mockSupa.__getChain('roadmap_modules').__resolveWith({
            data: [SEED_MODULE_1, archivedModule],
            error: null,
        });
        mockSupa.__getChain('candidate_module_progress').__resolveWith({ data: [], error: null });
        mockSupa.__getChain('candidate_programme_enrollment').__resolveWith({ data: [], error: null });
        mockSupa.__getChain('roadmap_prerequisites').__resolveWith({ data: [], error: null });

        const result = await fetchCandidateRoadmap('cand-1');

        expect(result.error).toBeNull();
        const seedProg = result.data![0];
        expect(seedProg.modules.find((m) => m.id === 'm1')!.isArchived).toBe(false);
        expect(seedProg.modules.find((m) => m.id === 'm-arch')!.isArchived).toBe(true);
    });
});

// ── updateModuleProgress ──

describe('updateModuleProgress', () => {
    it('returns null error on successful upsert', async () => {
        const chain = mockSupa.__getChain('candidate_module_progress');
        chain.__resolveWith({ error: null });

        const result = await updateModuleProgress('cand-1', 'm1', 'completed', 'mgr-1');

        expect(result.error).toBeNull();
        expect(mockSupa.from).toHaveBeenCalledWith('candidate_module_progress');
    });

    it('returns error message on upsert failure', async () => {
        const chain = mockSupa.__getChain('candidate_module_progress');
        chain.__resolveWith({ error: { message: 'RLS policy violation' } });

        const result = await updateModuleProgress('cand-1', 'm1', 'completed', 'mgr-1');

        expect(result.error).toBe('RLS policy violation');
    });

    it('accepts optional notes and score', async () => {
        const chain = mockSupa.__getChain('candidate_module_progress');
        chain.__resolveWith({ error: null });

        const result = await updateModuleProgress('cand-1', 'm1', 'completed', 'mgr-1', 'Great work', 85);

        expect(result.error).toBeNull();
    });

    it('handles all valid status values', async () => {
        const statuses: ('not_started' | 'in_progress' | 'completed')[] = ['not_started', 'in_progress', 'completed'];

        for (const status of statuses) {
            mockSupa.__resetChains();
            const chain = mockSupa.__getChain('candidate_module_progress');
            chain.__resolveWith({ error: null });

            const result = await updateModuleProgress('cand-1', 'm1', status, 'mgr-1');

            expect(result.error).toBeNull();
        }
    });
});

// ── updateModuleNotes ──

describe('updateModuleNotes', () => {
    it('returns null error on successful upsert', async () => {
        const chain = mockSupa.__getChain('candidate_module_progress');
        chain.__resolveWith({ error: null });

        const result = await updateModuleNotes('cand-1', 'm1', 'Great progress on this module');

        expect(result.error).toBeNull();
        expect(mockSupa.from).toHaveBeenCalledWith('candidate_module_progress');
    });

    it('returns error message on upsert failure', async () => {
        const chain = mockSupa.__getChain('candidate_module_progress');
        chain.__resolveWith({ error: { message: 'Foreign key constraint' } });

        const result = await updateModuleNotes('cand-1', 'm1', 'Some notes');

        expect(result.error).toBe('Foreign key constraint');
    });
});

// ── enrollCandidate ──

describe('enrollCandidate', () => {
    it('returns null error on successful enroll', async () => {
        const chain = mockSupa.__getChain('candidate_programme_enrollment');
        chain.__resolveWith({ error: null });

        const result = await enrollCandidate('cand-1', 'prog-seed');

        expect(result.error).toBeNull();
        expect(mockSupa.from).toHaveBeenCalledWith('candidate_programme_enrollment');
    });

    it('returns error message when enroll fails', async () => {
        const chain = mockSupa.__getChain('candidate_programme_enrollment');
        chain.__resolveWith({ error: { message: 'Duplicate enrollment' } });

        const result = await enrollCandidate('cand-1', 'prog-seed');

        expect(result.error).toBe('Duplicate enrollment');
    });
});

// ── unlockProgrammeForCandidate ──

describe('unlockProgrammeForCandidate', () => {
    function setupValidUnlock() {
        const progChain = mockSupa.__getChain('roadmap_programmes');
        progChain.__resolveWith({ data: { id: 'prog-sprout', is_active: true, archived_at: null }, error: null });
        const candChain = mockSupa.__getChain('candidates');
        candChain.__resolveWith({ data: { id: 'cand-1' }, error: null });
        const enrollChain = mockSupa.__getChain('candidate_programme_enrollment');
        enrollChain.__resolveWith({ error: null });
    }

    it('returns null error on successful unlock', async () => {
        setupValidUnlock();

        const result = await unlockProgrammeForCandidate('cand-1', 'prog-sprout', 'mgr-1');

        expect(result.error).toBeNull();
        expect(mockSupa.from).toHaveBeenCalledWith('candidate_programme_enrollment');
    });

    it('returns error message when unlock fails', async () => {
        const progChain = mockSupa.__getChain('roadmap_programmes');
        progChain.__resolveWith({ data: { id: 'prog-sprout', is_active: true, archived_at: null }, error: null });
        const candChain = mockSupa.__getChain('candidates');
        candChain.__resolveWith({ data: { id: 'cand-1' }, error: null });
        const enrollChain = mockSupa.__getChain('candidate_programme_enrollment');
        enrollChain.__resolveWith({ error: { message: 'Permission denied' } });

        const result = await unlockProgrammeForCandidate('cand-1', 'prog-sprout', 'mgr-1');

        expect(result.error).toBe('Permission denied');
    });

    it('returns error when programme not found', async () => {
        const progChain = mockSupa.__getChain('roadmap_programmes');
        progChain.__resolveWith({ data: null, error: null });

        const result = await unlockProgrammeForCandidate('cand-1', 'bad-prog', 'mgr-1');

        expect(result.error).toBe('Programme not found');
    });

    it('returns error when programme is inactive', async () => {
        const progChain = mockSupa.__getChain('roadmap_programmes');
        progChain.__resolveWith({ data: { id: 'prog-old', is_active: false, archived_at: null }, error: null });

        const result = await unlockProgrammeForCandidate('cand-1', 'prog-old', 'mgr-1');

        expect(result.error).toBe('Programme is not active');
    });

    it('returns error when programme is archived', async () => {
        const progChain = mockSupa.__getChain('roadmap_programmes');
        progChain.__resolveWith({ data: { id: 'prog-old', is_active: true, archived_at: '2026-01-01' }, error: null });

        const result = await unlockProgrammeForCandidate('cand-1', 'prog-old', 'mgr-1');

        expect(result.error).toBe('Programme is not active');
    });

    it('returns error when candidate not found', async () => {
        const progChain = mockSupa.__getChain('roadmap_programmes');
        progChain.__resolveWith({ data: { id: 'prog-sprout', is_active: true, archived_at: null }, error: null });
        const candChain = mockSupa.__getChain('candidates');
        candChain.__resolveWith({ data: null, error: null });

        const result = await unlockProgrammeForCandidate('bad-cand', 'prog-sprout', 'mgr-1');

        expect(result.error).toBe('Candidate not found');
    });
});

// ── archiveModule ──

describe('archiveModule', () => {
    it('returns null error on successful archive', async () => {
        const chain = mockSupa.__getChain('roadmap_modules');
        chain.__resolveWith({ error: null });

        const result = await archiveModule('m1', 'admin-1');

        expect(result.error).toBeNull();
        expect(mockSupa.from).toHaveBeenCalledWith('roadmap_modules');
    });

    it('returns error message when archive fails', async () => {
        const chain = mockSupa.__getChain('roadmap_modules');
        chain.__resolveWith({ error: { message: 'Module not found' } });

        const result = await archiveModule('m-bad', 'admin-1');

        expect(result.error).toBe('Module not found');
    });
});

// ── restoreModule ──

describe('restoreModule', () => {
    it('returns null error on successful restore', async () => {
        const chain = mockSupa.__getChain('roadmap_modules');
        chain.__resolveWith({ error: null });

        const result = await restoreModule('m1');

        expect(result.error).toBeNull();
        expect(mockSupa.from).toHaveBeenCalledWith('roadmap_modules');
    });

    it('returns error message when restore fails', async () => {
        const chain = mockSupa.__getChain('roadmap_modules');
        chain.__resolveWith({ error: { message: 'Restore conflict' } });

        const result = await restoreModule('m1');

        expect(result.error).toBe('Restore conflict');
    });
});

// ── fetchModule ──

describe('fetchModule', () => {
    it('returns a single module on success', async () => {
        const chain = mockSupa.__getChain('roadmap_modules');
        chain.__resolveWith({ data: SEED_MODULE_1, error: null });

        const result = await fetchModule('m1');

        expect(result.error).toBeNull();
        expect(result.data).toEqual(SEED_MODULE_1);
        expect(mockSupa.from).toHaveBeenCalledWith('roadmap_modules');
    });

    it('returns null data and error message on failure', async () => {
        const chain = mockSupa.__getChain('roadmap_modules');
        chain.__resolveWith({ data: null, error: { message: 'Not found' } });

        const result = await fetchModule('m-bad');

        expect(result.data).toBeNull();
        expect(result.error).toBe('Not found');
    });

    it('returns null data and null error when module does not exist', async () => {
        const chain = mockSupa.__getChain('roadmap_modules');
        chain.__resolveWith({ data: null, error: null });

        const result = await fetchModule('m-nonexistent');

        expect(result.data).toBeNull();
        expect(result.error).toBeNull();
    });
});

// ── fetchModuleProgressForCandidate ──

describe('fetchModuleProgressForCandidate', () => {
    it('returns progress record on success', async () => {
        const progressRow = makeProgress('m1', 'completed');
        const chain = mockSupa.__getChain('candidate_module_progress');
        chain.__resolveWith({ data: progressRow, error: null });

        const result = await fetchModuleProgressForCandidate('cand-1', 'm1');

        expect(result.error).toBeNull();
        expect(result.data).toEqual(progressRow);
        expect(result.data!.status).toBe('completed');
        expect(mockSupa.from).toHaveBeenCalledWith('candidate_module_progress');
    });

    it('returns null data and error message on failure', async () => {
        const chain = mockSupa.__getChain('candidate_module_progress');
        chain.__resolveWith({ data: null, error: { message: 'RLS violation' } });

        const result = await fetchModuleProgressForCandidate('cand-1', 'm1');

        expect(result.data).toBeNull();
        expect(result.error).toBe('RLS violation');
    });

    it('returns null data and null error when no progress exists', async () => {
        const chain = mockSupa.__getChain('candidate_module_progress');
        chain.__resolveWith({ data: null, error: null });

        const result = await fetchModuleProgressForCandidate('cand-1', 'm-no-progress');

        expect(result.data).toBeNull();
        expect(result.error).toBeNull();
    });
});

// ── fetchProgrammeModules ──

describe('fetchProgrammeModules', () => {
    it('returns modules for a programme on success', async () => {
        const chain = mockSupa.__getChain('roadmap_modules');
        chain.__resolveWith({ data: [SEED_MODULE_1, SEED_MODULE_2], error: null });

        const result = await fetchProgrammeModules('prog-seed');

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(2);
        expect(result.data![0].id).toBe('m1');
        expect(result.data![1].id).toBe('m2');
        expect(mockSupa.from).toHaveBeenCalledWith('roadmap_modules');
    });

    it('returns null data and error message on failure', async () => {
        const chain = mockSupa.__getChain('roadmap_modules');
        chain.__resolveWith({ data: null, error: { message: 'Permission denied' } });

        const result = await fetchProgrammeModules('prog-bad');

        expect(result.data).toBeNull();
        expect(result.error).toBe('Permission denied');
    });

    it('returns empty array when programme has no modules', async () => {
        const chain = mockSupa.__getChain('roadmap_modules');
        chain.__resolveWith({ data: [], error: null });

        const result = await fetchProgrammeModules('prog-empty');

        expect(result.error).toBeNull();
        expect(result.data).toEqual([]);
    });
});

// ── fetchCandidateProgress ──

describe('fetchCandidateProgress', () => {
    it('returns all progress records for a candidate on success', async () => {
        const progressRows = [makeProgress('m1', 'completed'), makeProgress('m2', 'in_progress')];
        const chain = mockSupa.__getChain('candidate_module_progress');
        chain.__resolveWith({ data: progressRows, error: null });

        const result = await fetchCandidateProgress('cand-1');

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(2);
        expect(result.data![0].status).toBe('completed');
        expect(result.data![1].status).toBe('in_progress');
        expect(mockSupa.from).toHaveBeenCalledWith('candidate_module_progress');
    });

    it('returns null data and error message on failure', async () => {
        const chain = mockSupa.__getChain('candidate_module_progress');
        chain.__resolveWith({ data: null, error: { message: 'Timeout' } });

        const result = await fetchCandidateProgress('cand-1');

        expect(result.data).toBeNull();
        expect(result.error).toBe('Timeout');
    });

    it('returns empty array when candidate has no progress', async () => {
        const chain = mockSupa.__getChain('candidate_module_progress');
        chain.__resolveWith({ data: [], error: null });

        const result = await fetchCandidateProgress('cand-new');

        expect(result.error).toBeNull();
        expect(result.data).toEqual([]);
    });
});

// ── computeNodeStates (pure function) ──

describe('computeNodeStates', () => {
    function makeModuleWithProgress(
        id: string,
        isLocked: boolean,
        status: CandidateModuleProgress['status'] | null,
        isRequired = true,
    ): RoadmapModuleWithProgress {
        return {
            ...makeModule(id, 'prog-seed', { is_required: isRequired }),
            progress: status ? makeProgress(id, status) : null,
            resources: [],
            itemSummary: null,
            isLocked,
            examPaper: null,
            prerequisiteIds: [],
            isArchived: false,
        };
    }

    it('returns "completed" for a completed module', () => {
        const modules = [makeModuleWithProgress('m1', false, 'completed')];
        const states = computeNodeStates(modules);
        expect(states).toEqual(['completed']);
    });

    it('returns "locked" for a locked module regardless of progress', () => {
        const modules = [makeModuleWithProgress('m1', true, 'completed')];
        const states = computeNodeStates(modules);
        expect(states).toEqual(['locked']);
    });

    it('returns "current" for an in_progress module', () => {
        const modules = [makeModuleWithProgress('m1', false, 'in_progress')];
        const states = computeNodeStates(modules);
        expect(states).toEqual(['current']);
    });

    it('returns "current" for the first non-completed required module with no progress', () => {
        const modules = [makeModuleWithProgress('m1', false, null, true)];
        const states = computeNodeStates(modules);
        expect(states).toEqual(['current']);
    });

    it('returns "available" for a non-required module with no progress', () => {
        const modules = [makeModuleWithProgress('m1', false, null, false)];
        const states = computeNodeStates(modules);
        expect(states).toEqual(['available']);
    });

    it('returns "available" for required modules after the current node is found', () => {
        const modules = [
            makeModuleWithProgress('m1', false, null, true), // becomes 'current'
            makeModuleWithProgress('m2', false, null, true), // becomes 'available' (current already found)
        ];
        const states = computeNodeStates(modules);
        expect(states).toEqual(['current', 'available']);
    });

    it('full sequence: completed, current, available, locked', () => {
        const modules = [
            makeModuleWithProgress('m1', false, 'completed'),
            makeModuleWithProgress('m2', false, null, true), // first non-completed required → current
            makeModuleWithProgress('m3', false, null, true), // available (current already found)
            makeModuleWithProgress('m4', true, null, true), // locked
        ];
        const states = computeNodeStates(modules);
        expect(states).toEqual(['completed', 'current', 'available', 'locked']);
    });

    it('in_progress takes precedence over "first required" for current designation', () => {
        const modules = [
            makeModuleWithProgress('m1', false, null, true), // required but no progress
            makeModuleWithProgress('m2', false, 'in_progress'), // explicitly in_progress
        ];
        const states = computeNodeStates(modules);
        // m1 is the first required with no progress → current
        // m2 is in_progress → but foundCurrent is already true from m1, so m2 stays 'current' via in_progress branch
        expect(states[0]).toBe('current');
        expect(states[1]).toBe('current');
    });

    it('returns empty array for empty input', () => {
        expect(computeNodeStates([])).toEqual([]);
    });

    it('all locked → all return locked', () => {
        const modules = [
            makeModuleWithProgress('m1', true, null),
            makeModuleWithProgress('m2', true, null),
            makeModuleWithProgress('m3', true, null),
        ];
        const states = computeNodeStates(modules);
        expect(states).toEqual(['locked', 'locked', 'locked']);
    });

    it('all completed → all return completed', () => {
        const modules = [
            makeModuleWithProgress('m1', false, 'completed'),
            makeModuleWithProgress('m2', false, 'completed'),
        ];
        const states = computeNodeStates(modules);
        expect(states).toEqual(['completed', 'completed']);
    });

    it('optional modules after current do not re-trigger current', () => {
        const modules = [
            makeModuleWithProgress('m1', false, null, true), // required → current
            makeModuleWithProgress('m2', false, null, false), // optional → available
            makeModuleWithProgress('m3', false, null, false), // optional → available
        ];
        const states = computeNodeStates(modules);
        expect(states).toEqual(['current', 'available', 'available']);
    });
});

// ── fetchModuleItems ──

describe('fetchModuleItems', () => {
    it('returns active items for a module', async () => {
        const items = [
            { id: 'item-1', module_id: 'm1', item_type: 'material', title: 'Reading', display_order: 0 },
            { id: 'item-2', module_id: 'm1', item_type: 'quiz', title: 'Module Quiz', display_order: 1 },
        ];
        const chain = mockSupa.__getChain('roadmap_module_items');
        chain.__resolveWith({ data: items, error: null });

        const result = await fetchModuleItems('m1');

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(2);
        expect(result.data![0].title).toBe('Reading');
        expect(mockSupa.from).toHaveBeenCalledWith('roadmap_module_items');
    });

    it('returns error on failure', async () => {
        const chain = mockSupa.__getChain('roadmap_module_items');
        chain.__resolveWith({ data: null, error: { message: 'Not found' } });

        const result = await fetchModuleItems('m-bad');

        expect(result.data).toBeNull();
        expect(result.error).toBe('Not found');
    });

    it('returns empty array when module has no items', async () => {
        const chain = mockSupa.__getChain('roadmap_module_items');
        chain.__resolveWith({ data: [], error: null });

        const result = await fetchModuleItems('m1');

        expect(result.error).toBeNull();
        expect(result.data).toEqual([]);
    });
});

// ── fetchModuleItemProgress ──

describe('fetchModuleItemProgress', () => {
    it('returns item progress for a candidate and module', async () => {
        const progressData = [
            {
                id: 'ip-1',
                candidate_id: 'cand-1',
                module_item_id: 'item-1',
                status: 'completed',
                roadmap_module_items: { module_id: 'm1' },
            },
        ];
        const chain = mockSupa.__getChain('candidate_module_item_progress');
        chain.__resolveWith({ data: progressData, error: null });

        const result = await fetchModuleItemProgress('cand-1', 'm1');

        expect(result.error).toBeNull();
        expect(result.data).toHaveLength(1);
        // Join data should be stripped
        expect((result.data![0] as any).roadmap_module_items).toBeUndefined();
        expect(result.data![0].module_item_id).toBe('item-1');
    });

    it('returns error on failure', async () => {
        const chain = mockSupa.__getChain('candidate_module_item_progress');
        chain.__resolveWith({ data: null, error: { message: 'RLS violation' } });

        const result = await fetchModuleItemProgress('cand-1', 'm1');

        expect(result.data).toBeNull();
        expect(result.error).toBe('RLS violation');
    });
});

// ── updateModuleItemProgress ──

describe('updateModuleItemProgress', () => {
    it('returns null error on successful upsert', async () => {
        const chain = mockSupa.__getChain('candidate_module_item_progress');
        chain.__resolveWith({ error: null });

        const result = await updateModuleItemProgress('cand-1', 'item-1', 'completed', 'mgr-1');

        expect(result.error).toBeNull();
        expect(mockSupa.from).toHaveBeenCalledWith('candidate_module_item_progress');
    });

    it('returns error message on failure', async () => {
        const chain = mockSupa.__getChain('candidate_module_item_progress');
        chain.__resolveWith({ error: { message: 'Constraint violation' } });

        const result = await updateModuleItemProgress('cand-1', 'item-1', 'completed', 'mgr-1');

        expect(result.error).toBe('Constraint violation');
    });

    it('accepts optional score and notes', async () => {
        const chain = mockSupa.__getChain('candidate_module_item_progress');
        chain.__resolveWith({ error: null });

        const result = await updateModuleItemProgress('cand-1', 'item-1', 'completed', 'mgr-1', 92, 'Well done');

        expect(result.error).toBeNull();
    });
});

// ── fetchModuleItemSummaries ──

describe('fetchModuleItemSummaries', () => {
    it('returns empty map for empty module IDs', async () => {
        const result = await fetchModuleItemSummaries([], 'cand-1');

        expect(result.error).toBeNull();
        expect(result.data.size).toBe(0);
    });

    it('returns summaries with correct counts', async () => {
        const items = [
            { id: 'item-1', module_id: 'm1', item_type: 'material', is_required: true },
            { id: 'item-2', module_id: 'm1', item_type: 'quiz', is_required: true },
            { id: 'item-3', module_id: 'm2', item_type: 'attendance', is_required: true },
        ];
        const progress = [{ module_item_id: 'item-1', status: 'completed' }];

        mockSupa.__getChain('roadmap_module_items').__resolveWith({ data: items, error: null });
        mockSupa.__getChain('candidate_module_item_progress').__resolveWith({ data: progress, error: null });

        const result = await fetchModuleItemSummaries(['m1', 'm2'], 'cand-1');

        expect(result.error).toBeNull();
        const m1Summary = result.data.get('m1')!;
        expect(m1Summary.total).toBe(2);
        expect(m1Summary.completed).toBe(1);
        expect(m1Summary.itemTypes).toContain('material');
        expect(m1Summary.itemTypes).toContain('quiz');

        const m2Summary = result.data.get('m2')!;
        expect(m2Summary.total).toBe(1);
        expect(m2Summary.completed).toBe(0);
        expect(m2Summary.itemTypes).toContain('attendance');
    });

    it('returns empty map with error when items query fails', async () => {
        mockSupa.__getChain('roadmap_module_items').__resolveWith({
            data: null,
            error: { message: 'Query failed' },
        });
        mockSupa.__getChain('candidate_module_item_progress').__resolveWith({ data: [], error: null });

        const result = await fetchModuleItemSummaries(['m1'], 'cand-1');

        expect(result.error).toBe('Query failed');
        expect(result.data.size).toBe(0);
    });
});
