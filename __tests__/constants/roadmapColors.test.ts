/**
 * Tests for roadmap-related color exports in constants/Colors.ts
 *
 * Verified:
 * - SEEDLING_PALETTE and SPROUT_PALETTE are exported with the correct shape keys
 * - All palette values are valid 6-digit hex strings
 * - Both Colors.light and Colors.dark contain roadmapTraining, roadmapExam, roadmapResource
 * - Those theme color values are valid hex strings
 * - Light and dark values are distinct (dark mode palette differs from light)
 */
import { Colors, SEEDLING_PALETTE, SPROUT_PALETTE } from '@/constants/Colors';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Matches #RRGGBB or #RRGGBBAA hex strings */
function isHex(value: unknown): boolean {
    return typeof value === 'string' && /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(value);
}

// ── SEEDLING_PALETTE ─────────────────────────────────────────────────────────

describe('SEEDLING_PALETTE', () => {
    it('is exported from constants/Colors', () => {
        expect(SEEDLING_PALETTE).toBeDefined();
    });

    it('contains all expected keys', () => {
        const expectedKeys = ['light', 'medium', 'dark', 'darkest'];
        for (const key of expectedKeys) {
            expect(SEEDLING_PALETTE).toHaveProperty(key);
        }
    });

    it('has no unexpected extra keys', () => {
        const expectedKeys = ['light', 'medium', 'dark', 'darkest'];
        expect(Object.keys(SEEDLING_PALETTE).sort()).toEqual(expectedKeys.sort());
    });

    it('all values are valid hex color strings', () => {
        for (const [key, value] of Object.entries(SEEDLING_PALETTE)) {
            expect(isHex(value)).toBe(true);
        }
    });

    it('has specific known values', () => {
        expect(SEEDLING_PALETTE.light).toBe('#78b84a');
        expect(SEEDLING_PALETTE.dark).toBe('#3a9438');
        expect(SEEDLING_PALETTE.darkest).toBe('#2d5c2d');
    });
});

// ── SPROUT_PALETTE ───────────────────────────────────────────────────────────

describe('SPROUT_PALETTE', () => {
    it('is exported from constants/Colors', () => {
        expect(SPROUT_PALETTE).toBeDefined();
    });

    it('contains all expected keys', () => {
        const expectedKeys = [
            'stem',
            'leafDark',
            'leafPrimary',
            'leafLight',
            'leafHighlight',
            'soilDark',
            'soilLight',
            'soilMedium',
        ];
        for (const key of expectedKeys) {
            expect(SPROUT_PALETTE).toHaveProperty(key);
        }
    });

    it('has no unexpected extra keys', () => {
        const expectedKeys = [
            'stem',
            'leafDark',
            'leafPrimary',
            'leafLight',
            'leafHighlight',
            'soilDark',
            'soilLight',
            'soilMedium',
        ];
        expect(Object.keys(SPROUT_PALETTE).sort()).toEqual(expectedKeys.sort());
    });

    it('all values are valid hex color strings', () => {
        for (const [key, value] of Object.entries(SPROUT_PALETTE)) {
            expect(isHex(value)).toBe(true);
        }
    });

    it('has specific known values', () => {
        expect(SPROUT_PALETTE.leafPrimary).toBe('#6DAF3E');
        expect(SPROUT_PALETTE.stem).toBe('#5C7A4A');
        expect(SPROUT_PALETTE.soilDark).toBe('#6D563A');
    });

    it('has different leaf colors from SEEDLING_PALETTE (distinct palettes)', () => {
        expect(SPROUT_PALETTE.leafPrimary).not.toBe(SEEDLING_PALETTE.light);
    });
});

// ── Colors.light roadmap keys ────────────────────────────────────────────────

describe('Colors.light roadmap module type colors', () => {
    it('has roadmapTraining key', () => {
        expect(Colors.light).toHaveProperty('roadmapTraining');
    });

    it('has roadmapExam key', () => {
        expect(Colors.light).toHaveProperty('roadmapExam');
    });

    it('has roadmapResource key', () => {
        expect(Colors.light).toHaveProperty('roadmapResource');
    });

    it('roadmapTraining is a valid hex string', () => {
        expect(isHex(Colors.light.roadmapTraining)).toBe(true);
    });

    it('roadmapExam is a valid hex string', () => {
        expect(isHex(Colors.light.roadmapExam)).toBe(true);
    });

    it('roadmapResource is a valid hex string', () => {
        expect(isHex(Colors.light.roadmapResource)).toBe(true);
    });

    it('uses iOS system blue for training', () => {
        expect(Colors.light.roadmapTraining).toBe('#007AFF');
    });

    it('uses iOS system orange for exam', () => {
        expect(Colors.light.roadmapExam).toBe('#FF9500');
    });

    it('uses iOS system green for resource', () => {
        expect(Colors.light.roadmapResource).toBe('#34C759');
    });

    it('all three type colors are distinct', () => {
        const { roadmapTraining, roadmapExam, roadmapResource } = Colors.light;
        expect(roadmapTraining).not.toBe(roadmapExam);
        expect(roadmapExam).not.toBe(roadmapResource);
        expect(roadmapTraining).not.toBe(roadmapResource);
    });
});

// ── Colors.dark roadmap keys ─────────────────────────────────────────────────

describe('Colors.dark roadmap module type colors', () => {
    it('has roadmapTraining key', () => {
        expect(Colors.dark).toHaveProperty('roadmapTraining');
    });

    it('has roadmapExam key', () => {
        expect(Colors.dark).toHaveProperty('roadmapExam');
    });

    it('has roadmapResource key', () => {
        expect(Colors.dark).toHaveProperty('roadmapResource');
    });

    it('roadmapTraining is a valid hex string', () => {
        expect(isHex(Colors.dark.roadmapTraining)).toBe(true);
    });

    it('roadmapExam is a valid hex string', () => {
        expect(isHex(Colors.dark.roadmapExam)).toBe(true);
    });

    it('roadmapResource is a valid hex string', () => {
        expect(isHex(Colors.dark.roadmapResource)).toBe(true);
    });

    it('uses iOS dark system blue for training', () => {
        expect(Colors.dark.roadmapTraining).toBe('#0A84FF');
    });

    it('uses iOS dark system orange for exam', () => {
        expect(Colors.dark.roadmapExam).toBe('#FF9F0A');
    });

    it('uses iOS dark system green for resource', () => {
        expect(Colors.dark.roadmapResource).toBe('#30D158');
    });

    it('all three dark type colors are distinct', () => {
        const { roadmapTraining, roadmapExam, roadmapResource } = Colors.dark;
        expect(roadmapTraining).not.toBe(roadmapExam);
        expect(roadmapExam).not.toBe(roadmapResource);
        expect(roadmapTraining).not.toBe(roadmapResource);
    });

    it('dark palette differs from light palette for each key', () => {
        expect(Colors.dark.roadmapTraining).not.toBe(Colors.light.roadmapTraining);
        expect(Colors.dark.roadmapExam).not.toBe(Colors.light.roadmapExam);
        expect(Colors.dark.roadmapResource).not.toBe(Colors.light.roadmapResource);
    });
});
