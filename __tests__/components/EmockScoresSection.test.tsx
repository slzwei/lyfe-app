import React from 'react';
import { render } from '@testing-library/react-native';
import EmockScoresSection from '@/components/candidates/EmockScoresSection';
import { Colors } from '@/constants/Colors';
import {
    EMOCK_MODULE_CODES,
    EMOCK_MODULE_META,
    type EmockAttempt,
    type EmockModuleCode,
    type EmockModuleSummary,
} from '@/types/emock';

const colors = Colors.light;

function emptySummaries(): Record<EmockModuleCode, EmockModuleSummary> {
    const out = {} as Record<EmockModuleCode, EmockModuleSummary>;
    for (const code of EMOCK_MODULE_CODES) {
        out[code] = {
            code,
            label: EMOCK_MODULE_META[code].label,
            attemptCount: 0,
            bestAttempt: null,
            latestAttempt: null,
            everPassed: false,
            bestPercent: null,
        };
    }
    return out;
}

function makeAttempt(score: number, total: number, passed: boolean, completed_at: string): EmockAttempt {
    return {
        id: `att-${score}`,
        module_id: 'M9',
        quiz_id: 'set-a',
        score,
        total,
        passed,
        time_taken_seconds: 4200,
        completed_at,
        status: 'completed',
    };
}

describe('EmockScoresSection', () => {
    it('renders all four module rows with testIDs', () => {
        const { getByTestId } = render(<EmockScoresSection summariesByCode={emptySummaries()} colors={colors} />);
        for (const code of EMOCK_MODULE_CODES) {
            expect(getByTestId(`emock-scores-section-row-${code}`)).toBeTruthy();
        }
    });

    it('shows "no attempts yet" subtitle when module has zero attempts', () => {
        const { getByText } = render(<EmockScoresSection summariesByCode={emptySummaries()} colors={colors} />);
        // Each empty row contributes a "no attempts yet" string — getAllByText would also work.
        expect(getByText(/Life Insurance 1/)).toBeTruthy();
    });

    it('shows passed status with best percent when a module has been passed', () => {
        const map = emptySummaries();
        const attempt = makeAttempt(85, 100, true, '2026-04-22T10:00:00Z');
        map.M9 = {
            code: 'M9',
            label: 'Life Insurance 1',
            attemptCount: 2,
            bestAttempt: attempt,
            latestAttempt: attempt,
            everPassed: true,
            bestPercent: 85,
        };
        const { getByText, getByTestId } = render(<EmockScoresSection summariesByCode={map} colors={colors} />);
        expect(getByTestId('emock-scores-section-row-M9')).toBeTruthy();
        expect(getByText('85%')).toBeTruthy();
        expect(getByText('Passed')).toBeTruthy();
    });

    it('shows "Practising" status when attempts exist but none passed', () => {
        const map = emptySummaries();
        const attempt = makeAttempt(45, 100, false, '2026-04-22T10:00:00Z');
        map.HI = {
            code: 'HI',
            label: 'Health Insurance',
            attemptCount: 3,
            bestAttempt: attempt,
            latestAttempt: attempt,
            everPassed: false,
            bestPercent: 45,
        };
        const { getByText } = render(<EmockScoresSection summariesByCode={map} colors={colors} />);
        expect(getByText('Practising')).toBeTruthy();
        expect(getByText('45%')).toBeTruthy();
    });

    it('renders the section counter as passed-modules / total', () => {
        const map = emptySummaries();
        const attempt = makeAttempt(85, 100, true, '2026-04-22T10:00:00Z');
        map.M9 = {
            code: 'M9',
            label: 'Life Insurance 1',
            attemptCount: 1,
            bestAttempt: attempt,
            latestAttempt: attempt,
            everPassed: true,
            bestPercent: 85,
        };
        const { getByText } = render(<EmockScoresSection summariesByCode={map} colors={colors} />);
        expect(getByText('01/04')).toBeTruthy();
    });
});
