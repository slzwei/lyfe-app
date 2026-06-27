/**
 * Tests for lib/leads/meta.ts — leads-scoped presentation + metadata derivations.
 * Pure functions (no I/O): source resolver, display id, notes parser, and the
 * follow-up / key-facts / timeline derivations from lead_activities.metadata.
 */
import type { LeadActivity } from '@/types/lead';
import {
    resolveLeadSource,
    displayLeadId,
    parseLeadNotes,
    deriveFollowUp,
    deriveKeyFacts,
    timelineActivities,
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

describe('resolveLeadSource', () => {
    it('prioritises mktr source_name over source', () => {
        expect(resolveLeadSource({ source: 'referral', source_name: 'mktr' })).toEqual({
            key: 'mktr',
            label: 'MKTR',
            icon: 'megaphone-outline',
        });
    });

    it.each([
        ['referral', 'Referral'],
        ['walk_in', 'Walk-in'],
        ['online', 'Online'],
        ['event', 'Event'],
        ['cold_call', 'Cold call'],
    ])('maps source %s → %s', (source, label) => {
        expect(resolveLeadSource({ source: source as any, source_name: null }).label).toBe(label);
    });

    it('falls back to Other for an unknown source', () => {
        expect(resolveLeadSource({ source: 'mystery' as any, source_name: null })).toEqual({
            key: 'other',
            label: 'Other',
            icon: 'ellipsis-horizontal',
        });
    });
});

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
