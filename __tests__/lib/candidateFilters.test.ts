import {
    candidateMatchesFilter,
    getCandidateFilterCounts,
    getCandidateFilterLabel,
} from '@/lib/recruitment/candidateFilters';
import type { RecruitmentCandidate } from '@/types/recruitment';

function candidate(status: RecruitmentCandidate['status'], archivedAt: string | null = null): RecruitmentCandidate {
    return {
        id: `cand-${status}${archivedAt ? '-archived' : ''}`,
        name: 'Priya Selvaraj',
        phone: '+6591111111',
        email: null,
        status,
        assigned_manager_id: 'mgr-1',
        assigned_manager_name: 'Siti Rahman',
        created_by_id: 'mgr-1',
        invite_token: null,
        notes: null,
        resume_url: null,
        profile_pdf_path: null,
        disc_pdf_path: null,
        enneagram_pdf_path: null,
        interviews: [],
        archived_at: archivedAt,
        archived_by_id: archivedAt ? 'mgr-1' : null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-20T00:00:00Z',
    };
}

describe('candidateFilters', () => {
    it('groups exact statuses into readable workflow buckets', () => {
        expect(candidateMatchesFilter(candidate('applied'), 'open')).toBe(true);
        expect(candidateMatchesFilter(candidate('interview_scheduled'), 'interview')).toBe(true);
        expect(candidateMatchesFilter(candidate('eapp_done'), 'paperwork')).toBe(true);
        expect(candidateMatchesFilter(candidate('exam_prep'), 'exam')).toBe(true);
        expect(candidateMatchesFilter(candidate('licensed'), 'ready')).toBe(true);
        expect(candidateMatchesFilter(candidate('rejected'), 'closed')).toBe(true);
    });

    it('keeps exact status filters available', () => {
        expect(candidateMatchesFilter(candidate('interviewed'), 'interviewed')).toBe(true);
        expect(candidateMatchesFilter(candidate('interviewed'), 'applied')).toBe(false);
        expect(getCandidateFilterLabel('exam_prep', (status) => status)).toBe('exam_prep');
    });

    it('counts grouped and granular filters separately', () => {
        const counts = getCandidateFilterCounts([
            candidate('applied'),
            candidate('interview_scheduled'),
            candidate('eapp_done'),
            candidate('rejected'),
            candidate('on_hold'),
        ]);

        expect(counts.all).toBe(5);
        expect(counts.open).toBe(3);
        expect(counts.interview).toBe(1);
        expect(counts.paperwork).toBe(1);
        expect(counts.closed).toBe(2);
        expect(counts.rejected).toBe(1);
    });

    it('surfaces archived candidates only under the archived filter', () => {
        const archived = candidate('applied', '2026-05-01T00:00:00Z');
        expect(candidateMatchesFilter(archived, 'archived')).toBe(true);
        // Archived candidates must never leak into status or status-group filters.
        expect(candidateMatchesFilter(archived, 'open')).toBe(false);
        expect(candidateMatchesFilter(archived, 'applied')).toBe(false);
    });

    it('excludes active candidates from the archived filter', () => {
        expect(candidateMatchesFilter(candidate('applied'), 'archived')).toBe(false);
    });

    it('counts archived candidates separately from all and status groups', () => {
        const counts = getCandidateFilterCounts([
            candidate('applied'),
            candidate('interview_scheduled'),
            candidate('applied', '2026-05-01T00:00:00Z'),
            candidate('licensed', '2026-05-02T00:00:00Z'),
        ]);

        expect(counts.archived).toBe(2);
        // `all` and the group tallies cover only the 2 active candidates.
        expect(counts.all).toBe(2);
        expect(counts.open).toBe(2);
        expect(counts.ready).toBe(0);
    });
});
