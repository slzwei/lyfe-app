import {
    EVENT_TYPE_CONFIG,
    ACTIVITY_TYPE_CONFIG,
    getEventTypeColor,
    getActivityTypeColor,
} from '@/constants/displayConfigs';
import { Colors } from '@/constants/Colors';
import type { EventType, RoadshowActivityType } from '@/types/event';

const themes = ['light', 'dark'] as const;

describe('event-type palette', () => {
    it('defines a color for every event type in both themes', () => {
        const types = Object.keys(EVENT_TYPE_CONFIG) as EventType[];
        for (const theme of themes) {
            for (const t of types) {
                expect(Colors[theme].eventType[t]).toMatch(/^#[0-9A-Fa-f]{6}$/);
            }
        }
    });

    it('defines a color for every roadshow activity type in both themes', () => {
        const types = Object.keys(ACTIVITY_TYPE_CONFIG) as RoadshowActivityType[];
        for (const theme of themes) {
            for (const t of types) {
                expect(Colors[theme].activityType[t]).toMatch(/^#[0-9A-Fa-f]{6}$/);
            }
        }
    });

    it('resolves different accents per theme (dark mode is not an afterthought)', () => {
        expect(getEventTypeColor('roadshow', Colors.light as never)).not.toBe(
            getEventTypeColor('roadshow', Colors.dark as never),
        );
        expect(getActivityTypeColor('case_closed', Colors.light as never)).not.toBe(
            getActivityTypeColor('case_closed', Colors.dark as never),
        );
    });

    it('never resolves to the banned AI-template colors', () => {
        const banned = ['#6366F1', '#EC4899', '#F59E0B', '#FF3B30', '#8E8E93'];
        for (const theme of themes) {
            const all = [...Object.values(Colors[theme].eventType), ...Object.values(Colors[theme].activityType)];
            for (const hex of all) {
                expect(banned).not.toContain(hex.toUpperCase());
            }
        }
    });
});
