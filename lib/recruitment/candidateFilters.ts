import type { CandidateStatus, RecruitmentCandidate } from '@/types/recruitment';

export type CandidateFilterGroup = 'open' | 'interview' | 'paperwork' | 'exam' | 'ready' | 'closed';
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
    if (isCandidateFilterGroup(filter)) {
        return GROUP_STATUS_MAP[filter].includes(candidate.status);
    }
    return candidate.status === filter;
}

export function getCandidateFilterCounts(
    candidates: RecruitmentCandidate[],
): Record<CandidateFilterKey | 'all', number> {
    const counts = {
        all: candidates.length,
        open: 0,
        interview: 0,
        paperwork: 0,
        exam: 0,
        ready: 0,
        closed: 0,
    } as Record<CandidateFilterKey | 'all', number>;

    for (const candidate of candidates) {
        counts[candidate.status] = (counts[candidate.status] ?? 0) + 1;
        for (const group of CANDIDATE_FILTER_GROUPS) {
            if (GROUP_STATUS_MAP[group.key].includes(candidate.status)) {
                counts[group.key] = (counts[group.key] ?? 0) + 1;
            }
        }
    }

    return counts;
}
