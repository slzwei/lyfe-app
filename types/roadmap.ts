import type { Tables } from './supabase';

// ─── Programme & Module Types ────────────────────────────────────────────────

export type ProgrammeIconType = 'seedling' | 'sprout';
export type ModuleType = 'training' | 'exam' | 'resource';
export type ModuleStatus = 'not_started' | 'in_progress' | 'completed';
export type ModuleItemType = 'material' | 'pre_quiz' | 'quiz' | 'exam' | 'attendance';
export type EnrollmentStatus = 'active' | 'completed' | 'paused';
export type ResourceType = 'link' | 'file' | 'video' | 'text';
export type NodeState = 'completed' | 'current' | 'available' | 'locked';

export type RoadmapProgramme = Omit<Tables<'roadmap_programmes'>, 'icon_type'> & {
    icon_type: ProgrammeIconType;
};

export type RoadmapModule = Omit<Tables<'roadmap_modules'>, 'module_type'> & {
    module_type: ModuleType;
};

export type RoadmapResource = Omit<Tables<'roadmap_resources'>, 'resource_type'> & {
    resource_type: ResourceType;
};

export type CandidateModuleProgress = Omit<Tables<'candidate_module_progress'>, 'status'> & {
    status: ModuleStatus;
};

export type CandidateProgrammeEnrollment = Omit<Tables<'candidate_programme_enrollment'>, 'status'> & {
    status: EnrollmentStatus;
};

export type RoadmapModuleItem = Omit<Tables<'roadmap_module_items'>, 'item_type' | 'resource_type'> & {
    item_type: ModuleItemType;
    resource_type: ResourceType | null;
};

export type CandidateModuleItemProgress = Omit<Tables<'candidate_module_item_progress'>, 'status'> & {
    status: ModuleStatus;
};

// ─── Enriched UI Types ──────────────────────────────────────────────────────

export interface ModuleItemWithProgress extends RoadmapModuleItem {
    progress: CandidateModuleItemProgress | null;
}

export interface ModuleItemSummary {
    total: number;
    completed: number;
    itemTypes: ModuleItemType[];
}

export interface RoadmapModuleWithProgress extends RoadmapModule {
    progress: CandidateModuleProgress | null;
    resources: RoadmapResource[];
    itemSummary: ModuleItemSummary | null;
    isLocked: boolean;
    examPaper: { code: string; title: string; pass_percentage: number } | null;
    prerequisiteIds: string[];
    isArchived: boolean;
}

export interface ProgrammeWithModules extends RoadmapProgramme {
    modules: RoadmapModuleWithProgress[];
    completedCount: number;
    totalCount: number;
    percentage: number;
    isLocked: boolean;
    manuallyUnlocked: boolean;
    unlockedByName: string | null;
}

export interface RoadmapNodeData {
    module: RoadmapModuleWithProgress;
    state: NodeState;
    index: number;
    isExam: boolean;
}

// ─── Config ─────────────────────────────────────────────────────────────────

export const MODULE_TYPE_CONFIG: Record<ModuleType, { label: string; icon: string }> = {
    training: { label: 'Training', icon: 'book-outline' },
    exam: { label: 'Exam', icon: 'school-outline' },
    resource: { label: 'Resource', icon: 'folder-outline' },
};

/** Map module type → theme color key for type-safe color lookup */
export const MODULE_TYPE_COLOR_KEY = {
    training: 'roadmapTraining',
    exam: 'roadmapExam',
    resource: 'roadmapResource',
} as const;

export const RESOURCE_TYPE_CONFIG: Record<ResourceType, { label: string; icon: string }> = {
    link: { label: 'Link', icon: 'link-outline' },
    file: { label: 'File', icon: 'document-outline' },
    video: { label: 'Video', icon: 'videocam-outline' },
    text: { label: 'Article', icon: 'reader-outline' },
};

export const MODULE_ITEM_TYPE_CONFIG: Record<ModuleItemType, { label: string; icon: string; color: string }> = {
    material: { label: 'Material', icon: 'document-text-outline', color: '#007AFF' },
    pre_quiz: { label: 'Pre-Quiz', icon: 'help-circle-outline', color: '#AF52DE' },
    quiz: { label: 'Quiz', icon: 'create-outline', color: '#FF9500' },
    exam: { label: 'Exam', icon: 'school-outline', color: '#FF3B30' },
    attendance: { label: 'Attendance', icon: 'people-outline', color: '#34C759' },
};
