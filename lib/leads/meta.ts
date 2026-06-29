/**
 * Leads-scoped presentation helpers (mktr-leads UI/UX adoption · Option B).
 * Source resolver, lead-id, notes parsing, and the follow-up / key-facts /
 * timeline derivations from `lead_activities.metadata`. Leads-local.
 */
import type { Lead, LeadActivity } from '@/types/lead';

/**
 * Source resolution (notes `Source:` → MKTR identity → manual enum) + the kind → brand-glyph
 * map now live in lib/leads/sourceBadge.ts + components/leads/ui/SourceBadge.tsx (mktr-leads
 * parity port — per-platform Facebook / Instagram / TikTok / Google / Meta marks). Import
 * `resolveLeadSource` from '@/lib/leads/sourceBadge'.
 */

/** Short display id for the detail header — `MKTR-XXXXXX` for external leads, else `LD-XXXXXX`. */
export function displayLeadId(lead: Pick<Lead, 'external_id' | 'id'>): string {
    const base = (lead.external_id || lead.id).replace(/[^a-zA-Z0-9]/g, '');
    return `${lead.external_id ? 'MKTR' : 'LD'}-${base.slice(-6).toUpperCase()}`;
}

export interface LeadDetailRow {
    label: string | null;
    value: string;
}

/**
 * Enrichment labels the lyfe `receive-mktr-lead` edge function writes into
 * `leads.notes` as "Label: value | …" (see supabase/functions/receive-mktr-lead/
 * index.ts) — INCLUDING `Tags` + `Sentiment`, which Retell/voice leads carry.
 */
const KNOWN_NOTE_LABELS = [
    'Birthday',
    'Postal',
    'Company',
    'Title',
    'Industry',
    'Source',
    'Tags',
    'Sentiment',
    'Campaign',
    'QR',
];

/**
 * Parses the ` | `-joined enrichment string into labeled rows (splitting on the
 * FIRST ": " so values may contain colons). Unknown/label-less segments are
 * skipped — a single unrecognized label must NOT collapse the whole parse. Only
 * when no known label is present at all is the text returned verbatim as one
 * label-less row (legacy free-text note), never mangled.
 */
export function parseLeadNotes(notes: string | null | undefined): LeadDetailRow[] {
    const text = notes?.trim();
    if (!text) return [];
    const rows: LeadDetailRow[] = [];
    let sawKnown = false;
    for (const seg of text.split(' | ')) {
        const s = seg.trim();
        const i = s.indexOf(': ');
        const label = i === -1 ? null : s.slice(0, i).trim();
        if (label && KNOWN_NOTE_LABELS.includes(label)) {
            sawKnown = true;
            const value = s.slice(i + 2).trim();
            // Normalise a birthday to the app-wide DD/MM/YYYY at the parse boundary.
            if (value) rows.push({ label, value: label === 'Birthday' ? formatBirthday(value) : value });
        }
    }
    if (!sawKnown) return [{ label: null, value: text }];
    return rows;
}

// ── Birthday / Age / product derivations (mktr-leads parity · lib/leadMeta.ts) ──

/**
 * The single source of truth for how a date of birth is displayed across leads: always
 * `DD/MM/YYYY`. Normalises the two shapes a birthday arrives in — ISO `YYYY-MM-DD` (HTML date
 * inputs, optionally carrying a time) and an already day-first `D/M/YYYY` — by string parts
 * only. Working on the parts (never `new Date()`) is deliberate: it's timezone-proof (a
 * date-only string parsed as a Date can shift a day across zones) AND it won't fall for
 * `Date.parse`'s lenient acceptance of free text that merely contains a year. Anything else is
 * returned verbatim, so a birthday is never mangled.
 */
export function formatBirthday(input: string | null | undefined): string {
    const raw = input?.trim();
    if (!raw) return '';
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
        const [, y, m, d] = iso;
        return `${d}/${m}/${y}`;
    }
    const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) {
        const [, d, m, y] = dmy;
        return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
    return raw; // unknown shape — never mangle
}

/**
 * Current age in whole years from a birthday string, or null if it can't be derived. Accepts
 * the same shapes as formatBirthday (ISO `YYYY-MM-DD` or day-first `D/M/YYYY`). Age isn't
 * stored — it's derived from the birthday already on display, so it's always current and needs
 * no backend change. Computed by calendar parts and bounded to a sane 0–120 so a typo / future
 * date never yields a negative or absurd age (→ null, no row).
 */
export function computeAge(birthday: string | null | undefined): number | null {
    const raw = birthday?.trim();
    if (!raw) return null;
    let y: number, mo: number, d: number;
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (iso) {
        y = +iso[1];
        mo = +iso[2];
        d = +iso[3];
    } else if (dmy) {
        d = +dmy[1];
        mo = +dmy[2];
        y = +dmy[3];
    } else {
        return null;
    }
    const now = new Date();
    let age = now.getFullYear() - y;
    // Not had this year's birthday yet → one less.
    const mNow = now.getMonth() + 1;
    if (mNow < mo || (mNow === mo && now.getDate() < d)) age--;
    return age >= 0 && age <= 120 ? age : null;
}

/**
 * Expands a parsed lead-detail list so an Age row follows any Birthday row. Age is a useful
 * at-a-glance signal but isn't stored, so it's derived (current age) from the birthday already
 * on display — keeping parseLeadNotes a pure string parser and the derivation in one helper.
 * A birthday that can't yield a sane age adds no row.
 */
export function withAgeRow(rows: LeadDetailRow[]): LeadDetailRow[] {
    const out: LeadDetailRow[] = [];
    for (const r of rows) {
        out.push(r);
        if (r.label === 'Birthday') {
            const age = computeAge(r.value);
            if (age != null) out.push({ label: 'Age', value: String(age) });
        }
    }
    return out;
}

/**
 * MKTR leads carry the literal placeholder product interest `'general'` (the receiver stamps
 * it when no real product line is sent — receive-mktr-lead/index.ts:343). It's identical on
 * almost every MKTR lead and carries no signal, so treat it as absent for display: callers
 * surface a product chip only for a REAL line ("Life", "Health", "ILP"). Returns the value
 * unchanged when it's real, or null when it's the placeholder.
 */
export function realProductInterest(value: string | null | undefined): string | null {
    const s = value?.trim();
    return s && s.toLowerCase() !== 'general' ? s : null;
}

// ── CRM surfaces derived from lead_activities.metadata ──────────────────────
// Follow-ups + key-facts are persisted as dedicated activity rows whose
// `metadata` carries the structured payload (no leads-table schema change) —
// the same metadata-on-activity model the timeline already uses.

export interface FollowUp {
    at: string; // ISO timestamp
    task: string;
    remind: boolean;
}

export interface KeyFact {
    label: string;
    value: string;
}

function activityMeta(a: LeadActivity): Record<string, unknown> {
    return (a.metadata ?? {}) as Record<string, unknown>;
}

/** Latest follow-up (activities arrive newest-first from `fetchLeadActivities`). */
export function deriveFollowUp(activities: LeadActivity[]): FollowUp | null {
    const row = activities.find((a) => a.type === 'follow_up');
    if (!row) return null;
    const m = activityMeta(row);
    const at = typeof m.next_follow_up_at === 'string' ? m.next_follow_up_at : null;
    if (!at) return null;
    return {
        at,
        task: typeof m.task === 'string' ? m.task : row.description || 'Follow up',
        remind: m.remind === true,
    };
}

/** Latest key-facts set. */
export function deriveKeyFacts(activities: LeadActivity[]): KeyFact[] {
    const row = activities.find((a) => a.type === 'key_facts');
    if (!row) return [];
    const facts = Array.isArray(activityMeta(row).facts) ? (activityMeta(row).facts as unknown[]) : [];
    return facts
        .map((f) => f as Partial<KeyFact>)
        .filter((f): f is KeyFact => !!f && typeof f.label === 'string' && typeof f.value === 'string')
        .map((f) => ({ label: f.label, value: f.value }));
}

/** Config activity types that render in their OWN cards — excluded from the timeline. */
const TIMELINE_EXCLUDED = new Set(['follow_up', 'key_facts']);

/** Timeline = activities minus the follow-up / key-facts config rows. */
export function timelineActivities(activities: LeadActivity[]): LeadActivity[] {
    return activities.filter((a) => !TIMELINE_EXCLUDED.has(a.type));
}
