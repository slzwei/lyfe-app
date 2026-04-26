import {
    candidateMatchesFilter,
    getCandidateFilterCounts,
    getCandidateFilterLabel,
} from '@/lib/recruitment/candidateFilters';
import type { RecruitmentCandidate } from '@/types/recruitment';

function candidate(status: RecruitmentCandidate['status']): RecruitmentCandidate {
    return {
        id: `cand-${status}`,
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
});
