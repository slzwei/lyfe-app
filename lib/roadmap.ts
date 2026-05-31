import { captureError } from './sentry';
import { supabase } from './supabase';
import { queueMutation } from './offline';
import type {
    RoadmapProgramme,
    RoadmapModule,
    RoadmapResource,
    RoadmapModuleItem,
    CandidateModuleProgress,
    CandidateModuleItemProgress,
    CandidateProgrammeEnrollment,
    ProgrammeWithModules,
    RoadmapModuleWithProgress,
    ModuleItemWithProgress,
    ModuleItemSummary,
    NodeState,
    ModuleStatus,
    ModuleItemType,
} from '@/types/roadmap';

// ─── Resolve candidates.id from users.id via candidate_profiles bridge ──────

export async function getCandidateIdForUser(userId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('candidate_profiles')
        .select('candidate_id')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        captureError(error, { context: 'getCandidateIdForUser', userId });
        return null;
    }
    return data?.candidate_id ?? null;
}

// ─── Fetch a single module by ID ────────────────────────────────────────────

export async function fetchModule(moduleId: string): Promise<{
    data: RoadmapModule | null;
    error: string | null;
}> {
    const { data, error } = await supabase
        .from('roadmap_modules')
        .select(
            'id, programme_id, title, description, module_type, display_order, is_active, is_required, estimated_minutes, icon_name, icon_color, exam_paper_id, learning_objectives, archived_at, archived_by, created_at, updated_at',
        )
        .eq('id', moduleId)
        .eq('is_active', true)
        .is('archived_at', null)
        .maybeSingle();

    return { data: data as RoadmapModule | null, error: error?.message ?? null };
}

// ─── Fetch module progress for a specific candidate + module ─────────────────

export async function fetchModuleProgressForCandidate(
    candidateId: string,
    moduleId: string,
): Promise<{
    data: CandidateModuleProgress | null;
    error: string | null;
}> {
    const { data, error } = await supabase
        .from('candidate_module_progress')
        .select('id, candidate_id, module_id, status, score, notes, completed_at, completed_by, created_at, updated_at')
        .eq('candidate_id', candidateId)
        .eq('module_id', moduleId)
        .maybeSingle();

    return { data: data as CandidateModuleProgress | null, error: error?.message ?? null };
}

// ─── Fetch all active programmes ────────────────────────────────────────────

export async function fetchProgrammes(): Promise<{
    data: RoadmapProgramme[] | null;
    error: string | null;
}> {
    const { data, error } = await supabase
        .from('roadmap_programmes')
        .select(
            'id, title, slug, description, icon_type, display_order, is_active, archived_at, archived_by, created_at, updated_at',
        )
        .eq('is_active', true)
        .is('archived_at', null)
        .order('display_order');

    return { data: data as RoadmapProgramme[] | null, error: error?.message ?? null };
}

// ─── Fetch modules for a programme ──────────────────────────────────────────

export async function fetchProgrammeModules(programmeId: string): Promise<{
    data: RoadmapModule[] | null;
    error: string | null;
}> {
    const { data, error } = await supabase
        .from('roadmap_modules')
        .select(
            'id, programme_id, title, description, module_type, display_order, is_active, is_required, estimated_minutes, icon_name, icon_color, exam_paper_id, learning_objectives, archived_at, archived_by, created_at, updated_at',
        )
        .eq('programme_id', programmeId)
        .eq('is_active', true)
        .is('archived_at', null)
        .order('display_order');

    return { data: data as RoadmapModule[] | null, error: error?.message ?? null };
}

// ─── Fetch resources for a module ───────────────────────────────────────────

export async function fetchModuleResources(moduleId: string): Promise<{
    data: RoadmapResource[] | null;
    error: string | null;
}> {
    const { data, error } = await supabase
        .from('roadmap_resources')
        .select(
            'id, module_id, title, description, resource_type, content_url, content_text, display_order, is_active, created_at',
        )
        .eq('module_id', moduleId)
        .eq('is_active', true)
        .order('display_order');

    return { data: data as RoadmapResource[] | null, error: error?.message ?? null };
}

// ─── Fetch module items ────────────────────────────────────────────────────

export async function fetchModuleItems(moduleId: string): Promise<{
    data: RoadmapModuleItem[] | null;
    error: string | null;
}> {
    const { data, error } = await supabase
        .from('roadmap_module_items')
        .select(
            'id, module_id, title, description, item_type, display_order, is_active, is_required, resource_type, resource_url, exam_paper_id, pass_percentage, time_limit_minutes, icon_name, archived_at, created_at, updated_at',
        )
        .eq('module_id', moduleId)
        .eq('is_active', true)
        .is('archived_at', null)
        .order('display_order');

    return { data: data as RoadmapModuleItem[] | null, error: error?.message ?? null };
}

// ─── Fetch item progress for a candidate + module ─────────────────────────

export async function fetchModuleItemProgress(
    candidateId: string,
    moduleId: string,
): Promise<{
    data: CandidateModuleItemProgress[] | null;
    error: string | null;
}> {
    const { data, error } = await supabase
        .from('candidate_module_item_progress')
        .select(
            'id, candidate_id, module_item_id, status, score, notes, attempt_count, completed_at, completed_by, created_at, updated_at, roadmap_module_items!inner(module_id)',
        )
        .eq('candidate_id', candidateId)
        .eq('roadmap_module_items.module_id', moduleId);

    if (error) return { data: null, error: error.message };

    // Strip the join data and return clean progress records
    const cleaned = (data ?? []).map(({ roadmap_module_items, ...rest }) => rest) as CandidateModuleItemProgress[];
    return { data: cleaned, error: null };
}

// ─── Fetch items with progress for module detail screen ───────────────────

export async function fetchModuleItemsWithProgress(
    moduleId: string,
    candidateId: string,
): Promise<{
    data: ModuleItemWithProgress[] | null;
    error: string | null;
}> {
    const [itemsRes, progressRes] = await Promise.all([
        fetchModuleItems(moduleId),
        fetchModuleItemProgress(candidateId, moduleId),
    ]);

    if (itemsRes.error) return { data: null, error: itemsRes.error };

    const progressMap = new Map((progressRes.data ?? []).map((p) => [p.module_item_id, p]));

    const items: ModuleItemWithProgress[] = (itemsRes.data ?? []).map((item) => ({
        ...item,
        progress: progressMap.get(item.id) ?? null,
    }));

    return { data: items, error: null };
}

// ─── Update module item progress ──────────────────────────────────────────

export async function updateModuleItemProgress(
    candidateId: string,
    itemId: string,
    status: ModuleStatus,
    updatedBy: string,
    score?: number,
    notes?: string,
): Promise<{ error: string | null }> {
    const row = {
        candidate_id: candidateId,
        module_item_id: itemId,
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
        completed_by: status === 'completed' ? updatedBy : null,
        score: score ?? null,
        notes: notes ?? null,
        attempt_count: 1,
        updated_at: new Date().toISOString(),
    };
    const res = await queueMutation(
        'candidate_module_item_progress',
        'upsert',
        row,
        undefined,
        () =>
            supabase.from('candidate_module_item_progress').upsert(row, { onConflict: 'candidate_id,module_item_id' }),
        'candidate_id,module_item_id',
    );
    return { error: res.error };
}

// ─── Fetch item summary counts for grid cards ─────────────────────────────

export async function fetchModuleItemSummaries(
    moduleIds: string[],
    candidateId: string,
): Promise<{
    data: Map<string, ModuleItemSummary>;
    error: string | null;
}> {
    if (moduleIds.length === 0) return { data: new Map(), error: null };

    const [itemsRes, progressRes] = await Promise.all([
        supabase
            .from('roadmap_module_items')
            .select('id, module_id, item_type, is_required')
            .in('module_id', moduleIds)
            .eq('is_active', true)
            .is('archived_at', null),
        supabase
            .from('candidate_module_item_progress')
            .select('module_item_id, status')
            .eq('candidate_id', candidateId)
            .eq('status', 'completed'),
    ]);

    if (itemsRes.error) return { data: new Map(), error: itemsRes.error.message };

    const completedSet = new Set((progressRes.data ?? []).map((p) => p.module_item_id));

    const summaryMap = new Map<string, ModuleItemSummary>();

    for (const item of itemsRes.data ?? []) {
        const existing = summaryMap.get(item.module_id) ?? { total: 0, completed: 0, itemTypes: [] };
        existing.total++;
        if (completedSet.has(item.id)) existing.completed++;
        if (!existing.itemTypes.includes(item.item_type as ModuleItemType)) {
            existing.itemTypes.push(item.item_type as ModuleItemType);
        }
        summaryMap.set(item.module_id, existing);
    }

    return { data: summaryMap, error: null };
}

// ─── Fetch candidate progress ───────────────────────────────────────────────

export async function fetchCandidateProgress(candidateId: string): Promise<{
    data: CandidateModuleProgress[] | null;
    error: string | null;
}> {
    const { data, error } = await supabase
        .from('candidate_module_progress')
        .select('id, candidate_id, module_id, status, score, notes, completed_at, completed_by, created_at, updated_at')
        .eq('candidate_id', candidateId);

    return { data: data as CandidateModuleProgress[] | null, error: error?.message ?? null };
}

// ─── Fetch full enriched roadmap for a candidate ────────────────────────────

export async function fetchCandidateRoadmap(
    candidateId: string,
    options?: {
        includeDisabled?: boolean;
        includeArchived?: boolean;
    },
): Promise<{
    data: ProgrammeWithModules[] | null;
    error: string | null;
}> {
    try {
        // Build module query based on view context
        let moduleQuery = supabase
            .from('roadmap_modules')
            .select(
                'id, programme_id, title, description, module_type, display_order, is_active, is_required, estimated_minutes, icon_name, icon_color, exam_paper_id, learning_objectives, archived_at, archived_by, created_at, updated_at, exam_papers:exam_paper_id(code, title, pass_percentage)',
            )
            .order('display_order');
        if (!options?.includeDisabled) moduleQuery = moduleQuery.eq('is_active', true);
        if (!options?.includeArchived) moduleQuery = moduleQuery.is('archived_at', null);

        const [programmesSettled, modulesSettled, progressSettled, enrollmentSettled, prerequisitesSettled] =
            await Promise.allSettled([
                supabase
                    .from('roadmap_programmes')
                    .select(
                        'id, title, slug, description, icon_type, display_order, is_active, archived_at, archived_by, created_at, updated_at',
                    )
                    .eq('is_active', true)
                    .is('archived_at', null)
                    .order('display_order'),
                moduleQuery,
                supabase
                    .from('candidate_module_progress')
                    .select(
                        'id, candidate_id, module_id, status, score, notes, completed_at, completed_by, created_at, updated_at',
                    )
                    .eq('candidate_id', candidateId),
                supabase
                    .from('candidate_programme_enrollment')
                    .select(
                        'id, candidate_id, programme_id, status, started_at, completed_at, manually_unlocked, unlocked_by, unlocked_at, created_at',
                    )
                    .eq('candidate_id', candidateId),
                supabase.from('roadmap_prerequisites').select('id, module_id, required_module_id, created_at'),
            ]);

        // Programmes and modules are required — fail if either is unavailable
        if (programmesSettled.status === 'rejected') throw programmesSettled.reason;
        if (modulesSettled.status === 'rejected') throw modulesSettled.reason;
        const programmesRes = programmesSettled.value;
        const modulesRes = modulesSettled.value;
        if (programmesRes.error) throw programmesRes.error;
        if (modulesRes.error) throw modulesRes.error;

        // Progress, enrollment, and prerequisites are optional — degrade gracefully
        const progressRes =
            progressSettled.status === 'fulfilled' && !progressSettled.value.error
                ? progressSettled.value
                : { data: [] };
        const enrollmentRes =
            enrollmentSettled.status === 'fulfilled' && !enrollmentSettled.value.error
                ? enrollmentSettled.value
                : { data: [] };
        const prerequisitesRes =
            prerequisitesSettled.status === 'fulfilled' && !prerequisitesSettled.value.error
                ? prerequisitesSettled.value
                : { data: [] };

        // Fetch item summaries for grid cards (lightweight — just counts + types)
        const allModuleIds = (modulesRes.data ?? []).map((m) => m.id);
        const { data: itemSummaryMap } = await fetchModuleItemSummaries(allModuleIds, candidateId);

        const programmes = programmesRes.data as RoadmapProgramme[];
        const modules = modulesRes.data as (RoadmapModule & {
            exam_papers: { code: string; title: string; pass_percentage: number } | null;
        })[];
        const progress = (progressRes.data ?? []) as CandidateModuleProgress[];
        const enrollments = (enrollmentRes.data ?? []) as CandidateProgrammeEnrollment[];
        const prerequisites = (prerequisitesRes.data ?? []) as { module_id: string; required_module_id: string }[];

        const progressMap = new Map(progress.map((p) => [p.module_id, p]));
        const enrollmentMap = new Map(enrollments.map((e) => [e.programme_id, e]));

        // Build prerequisite lookup: moduleId → [required_module_ids]
        const prereqMap = new Map<string, string[]>();
        prerequisites.forEach((p) => {
            const existing = prereqMap.get(p.module_id) ?? [];
            existing.push(p.required_module_id);
            prereqMap.set(p.module_id, existing);
        });

        // Build module set for prerequisite checking (active non-archived only)
        const activeModuleIds = new Set(modules.filter((m) => m.is_active && !m.archived_at).map((m) => m.id));

        // Determine SeedLYFE completion for programme-level locking
        const seedProgramme = programmes.find((p) => p.slug === 'seedlyfe');
        let isSeedComplete = false;
        if (seedProgramme) {
            const seedModules = modules.filter(
                (m) => m.programme_id === seedProgramme.id && m.is_required && m.is_active && !m.archived_at,
            );
            isSeedComplete = seedModules.every((m) => {
                const p = progressMap.get(m.id);
                return p?.status === 'completed';
            });
        }

        const result: ProgrammeWithModules[] = programmes.map((programme) => {
            const enrollment = enrollmentMap.get(programme.id);
            const isManuallyUnlocked = enrollment?.manually_unlocked ?? false;

            // Programme-level lock: SproutLYFE locked until SeedLYFE complete or manually unlocked
            const isProgrammeLocked = programme.slug === 'sproutlyfe' && !isSeedComplete && !isManuallyUnlocked;

            const programmeModules = modules
                .filter((m) => m.programme_id === programme.id)
                .map((m): RoadmapModuleWithProgress => {
                    const moduleProgress = progressMap.get(m.id) ?? null;
                    const modulePrereqIds = prereqMap.get(m.id) ?? [];

                    // Module locked if programme locked, or any active non-archived prerequisite incomplete
                    const isLockedByPrereq = modulePrereqIds.some((reqId) => {
                        // Disabled/archived prerequisites are satisfied (skipped)
                        if (!activeModuleIds.has(reqId)) return false;
                        const reqProgress = progressMap.get(reqId);
                        return !reqProgress || reqProgress.status !== 'completed';
                    });

                    return {
                        ...m,
                        progress: moduleProgress,
                        resources: [],
                        itemSummary: itemSummaryMap?.get(m.id) ?? null,
                        isLocked: isProgrammeLocked || isLockedByPrereq,
                        examPaper: m.exam_papers ?? null,
                        prerequisiteIds: modulePrereqIds,
                        isArchived: m.archived_at !== null,
                    };
                });

            // Completion percentage: only required, active, non-archived modules
            const countableModules = programmeModules.filter((m) => m.is_required && m.is_active && !m.isArchived);
            const completedCount = countableModules.filter((m) => m.progress?.status === 'completed').length;
            const totalCount = countableModules.length;

            return {
                ...programme,
                modules: programmeModules,
                completedCount,
                totalCount,
                percentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
                isLocked: isProgrammeLocked,
                manuallyUnlocked: isManuallyUnlocked,
                unlockedByName: null, // Populated in UI layer if needed
            };
        });

        return { data: result, error: null };
    } catch (err: unknown) {
        captureError(err, { fn: 'fetchFullRoadmap' });
        const message =
            err instanceof Error
                ? err.message
                : typeof err === 'object' && err !== null && 'message' in err
                  ? String((err as { message: unknown }).message)
                  : 'Failed to fetch roadmap';
        return { data: null, error: message };
    }
}

// ─── Update module progress ─────────────────────────────────────────────────

export async function updateModuleProgress(
    candidateId: string,
    moduleId: string,
    status: ModuleStatus,
    updatedBy: string,
    notes?: string,
    score?: number,
): Promise<{ error: string | null }> {
    const row = {
        candidate_id: candidateId,
        module_id: moduleId,
        status,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
        completed_by: status === 'completed' ? updatedBy : null,
        score: score ?? null,
        notes: notes ?? null,
        updated_at: new Date().toISOString(),
    };
    const res = await queueMutation(
        'candidate_module_progress',
        'upsert',
        row,
        undefined,
        () => supabase.from('candidate_module_progress').upsert(row, { onConflict: 'candidate_id,module_id' }),
        'candidate_id,module_id',
    );
    return { error: res.error };
}

// ─── Update management notes ────────────────────────────────────────────────

export async function updateModuleNotes(
    candidateId: string,
    moduleId: string,
    notes: string,
): Promise<{ error: string | null }> {
    const row = {
        candidate_id: candidateId,
        module_id: moduleId,
        notes,
        updated_at: new Date().toISOString(),
    };
    const res = await queueMutation(
        'candidate_module_progress',
        'upsert',
        row,
        undefined,
        () => supabase.from('candidate_module_progress').upsert(row, { onConflict: 'candidate_id,module_id' }),
        'candidate_id,module_id',
    );
    return { error: res.error };
}

// ─── Enroll candidate in programme ──────────────────────────────────────────

export async function enrollCandidate(candidateId: string, programmeId: string): Promise<{ error: string | null }> {
    // Only insert if no enrollment exists — never overwrite a completed/paused enrollment
    const { data: existing } = await supabase
        .from('candidate_programme_enrollment')
        .select('id')
        .eq('candidate_id', candidateId)
        .eq('programme_id', programmeId)
        .maybeSingle();

    if (existing) return { error: null }; // already enrolled

    const { error } = await supabase.from('candidate_programme_enrollment').insert({
        candidate_id: candidateId,
        programme_id: programmeId,
        status: 'active',
        started_at: new Date().toISOString(),
    });

    return { error: error?.message ?? null };
}

// ─── Manually unlock programme for candidate (PA/Manager/Director) ─────────

export async function unlockProgrammeForCandidate(
    candidateId: string,
    programmeId: string,
    unlockedBy: string,
): Promise<{ error: string | null }> {
    // Validate the programme exists and is active
    const { data: programme, error: progError } = await supabase
        .from('roadmap_programmes')
        .select('id, is_active, archived_at')
        .eq('id', programmeId)
        .maybeSingle();

    if (progError) return { error: progError.message };
    if (!programme) return { error: 'Programme not found' };
    if (!programme.is_active || programme.archived_at) return { error: 'Programme is not active' };

    // Validate the candidate exists
    const { data: candidate, error: candError } = await supabase
        .from('candidates')
        .select('id')
        .eq('id', candidateId)
        .maybeSingle();

    if (candError) return { error: candError.message };
    if (!candidate) return { error: 'Candidate not found' };

    const { error } = await supabase.from('candidate_programme_enrollment').upsert(
        {
            candidate_id: candidateId,
            programme_id: programmeId,
            status: 'active',
            manually_unlocked: true,
            unlocked_by: unlockedBy,
            unlocked_at: new Date().toISOString(),
            started_at: new Date().toISOString(),
        },
        { onConflict: 'candidate_id,programme_id' },
    );

    return { error: error?.message ?? null };
}

// ─── Archive module (admin-only, replaces hard delete) ─────────────────────

export async function archiveModule(moduleId: string, archivedBy: string): Promise<{ error: string | null }> {
    const { error } = await supabase
        .from('roadmap_modules')
        .update({
            archived_at: new Date().toISOString(),
            archived_by: archivedBy,
            is_active: false,
        })
        .eq('id', moduleId);

    return { error: error?.message ?? null };
}

// ─── Restore archived module (admin-only) ──────────────────────────────────

export async function restoreModule(moduleId: string): Promise<{ error: string | null }> {
    const { error } = await supabase
        .from('roadmap_modules')
        .update({
            archived_at: null,
            archived_by: null,
            is_active: true,
        })
        .eq('id', moduleId);

    return { error: error?.message ?? null };
}

/**
 * Compute node states for a full module list.
 * The first non-completed required module becomes 'current'.
 */
export function computeNodeStates(modules: RoadmapModuleWithProgress[]): NodeState[] {
    let foundCurrent = false;

    return modules.map((m) => {
        if (m.isLocked) return 'locked';
        if (m.progress?.status === 'completed') return 'completed';
        if (m.progress?.status === 'in_progress') {
            foundCurrent = true;
            return 'current';
        }
        if (!foundCurrent && m.is_required) {
            foundCurrent = true;
            return 'current';
        }
        return 'available';
    });
}
