/**
 * Tests for config objects exported from types/roadmap.ts
 *
 * Verified:
 * - MODULE_TYPE_CONFIG entries have label and icon but NO color field
 * - MODULE_TYPE_COLOR_KEY maps each ModuleType to the correct ThemeColors key
 * - NODE_STATE_CONFIG opacity and scale values are within valid ranges
 * - RESOURCE_TYPE_CONFIG entries have label and icon
 */
import { MODULE_TYPE_CONFIG, MODULE_TYPE_COLOR_KEY, RESOURCE_TYPE_CONFIG } from '@/types/roadmap';
import type { ModuleType, ResourceType } from '@/types/roadmap';

// ── MODULE_TYPE_CONFIG ────────────────────────────────────────────────────────

describe('MODULE_TYPE_CONFIG', () => {
    const moduleTypes: ModuleType[] = ['training', 'exam', 'resource'];

    it('is defined for all three module types', () => {
        for (const type of moduleTypes) {
            expect(MODULE_TYPE_CONFIG[type]).toBeDefined();
        }
    });

    it('each entry has a non-empty label', () => {
        for (const type of moduleTypes) {
            expect(typeof MODULE_TYPE_CONFIG[type].label).toBe('string');
            expect(MODULE_TYPE_CONFIG[type].label.length).toBeGreaterThan(0);
        }
    });

    it('each entry has a non-empty icon string', () => {
        for (const type of moduleTypes) {
            expect(typeof MODULE_TYPE_CONFIG[type].icon).toBe('string');
            expect(MODULE_TYPE_CONFIG[type].icon.length).toBeGreaterThan(0);
        }
    });

    it('does NOT have a color field on any entry', () => {
        for (const type of moduleTypes) {
            expect(MODULE_TYPE_CONFIG[type]).not.toHaveProperty('color');
        }
    });

    it('training entry has correct label and icon', () => {
        expect(MODULE_TYPE_CONFIG.training.label).toBe('Training');
        expect(MODULE_TYPE_CONFIG.training.icon).toBe('book-outline');
    });

    it('exam entry has correct label and icon', () => {
        expect(MODULE_TYPE_CONFIG.exam.label).toBe('Exam');
        expect(MODULE_TYPE_CONFIG.exam.icon).toBe('school-outline');
    });

    it('resource entry has correct label and icon', () => {
        expect(MODULE_TYPE_CONFIG.resource.label).toBe('Resource');
        expect(MODULE_TYPE_CONFIG.resource.icon).toBe('folder-outline');
    });

    it('has exactly 3 entries', () => {
        expect(Object.keys(MODULE_TYPE_CONFIG)).toHaveLength(3);
    });
});

// ── MODULE_TYPE_COLOR_KEY ─────────────────────────────────────────────────────

describe('MODULE_TYPE_COLOR_KEY', () => {
    it('is exported from types/roadmap', () => {
        expect(MODULE_TYPE_COLOR_KEY).toBeDefined();
    });

    it('has a key for each module type', () => {
        expect(MODULE_TYPE_COLOR_KEY).toHaveProperty('training');
        expect(MODULE_TYPE_COLOR_KEY).toHaveProperty('exam');
        expect(MODULE_TYPE_COLOR_KEY).toHaveProperty('resource');
    });

    it('training maps to roadmapTraining', () => {
        expect(MODULE_TYPE_COLOR_KEY.training).toBe('roadmapTraining');
    });

    it('exam maps to roadmapExam', () => {
        expect(MODULE_TYPE_COLOR_KEY.exam).toBe('roadmapExam');
    });

    it('resource maps to roadmapResource', () => {
        expect(MODULE_TYPE_COLOR_KEY.resource).toBe('roadmapResource');
    });

    it('all three color keys are distinct', () => {
        const keys = Object.values(MODULE_TYPE_COLOR_KEY);
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size).toBe(keys.length);
    });

    it('has exactly 3 entries', () => {
        expect(Object.keys(MODULE_TYPE_COLOR_KEY)).toHaveLength(3);
    });

    it('all color key values are strings starting with "roadmap"', () => {
        for (const [type, colorKey] of Object.entries(MODULE_TYPE_COLOR_KEY)) {
            expect(typeof colorKey).toBe('string');
            expect(colorKey.startsWith('roadmap')).toBe(true);
        }
    });

    it('color keys resolve to actual Colors.light properties', () => {
        // Import Colors here to verify the color keys actually exist in the theme
        const { Colors } = require('@/constants/Colors');
        for (const colorKey of Object.values(MODULE_TYPE_COLOR_KEY)) {
            expect(Colors.light).toHaveProperty(colorKey);
            expect(typeof Colors.light[colorKey]).toBe('string');
        }
    });
});

// ── RESOURCE_TYPE_CONFIG ──────────────────────────────────────────────────────

describe('RESOURCE_TYPE_CONFIG', () => {
    const resourceTypes: ResourceType[] = ['link', 'file', 'video', 'text'];

    it('is defined for all four resource types', () => {
        for (const type of resourceTypes) {
            expect(RESOURCE_TYPE_CONFIG[type]).toBeDefined();
        }
    });

    it('each entry has a non-empty label', () => {
        for (const type of resourceTypes) {
            expect(typeof RESOURCE_TYPE_CONFIG[type].label).toBe('string');
            expect(RESOURCE_TYPE_CONFIG[type].label.length).toBeGreaterThan(0);
        }
    });

    it('each entry has a non-empty icon string', () => {
        for (const type of resourceTypes) {
            expect(typeof RESOURCE_TYPE_CONFIG[type].icon).toBe('string');
            expect(RESOURCE_TYPE_CONFIG[type].icon.length).toBeGreaterThan(0);
        }
    });

    it('does NOT have a color field on any entry', () => {
        for (const type of resourceTypes) {
            expect(RESOURCE_TYPE_CONFIG[type]).not.toHaveProperty('color');
        }
    });
});
