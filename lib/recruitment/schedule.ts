/**
 * Candidate personal schedule ("What's next").
 *
 * Reads the caller's OWN upcoming recruitment dates — interviews, paper/exam
 * sittings, prep-course bookings, and scheduled milestones — via the
 * get_my_candidate_schedule RPC (migration 20260701120000). The RPC is
 * SECURITY DEFINER and self-scoped to the authenticated candidate, and returns
 * only masked, schedule-safe columns (never interview notes/recommendation,
 * paper cost, milestone reference numbers, or zoom links).
 *
 * Read-only — never queued offline (the queue is for writes).
 */
import { supabase } from '../supabase';

export type ScheduleItemKind = 'interview' | 'paper' | 'prep_course' | 'milestone';

/** Raw row shape returned by the get_my_candidate_schedule RPC. */
interface ScheduleRow {
    kind: ScheduleItemKind;
    ref_id: string;
    code: string | null;
    start_at: string;
    end_at: string | null;
    location: string | null;
    is_online: boolean | null;
    status: string | null;
}

/** A single upcoming item in the candidate's personal agenda. */
export interface CandidateScheduleItem {
    kind: ScheduleItemKind;
    /** Source row id (interview / paper attempt / prep booking / milestone). */
    id: string;
    /** paper_code / course_code / milestone_code, or interview type ('zoom'|'in_person'). */
    code: string | null;
    /** ISO timestamptz. */
    startAt: string;
    /** ISO timestamptz — end of a multi-day booking/milestone, else null. */
    endAt: string | null;
    /** In-person interview location; null for online interviews and non-interview items. */
    location: string | null;
    isOnline: boolean;
    status: string | null;
}

/**
 * Fetch the current candidate's upcoming schedule. Returns soonest-first.
 * `limit` caps the number of rows (for the home "What's next" card); pass null
 * for the full agenda. `includePast` drops the upcoming-only cutoff.
 */
export async function fetchMyCandidateSchedule(opts?: {
    includePast?: boolean;
    limit?: number | null;
}): Promise<{ data: CandidateScheduleItem[]; error: string | null }> {
    // RPC isn't in the generated types until `gen:types` re-runs post-migration;
    // cast at the call site (same precedent as get_candidates_live_progress in
    // lib/recruitment/liveApplicants.ts).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('get_my_candidate_schedule', {
        p_include_past: opts?.includePast ?? false,
        p_limit: opts?.limit ?? null,
    });
    if (error) return { data: [], error: error.message };

    const rows = (data ?? []) as ScheduleRow[];
    return {
        data: rows.map((r) => ({
            kind: r.kind,
            id: r.ref_id,
            code: r.code,
            startAt: r.start_at,
            endAt: r.end_at,
            location: r.location,
            isOnline: !!r.is_online,
            status: r.status,
        })),
        error: null,
    };
}

// ── Display helpers (pure — unit-tested) ────────────────────────────────────

const PAPER_LABEL: Record<string, string> = {
    M9: 'M9',
    M9A: 'M9A',
    M5: 'M5',
    RES5: 'RES5',
    HI: 'HI',
    CM_LIP: 'CM-LIP',
};
const PREP_LABEL: Record<string, string> = { M9_M9A: 'M9/M9A', RES5: 'RES5', HI: 'HI' };
const MILESTONE_LABEL: Record<string, string> = {
    bdm: 'BDM',
    bes_induction: 'BES Induction',
    soar: 'SOAR',
    rnf: 'RNF',
    sales_authority: 'Sales Authority',
};

/** Human title for a schedule item, e.g. "Interview", "M9 exam", "M9/M9A prep course", "BES Induction". */
export function scheduleItemTitle(item: CandidateScheduleItem): string {
    switch (item.kind) {
        case 'interview':
            return 'Interview';
        case 'paper':
            return `${PAPER_LABEL[item.code ?? ''] ?? item.code ?? 'Paper'} exam`;
        case 'prep_course':
            return `${PREP_LABEL[item.code ?? ''] ?? item.code ?? ''} prep course`.trim();
        case 'milestone':
            return MILESTONE_LABEL[item.code ?? ''] ?? item.code ?? 'Milestone';
        default:
            return 'Scheduled';
    }
}

const SGT = 'Asia/Singapore';

/**
 * "When" line for a schedule item, formatted in Singapore time:
 *  - interview / paper  → "Tue, 4 Jul · 3:00 PM"
 *  - multi-day prep / milestone → "4 Jul – 6 Jul"
 *  - single-day prep / milestone → "Sun, 6 Jul"
 */
export function formatScheduleWhen(item: CandidateScheduleItem): string {
    const start = new Date(item.startAt);
    const day = start.toLocaleDateString('en-SG', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: SGT,
    });

    if (item.endAt && (item.kind === 'prep_course' || item.kind === 'milestone')) {
        const end = new Date(item.endAt);
        const startShort = start.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: SGT });
        const endShort = end.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: SGT });
        if (startShort !== endShort) return `${startShort} – ${endShort}`;
    }

    if (item.kind === 'interview' || item.kind === 'paper') {
        const time = start.toLocaleTimeString('en-SG', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: SGT,
        });
        return `${day} · ${time}`;
    }

    return day;
}

/** Secondary line: the interview mode/location, else null. */
export function scheduleItemLocation(item: CandidateScheduleItem): string | null {
    if (item.kind !== 'interview') return null;
    return item.isOnline ? 'Online' : (item.location ?? 'In person');
}
