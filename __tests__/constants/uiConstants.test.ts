/**
 * Tests for shared UI constants exported from constants/ui.ts
 *
 * Verified:
 * - ANIM, SPACING, ICON are all exported
 * - ANIM contains MICRO, TRANSITION, REVEAL with expected numeric values
 * - SPACING contains XS, SM, MD, LG, XL, XXL on the 4pt grid
 * - ICON contains SM, MD, LG, XL with ascending values
 * - All constants are readonly (as const)
 */
import { ANIM, SPACING, ICON } from '@/constants/ui';

// ── ANIM ─────────────────────────────────────────────────────────────────────

describe('ANIM', () => {
    it('is exported from constants/ui', () => {
        expect(ANIM).toBeDefined();
    });

    it('has MICRO, TRANSITION, and REVEAL keys', () => {
        expect(ANIM).toHaveProperty('MICRO');
        expect(ANIM).toHaveProperty('TRANSITION');
        expect(ANIM).toHaveProperty('REVEAL');
    });

    it('MICRO is 200ms (hover, press, toggle)', () => {
        expect(ANIM.MICRO).toBe(200);
    });

    it('TRANSITION is 300ms (tab switch, modal slide)', () => {
        expect(ANIM.TRANSITION).toBe(300);
    });

    it('REVEAL is 600ms (progress bar, entrance)', () => {
        expect(ANIM.REVEAL).toBe(600);
    });

    it('timings are in ascending order: MICRO < TRANSITION < REVEAL', () => {
        expect(ANIM.MICRO).toBeLessThan(ANIM.TRANSITION);
        expect(ANIM.TRANSITION).toBeLessThan(ANIM.REVEAL);
    });

    it('all values are positive integers', () => {
        for (const [key, value] of Object.entries(ANIM)) {
            expect(typeof value).toBe('number');
            expect(value).toBeGreaterThan(0);
            expect(Number.isInteger(value)).toBe(true);
        }
    });

    it('has exactly 3 keys', () => {
        expect(Object.keys(ANIM)).toHaveLength(3);
    });
});

// ── SPACING ───────────────────────────────────────────────────────────────────

describe('SPACING', () => {
    it('is exported from constants/ui', () => {
        expect(SPACING).toBeDefined();
    });

    it('has XS, SM, MD, LG, XL, XXL keys', () => {
        expect(SPACING).toHaveProperty('XS');
        expect(SPACING).toHaveProperty('SM');
        expect(SPACING).toHaveProperty('MD');
        expect(SPACING).toHaveProperty('LG');
        expect(SPACING).toHaveProperty('XL');
        expect(SPACING).toHaveProperty('XXL');
    });

    it('XS is 4 (base unit of 4pt grid)', () => {
        expect(SPACING.XS).toBe(4);
    });

    it('SM is 8', () => {
        expect(SPACING.SM).toBe(8);
    });

    it('MD is 12', () => {
        expect(SPACING.MD).toBe(12);
    });

    it('LG is 16', () => {
        expect(SPACING.LG).toBe(16);
    });

    it('XL is 20', () => {
        expect(SPACING.XL).toBe(20);
    });

    it('XXL is 24', () => {
        expect(SPACING.XXL).toBe(24);
    });

    it('values are in strictly ascending order', () => {
        const ordered = [SPACING.XS, SPACING.SM, SPACING.MD, SPACING.LG, SPACING.XL, SPACING.XXL];
        for (let i = 1; i < ordered.length; i++) {
            expect(ordered[i]).toBeGreaterThan(ordered[i - 1]);
        }
    });

    it('each value is a multiple of 4 (4pt grid)', () => {
        for (const [key, value] of Object.entries(SPACING)) {
            expect(value % 4).toBe(0);
        }
    });

    it('has exactly 6 keys', () => {
        expect(Object.keys(SPACING)).toHaveLength(6);
    });
});

// ── ICON ──────────────────────────────────────────────────────────────────────

describe('ICON', () => {
    it('is exported from constants/ui', () => {
        expect(ICON).toBeDefined();
    });

    it('has SM, MD, LG, XL keys', () => {
        expect(ICON).toHaveProperty('SM');
        expect(ICON).toHaveProperty('MD');
        expect(ICON).toHaveProperty('LG');
        expect(ICON).toHaveProperty('XL');
    });

    it('SM is 16 (inline, badges, meta)', () => {
        expect(ICON.SM).toBe(16);
    });

    it('MD is 20 (list items, actions)', () => {
        expect(ICON.MD).toBe(20);
    });

    it('LG is 24 (headers, primary actions)', () => {
        expect(ICON.LG).toBe(24);
    });

    it('XL is 32 (empty states, heroes)', () => {
        expect(ICON.XL).toBe(32);
    });

    it('values are in strictly ascending order: SM < MD < LG < XL', () => {
        expect(ICON.SM).toBeLessThan(ICON.MD);
        expect(ICON.MD).toBeLessThan(ICON.LG);
        expect(ICON.LG).toBeLessThan(ICON.XL);
    });

    it('all values are positive integers', () => {
        for (const [key, value] of Object.entries(ICON)) {
            expect(typeof value).toBe('number');
            expect(value).toBeGreaterThan(0);
            expect(Number.isInteger(value)).toBe(true);
        }
    });

    it('has exactly 4 keys', () => {
        expect(Object.keys(ICON)).toHaveLength(4);
    });
});
