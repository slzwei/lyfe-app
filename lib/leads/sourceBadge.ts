/**
 * Lead acquisition-source classifier (ported from mktr-leads · lib/sourceBadge.ts,
 * adapted to lyfe's `Lead` shape). Resolves a lead to a SourceKind + human label so the
 * list card / detail can show a per-platform brand mark (Facebook / Instagram / TikTok /
 * Google / Meta / QR / Voice call / Web) instead of a generic source icon.
 *
 * Resolution order:
 *   1. `notes` "Source: <label>" — the lyfe receive-mktr-lead receiver writes the DERIVED
 *      source there for assigned MKTR leads (supabase/functions/receive-mktr-lead/index.ts:322).
 *      This is the reliable signal — it splits the ad platforms apart. Extracted directly,
 *      NOT via parseLeadNotes (which collapses to one row when a segment has an unknown label).
 *   2. `source_name === 'mktr'` — an MKTR lead with no Source segment (e.g. the firmographic
 *      lead.created shape, or a lead delivered without leadSource). Keep the external "MKTR"
 *      identity rather than the raw `source='online'` placeholder the receiver stamps.
 *   3. `source` — the manual-lead LeadSource enum (referral / walk-in / event / …), used only
 *      for agent-created leads. Mapped to its own kind + the pre-port display label.
 *
 * Kept PURE (no react-native / icon imports) so it unit-tests in plain node — the kind →
 * glyph/color map lives in components/leads/ui/SourceBadge.tsx.
 */
import type { Lead, LeadSource } from '@/types/lead';

export type SourceKind =
    | 'meta'
    | 'facebook'
    | 'instagram'
    | 'tiktok'
    | 'google'
    | 'qr'
    | 'referral'
    | 'call'
    | 'web'
    | 'ad'
    | 'mktr'
    | 'walk_in'
    | 'event'
    | 'unknown';

/** Human label per kind, used when no original `Source:` label is available. */
export const KIND_LABEL: Record<SourceKind, string> = {
    meta: 'Meta',
    facebook: 'Facebook',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    google: 'Google',
    qr: 'QR code',
    referral: 'Referral',
    call: 'Voice call',
    web: 'Web',
    ad: 'Ad',
    mktr: 'MKTR',
    walk_in: 'Walk-in',
    event: 'Event',
    unknown: 'Unknown source',
};

/** Manual-lead LeadSource enum → kind + display label (preserves the pre-port labels). */
const ENUM_SOURCE: Record<LeadSource, { kind: SourceKind; label: string }> = {
    referral: { kind: 'referral', label: 'Referral' },
    walk_in: { kind: 'walk_in', label: 'Walk-in' },
    online: { kind: 'web', label: 'Online' },
    event: { kind: 'event', label: 'Event' },
    cold_call: { kind: 'call', label: 'Cold call' },
    other: { kind: 'unknown', label: 'Other' },
};

/**
 * Pulls the `Source: <label>` value out of the receiver's ` | `-joined notes string,
 * tolerant of other segments and of a value that itself contains ": ". Returns null when
 * there is no Source segment (a lead delivered without leadSource, or legacy free-text notes).
 */
export function extractSourceLabel(notes: string | null | undefined): string | null {
    const text = notes?.trim();
    if (!text) return null;
    for (const seg of text.split(' | ')) {
        const s = seg.trim();
        if (/^source:\s/i.test(s)) {
            const v = s.slice(s.indexOf(':') + 1).trim();
            if (v) return v;
        }
    }
    return null;
}

/**
 * Classifies a free-text source string ("Meta ad", "tiktok", "QR code", "Voice call", …)
 * into a SourceKind by whole-token match — suffix-agnostic, so paid/click variants and
 * title-cased custom labels classify by platform. Short aliases (fb/ig/tt) only match as
 * standalone tokens so they never trigger inside an unrelated word.
 */
export function classifySource(raw: string | null | undefined): SourceKind {
    if (!raw) return 'unknown';
    const tokens = raw
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
    const has = (...t: string[]) => t.some((x) => tokens.includes(x));

    if (has('tiktok', 'tt')) return 'tiktok';
    if (has('instagram', 'insta', 'ig')) return 'instagram';
    if (has('facebook', 'fb')) return 'facebook';
    if (has('meta')) return 'meta';
    // Meta sub-networks whose code/name isn't a consumer brand roll up to the Meta mark:
    // Audience Network (utm "an"; legacy receiver title-cased it "An ad") + Messenger
    // ("msg"). "an" only counts alongside "ad" so the English article never trips it.
    if (has('audience') || has('messenger') || has('msg') || (has('an') && has('ad'))) return 'meta';
    if (has('google')) return 'google';
    if (has('qr')) return 'qr';
    if (has('referral', 'referrer', 'refer')) return 'referral';
    if (has('voice', 'call', 'phone', 'retell')) return 'call';
    if (has('web', 'website', 'form', 'online', 'landing')) return 'web';
    // Unknown platform but clearly a paid/click placement.
    if (has('ad', 'ads', 'click')) return 'ad';
    return 'unknown';
}

/**
 * Normalizes the legacy receiver's verbatim title-casing of Meta's site_source_name codes:
 * "An ad" (an = Audience Network) and "Msg ad" (msg = Messenger) are both Meta, so they show
 * the clean "Meta ad" label. Forward leads already arrive clean, so this is a no-op for them
 * and for every non-Meta label.
 */
const LEGACY_META_RELABEL: Record<string, string> = { 'an ad': 'Meta ad', 'msg ad': 'Meta ad' };
export function cleanSourceLabel(label: string): string {
    return LEGACY_META_RELABEL[label.trim().toLowerCase()] ?? label;
}

export interface ResolvedSource {
    kind: SourceKind;
    /** Human label for the card subtitle / accessibility ("TikTok ad", "Referral", "MKTR"…). */
    label: string;
}

/** Resolves a lead's source: notes `Source:` label → MKTR identity → manual `source` enum. */
export function resolveLeadSource(
    lead: Pick<Lead, 'source' | 'source_name'> & { notes?: string | null },
): ResolvedSource {
    // 1. Derived source from the receiver's `Source:` enrichment (best signal).
    const fromNotes = extractSourceLabel(lead.notes);
    if (fromNotes) return { kind: classifySource(fromNotes), label: cleanSourceLabel(fromNotes) };

    // 2. MKTR lead with no Source segment — keep the external "MKTR" identity, not raw 'online'.
    if (lead.source_name === 'mktr') return { kind: 'mktr', label: 'MKTR' };

    // 3. Manual lead — the LeadSource enum.
    return ENUM_SOURCE[lead.source] ?? { kind: 'unknown', label: 'Other' };
}
