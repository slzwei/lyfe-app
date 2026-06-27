/**
 * Leads-scoped presentation helpers (mktr-leads UI/UX adoption · Option B).
 * Source resolver + display lead-id. Leads-local; no shared file touched.
 * (The parity plan expands this with follow-up/key-facts/timeline derivations.)
 */
import type { IconName } from '@/types/ui';
import type { Lead } from '@/types/lead';

export interface LeadSourceMeta {
    key: string;
    label: string;
    icon: IconName;
}

/** Maps a lead's `source`/`source_name` to a label + icon for the source badge. */
export function resolveLeadSource(lead: Pick<Lead, 'source' | 'source_name'>): LeadSourceMeta {
    if (lead.source_name === 'mktr') return { key: 'mktr', label: 'MKTR', icon: 'megaphone-outline' };
    switch (lead.source) {
        case 'referral':
            return { key: 'referral', label: 'Referral', icon: 'people-outline' };
        case 'walk_in':
            return { key: 'walk_in', label: 'Walk-in', icon: 'walk-outline' };
        case 'online':
            return { key: 'online', label: 'Online', icon: 'globe-outline' };
        case 'event':
            return { key: 'event', label: 'Event', icon: 'calendar-outline' };
        case 'cold_call':
            return { key: 'cold_call', label: 'Cold call', icon: 'call-outline' };
        default:
            return { key: 'other', label: 'Other', icon: 'ellipsis-horizontal' };
    }
}

/** Short display id for the detail header — `MKTR-XXXXXX` for external leads, else `LD-XXXXXX`. */
export function displayLeadId(lead: Pick<Lead, 'external_id' | 'id'>): string {
    const base = (lead.external_id || lead.id).replace(/[^a-zA-Z0-9]/g, '');
    return `${lead.external_id ? 'MKTR' : 'LD'}-${base.slice(-6).toUpperCase()}`;
}

export interface LeadDetailRow {
    label: string | null;
    value: string;
}

/** Enrichment labels the MKTR receiver writes into `leads.notes` as "Label: value | …". */
const KNOWN_NOTE_LABELS = ['Birthday', 'Postal', 'Company', 'Title', 'Industry', 'Source', 'Campaign', 'QR'];

/**
 * Parses the ` | `-joined enrichment string MKTR writes into `leads.notes` into
 * labeled rows (splitting on the FIRST ": " so values may contain colons). If the
 * text isn't in that structured shape (e.g. a free-text note), it's returned
 * verbatim as one label-less row — never mangled.
 */
export function parseLeadNotes(notes: string | null | undefined): LeadDetailRow[] {
    const text = notes?.trim();
    if (!text) return [];
    const rows: LeadDetailRow[] = [];
    for (const seg of text.split(' | ')) {
        const s = seg.trim();
        const i = s.indexOf(': ');
        const label = i === -1 ? null : s.slice(0, i).trim();
        if (!label || !KNOWN_NOTE_LABELS.includes(label)) {
            return [{ label: null, value: text }];
        }
        rows.push({ label, value: s.slice(i + 2).trim() });
    }
    return rows.filter((r) => r.value.length > 0);
}
