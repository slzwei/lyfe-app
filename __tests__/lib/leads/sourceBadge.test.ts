/**
 * Tests for lib/leads/sourceBadge.ts — the lead acquisition-source classifier (ported from
 * mktr-leads). Pure functions: extract the `Source:` notes segment, classify a free-text
 * source into a SourceKind, clean legacy Meta sub-source labels, and resolve a lead end-to-end
 * (notes `Source:` → MKTR identity → manual enum).
 */
import { extractSourceLabel, classifySource, cleanSourceLabel, resolveLeadSource } from '@/lib/leads/sourceBadge';
import type { Lead } from '@/types/lead';

describe('extractSourceLabel', () => {
    it('pulls the Source segment out of the joined notes string', () => {
        expect(extractSourceLabel('Company: Acme | Source: Instagram ad | Campaign: Q3')).toBe('Instagram ad');
    });

    it('tolerates a value that itself contains ": "', () => {
        expect(extractSourceLabel('Source: Google: Search')).toBe('Google: Search');
    });

    it('is case-insensitive on the label', () => {
        expect(extractSourceLabel('source: Web form')).toBe('Web form');
    });

    it('returns null when there is no Source segment or notes are empty', () => {
        expect(extractSourceLabel('Company: Acme | Title: CEO')).toBeNull();
        expect(extractSourceLabel(null)).toBeNull();
        expect(extractSourceLabel('   ')).toBeNull();
    });
});

describe('classifySource', () => {
    it.each([
        ['TikTok ad', 'tiktok'],
        ['tt', 'tiktok'],
        ['Instagram ad', 'instagram'],
        ['ig', 'instagram'],
        ['Facebook ad', 'facebook'],
        ['fb', 'facebook'],
        ['Meta ad', 'meta'],
        ['Messenger', 'meta'],
        ['An ad', 'meta'], // Audience Network — "an" only counts alongside "ad"
        ['Google ad', 'google'],
        ['QR code', 'qr'],
        ['Referral', 'referral'],
        ['Voice call', 'call'],
        ['Web form', 'web'],
        ['online', 'web'],
        ['Some click', 'ad'],
        ['', 'unknown'],
        ['totally bespoke', 'unknown'],
    ])('classifies %s → %s', (raw, kind) => {
        expect(classifySource(raw)).toBe(kind);
    });

    it('does NOT treat a bare "an" (English article) as Meta', () => {
        expect(classifySource('an enquiry')).toBe('unknown');
    });

    it('returns unknown for null / undefined', () => {
        expect(classifySource(null)).toBe('unknown');
        expect(classifySource(undefined)).toBe('unknown');
    });
});

describe('cleanSourceLabel', () => {
    it('relabels legacy Meta sub-source codes to "Meta ad"', () => {
        expect(cleanSourceLabel('An ad')).toBe('Meta ad');
        expect(cleanSourceLabel('Msg ad')).toBe('Meta ad');
        expect(cleanSourceLabel('msg ad')).toBe('Meta ad');
    });

    it('passes every other label through unchanged', () => {
        expect(cleanSourceLabel('Instagram ad')).toBe('Instagram ad');
        expect(cleanSourceLabel('Referral')).toBe('Referral');
    });
});

describe('resolveLeadSource', () => {
    const lead = (partial: Partial<Lead>): Pick<Lead, 'source' | 'source_name'> & { notes?: string | null } =>
        ({ source: 'other', source_name: null, notes: null, ...partial }) as Lead;

    it('derives the platform from the notes Source segment (1st priority)', () => {
        expect(resolveLeadSource(lead({ source_name: 'mktr', notes: 'Source: Facebook ad | Campaign: Q3' }))).toEqual({
            kind: 'facebook',
            label: 'Facebook ad',
        });
    });

    it('cleans a legacy Meta sub-source label from notes', () => {
        expect(resolveLeadSource(lead({ source_name: 'mktr', notes: 'Source: An ad' }))).toEqual({
            kind: 'meta',
            label: 'Meta ad',
        });
    });

    it('keeps the MKTR identity when an MKTR lead has no Source segment', () => {
        expect(resolveLeadSource(lead({ source: 'online', source_name: 'mktr', notes: 'Company: Acme' }))).toEqual({
            kind: 'mktr',
            label: 'MKTR',
        });
        expect(resolveLeadSource(lead({ source: 'online', source_name: 'mktr', notes: null }))).toEqual({
            kind: 'mktr',
            label: 'MKTR',
        });
    });

    it.each([
        ['referral', 'referral', 'Referral'],
        ['walk_in', 'walk_in', 'Walk-in'],
        ['online', 'web', 'Online'],
        ['event', 'event', 'Event'],
        ['cold_call', 'call', 'Cold call'],
    ])('maps the manual %s source → kind %s / label %s', (source, kind, label) => {
        expect(resolveLeadSource(lead({ source: source as Lead['source'], source_name: null }))).toEqual({
            kind,
            label,
        });
    });

    it('falls back to unknown / Other for an unrecognised manual source', () => {
        expect(resolveLeadSource(lead({ source: 'mystery' as Lead['source'], source_name: null }))).toEqual({
            kind: 'unknown',
            label: 'Other',
        });
    });
});
