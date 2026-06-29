/**
 * Tests for lib/leads/meta.ts — leads-scoped presentation + metadata derivations.
 * Pure functions (no I/O): source resolver, display id, notes parser, and the
 * follow-up / key-facts / timeline derivations from lead_activities.metadata.
 */
import type { LeadActivity } from '@/types/lead';
import {
    displayLeadId,
    parseLeadNotes,
    deriveFollowUp,
    deriveKeyFacts,
    timelineActivities,
    formatBirthday,
    computeAge,
    withAgeRow,
    realProductInterest,
} from '@/lib/leads/meta';

function act(partial: Partial<LeadActivity>): LeadActivity {
    return {
        id: 'a-1',
        lead_id: 'lead-1',
        user_id: 'user-1',
        type: 'note',
        description: '',
        metadata: {},
        created_at: '2026-06-27T00:00:00Z',
        ...partial,
    } as LeadActivity;
}

// resolveLeadSource moved to lib/leads/sourceBadge.ts — covered in sourceBadge.test.ts.

describe('displayLeadId', () => {
    it('uses MKTR prefix + last 6 of external_id', () => {
        expect(displayLeadId({ external_id: 'mktr_abc123def456', id: 'uuid-1' })).toBe('MKTR-DEF456');
    });

    it('strips non-alphanumerics before slicing', () => {
        expect(displayLeadId({ external_id: 'a-b-c-1-2-3-4-5-6', id: 'x' })).toBe('MKTR-123456');
    });

    it('uses LD prefix + last 6 of id when no external_id', () => {
        expect(displayLeadId({ external_id: null, id: '0000-0000-0000-abcdef' })).toBe('LD-ABCDEF');
    });

    it('uppercases the suffix', () => {
        expect(displayLeadId({ external_id: null, id: 'shortid' })).toBe('LD-HORTID');
    });
});

describe('parseLeadNotes', () => {
    it('returns [] for empty / null / whitespace', () => {
        expect(parseLeadNotes(null)).toEqual([]);
        expect(parseLeadNotes(undefined)).toEqual([]);
        expect(parseLeadNotes('   ')).toEqual([]);
    });

    it('parses known labels into rows', () => {
        const rows = parseLeadNotes('Company: Acme | Title: CEO | Sentiment: Positive');
        expect(rows).toEqual([
            { label: 'Company', value: 'Acme' },
            { label: 'Title', value: 'CEO' },
            { label: 'Sentiment', value: 'Positive' },
        ]);
    });

    it('splits only on the FIRST ": " so values may contain colons', () => {
        expect(parseLeadNotes('Campaign: Q3: Launch')).toEqual([{ label: 'Campaign', value: 'Q3: Launch' }]);
    });

    it('skips unknown labels but keeps known ones (a stray label must not collapse the parse)', () => {
        expect(parseLeadNotes('Mood: chirpy | Company: Acme')).toEqual([{ label: 'Company', value: 'Acme' }]);
    });

    it('drops a known label with an empty value', () => {
        expect(parseLeadNotes('Company:  | Title: CEO')).toEqual([{ label: 'Title', value: 'CEO' }]);
    });

    it('returns legacy free-text verbatim as one label-less row when no known label present', () => {
        expect(parseLeadNotes('Just a freeform note from a call')).toEqual([
            { label: null, value: 'Just a freeform note from a call' },
        ]);
    });

    it('normalises a Birthday value to DD/MM/YYYY at the parse boundary', () => {
        expect(parseLeadNotes('Birthday: 1990-05-15 | Postal: 123456')).toEqual([
            { label: 'Birthday', value: '15/05/1990' },
            { label: 'Postal', value: '123456' },
        ]);
    });
});

describe('deriveFollowUp', () => {
    it('returns null when there is no follow_up activity', () => {
        expect(deriveFollowUp([act({ type: 'note' })])).toBeNull();
    });

    it('returns null when the follow_up row lacks next_follow_up_at', () => {
        expect(deriveFollowUp([act({ type: 'follow_up' as any, metadata: { task: 'call' } })])).toBeNull();
    });

    it('derives at / task / remind from metadata', () => {
        const fu = deriveFollowUp([
            act({
                type: 'follow_up' as any,
                metadata: { next_follow_up_at: '2026-07-01T03:00:00Z', task: 'Send quote', remind: true },
            }),
        ]);
        expect(fu).toEqual({ at: '2026-07-01T03:00:00Z', task: 'Send quote', remind: true });
    });

    it('falls back to description then a default for the task, and remind defaults false', () => {
        const fu = deriveFollowUp([
            act({
                type: 'follow_up' as any,
                description: 'desc task',
                metadata: { next_follow_up_at: '2026-07-01T03:00:00Z' },
            }),
        ]);
        expect(fu).toEqual({ at: '2026-07-01T03:00:00Z', task: 'desc task', remind: false });
    });

    it('picks the FIRST (newest) follow_up row', () => {
        const fu = deriveFollowUp([
            act({
                id: 'new',
                type: 'follow_up' as any,
                metadata: { next_follow_up_at: '2026-08-01T00:00:00Z', task: 'newer' },
            }),
            act({
                id: 'old',
                type: 'follow_up' as any,
                metadata: { next_follow_up_at: '2026-07-01T00:00:00Z', task: 'older' },
            }),
        ]);
        expect(fu?.task).toBe('newer');
    });
});

describe('deriveKeyFacts', () => {
    it('returns [] when there is no key_facts activity', () => {
        expect(deriveKeyFacts([act({ type: 'note' })])).toEqual([]);
    });

    it('returns [] when facts is not an array', () => {
        expect(deriveKeyFacts([act({ type: 'key_facts' as any, metadata: { facts: 'nope' } })])).toEqual([]);
    });

    it('returns well-formed facts and drops malformed entries', () => {
        const facts = deriveKeyFacts([
            act({
                type: 'key_facts' as any,
                metadata: {
                    facts: [
                        { label: 'Budget', value: '$500/mo' },
                        { label: 'Missing value' },
                        { value: 'no label' },
                        null,
                        { label: 'Decision', value: 'By Q3' },
                    ],
                },
            }),
        ]);
        expect(facts).toEqual([
            { label: 'Budget', value: '$500/mo' },
            { label: 'Decision', value: 'By Q3' },
        ]);
    });
});

describe('timelineActivities', () => {
    it('excludes follow_up and key_facts config rows, keeps the rest in order', () => {
        const list = [
            act({ id: '1', type: 'note' }),
            act({ id: '2', type: 'follow_up' as any }),
            act({ id: '3', type: 'call' }),
            act({ id: '4', type: 'key_facts' as any }),
            act({ id: '5', type: 'status_change' as any }),
        ];
        expect(timelineActivities(list).map((a) => a.id)).toEqual(['1', '3', '5']);
    });

    it('returns [] for an all-config list', () => {
        expect(timelineActivities([act({ type: 'follow_up' as any }), act({ type: 'key_facts' as any })])).toEqual([]);
    });
});

describe('formatBirthday', () => {
    it('reformats ISO YYYY-MM-DD (with or without a time) to DD/MM/YYYY', () => {
        expect(formatBirthday('1990-05-15')).toBe('15/05/1990');
        expect(formatBirthday('1990-05-15T10:30:00Z')).toBe('15/05/1990');
    });

    it('zero-pads an already day-first D/M/YYYY', () => {
        expect(formatBirthday('5/5/1990')).toBe('05/05/1990');
        expect(formatBirthday('15/05/1990')).toBe('15/05/1990');
    });

    it('returns empty for blank input and never mangles an unknown shape', () => {
        expect(formatBirthday(null)).toBe('');
        expect(formatBirthday('   ')).toBe('');
        expect(formatBirthday('sometime in 1990')).toBe('sometime in 1990');
    });
});

describe('computeAge', () => {
    beforeAll(() => {
        jest.useFakeTimers().setSystemTime(new Date(2026, 5, 29)); // 29 Jun 2026 (local)
    });
    afterAll(() => {
        jest.useRealTimers();
    });

    it('computes whole-year age from ISO and day-first shapes', () => {
        expect(computeAge('1990-05-15')).toBe(36); // birthday already passed this year
        expect(computeAge('15/05/1990')).toBe(36);
    });

    it('subtracts a year when this year’s birthday has not happened yet', () => {
        expect(computeAge('2000-12-31')).toBe(25);
    });

    it('returns null for a future, out-of-range, or unparseable birthday', () => {
        expect(computeAge('2030-01-01')).toBeNull(); // future → negative → null
        expect(computeAge('1000-01-01')).toBeNull(); // > 120 → null
        expect(computeAge('garbage')).toBeNull();
        expect(computeAge(null)).toBeNull();
    });
});

describe('withAgeRow', () => {
    beforeAll(() => {
        jest.useFakeTimers().setSystemTime(new Date(2026, 5, 29));
    });
    afterAll(() => {
        jest.useRealTimers();
    });

    it('inserts a derived Age row immediately after a Birthday row', () => {
        expect(
            withAgeRow([
                { label: 'Birthday', value: '15/05/1990' },
                { label: 'Postal', value: '123456' },
            ]),
        ).toEqual([
            { label: 'Birthday', value: '15/05/1990' },
            { label: 'Age', value: '36' },
            { label: 'Postal', value: '123456' },
        ]);
    });

    it('leaves rows untouched when there is no Birthday, or the age is unparseable', () => {
        expect(withAgeRow([{ label: 'Postal', value: '123456' }])).toEqual([{ label: 'Postal', value: '123456' }]);
        expect(withAgeRow([{ label: 'Birthday', value: 'unknown' }])).toEqual([
            { label: 'Birthday', value: 'unknown' },
        ]);
    });
});

describe('realProductInterest', () => {
    it('treats the "general" placeholder (any case) as absent', () => {
        expect(realProductInterest('general')).toBeNull();
        expect(realProductInterest('General')).toBeNull();
        expect(realProductInterest(null)).toBeNull();
        expect(realProductInterest('   ')).toBeNull();
    });

    it('returns a real product line unchanged', () => {
        expect(realProductInterest('life')).toBe('life');
        expect(realProductInterest('health')).toBe('health');
    });
});
