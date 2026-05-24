import type { CandidateStatus, RecruitmentCandidate } from '@/types/recruitment';

export type CandidateFilterGroup = 'open' | 'interview' | 'paperwork' | 'exam' | 'ready' | 'closed' | 'archived';
export type CandidateFilterKey = CandidateFilterGroup | CandidateStatus;

export interface CandidateFilterDefinition {
    key: CandidateFilterGroup;
    label: string;
}

export const CANDIDATE_FILTER_GROUPS: CandidateFilterDefinition[] = [
    { key: 'open', label: 'Open' },
    { key: 'interview', label: 'Interview' },
    { key: 'paperwork', label: 'Paperwork' },
    { key: 'exam', label: 'Exam' },
    { key: 'ready', label: 'Ready' },
    { key: 'closed', label: 'Closed' },
    { key: 'archived', label: 'Archived' },
];

const GROUP_STATUS_MAP: Record<CandidateFilterGroup, CandidateStatus[]> = {
    open: [
        'applied',
        'interview_scheduled',
        'interviewed',
        'approved',
        'eapp_done',
        'exam_prep',
        'licensed',
        'active_agent',
    ],
    interview: ['interview_scheduled', 'interviewed'],
    paperwork: ['approved', 'eapp_done'],
    exam: ['exam_prep'],
    ready: ['licensed', 'active_agent'],
    closed: ['on_hold', 'rejected'],
    archived: [],
};

export function isCandidateFilterGroup(key: CandidateFilterKey): key is CandidateFilterGroup {
    return key in GROUP_STATUS_MAP;
}

export function getCandidateFilterLabel(
    key: CandidateFilterKey,
    statusLabel: (status: CandidateStatus) => string,
): string {
    const group = CANDIDATE_FILTER_GROUPS.find((item) => item.key === key);
    if (group) return group.label;
    return statusLabel(key as CandidateStatus);
}

export function candidateMatchesFilter(candidate: RecruitmentCandidate, filter: CandidateFilterKey): boolean {
    // The Archived filter is the only one that surfaces archived candidates.
    if (filter === 'archived') {
        return candidate.archived_at != null;
    }
    // Archived candidates never appear under status or status-group filters.
    if (candidate.archived_at != null) {
        return false;
    }
    if (isCandidateFilterGroup(filter)) {
        return GROUP_STATUS_MAP[filter].includes(candidate.status);
    }
    return candidate.status === filter;
}

export function getCandidateFilterCounts(
    candidates: RecruitmentCandidate[],
): Record<CandidateFilterKey | 'all', number> {
    const counts = {
        all: 0,
        open: 0,
        interview: 0,
        paperwork: 0,
        exam: 0,
        ready: 0,
        closed: 0,
        archived: 0,
    } as Record<CandidateFilterKey | 'all', number>;

    for (const candidate of candidates) {
        // Archived candidates are counted on their own and excluded from
        // `all` and every status / status-group tally.
        if (candidate.archived_at != null) {
            counts.archived += 1;
            continue;
        }
        counts.all += 1;
        counts[candidate.status] = (counts[candidate.status] ?? 0) + 1;
        for (const group of CANDIDATE_FILTER_GROUPS) {
            if (group.key === 'archived') continue;
            if (GROUP_STATUS_MAP[group.key].includes(candidate.status)) {
                counts[group.key] = (counts[group.key] ?? 0) + 1;
            }
        }
    }

    return counts;
}
