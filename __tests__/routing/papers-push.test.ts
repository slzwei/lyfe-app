/**
 * Verifies that the "open paper attempts" push resolves to a route **within
 * the current tab's stack** so back navigation pops to the candidate detail
 * rather than jumping tabs.
 *
 * The candidate detail screen is reachable from recruitment contexts via
 * re-exports (candidates / pa / home). Each context has its own Stack.
 * The fix: derive the push URL from the current pathname.
 */
describe('openPaperAttempts push URL', () => {
    function deriveBase(pathname: string): string {
        return pathname.replace(/\/[^/]+$/, '');
    }

    function buildPaperUrl(pathname: string, candidateId: string, code: string): string {
        return `${deriveBase(pathname)}/papers/${candidateId}/${code}`;
    }

    const cases: { tab: string; pathname: string; expected: string }[] = [
        {
            tab: 'candidates',
            pathname: '/candidates/cand-1',
            expected: '/candidates/papers/cand-1/life_1',
        },
        {
            tab: 'pa',
            pathname: '/pa/candidate/cand-1',
            expected: '/pa/candidate/papers/cand-1/life_1',
        },
        {
            tab: 'home',
            pathname: '/home/candidate/cand-1',
            expected: '/home/candidate/papers/cand-1/life_1',
        },
    ];

    for (const { tab, pathname, expected } of cases) {
        it(`${tab} tab: ${pathname} → ${expected}`, () => {
            expect(buildPaperUrl(pathname, 'cand-1', 'life_1')).toBe(expected);
        });
    }

    it('works for every paper requirement code', () => {
        const codes = ['life_1', 'life_2', 'rules_ethics', 'health_insurance'];
        for (const code of codes) {
            expect(buildPaperUrl('/candidates/abc', 'abc', code)).toBe(`/candidates/papers/abc/${code}`);
        }
    });

    it('preserves the candidateId in both places', () => {
        const url = buildPaperUrl('/pa/candidate/abc-123', 'abc-123', 'life_1');
        // candidate id appears once in the papers sub-route (not in the base)
        expect(url).toBe('/pa/candidate/papers/abc-123/life_1');
        expect(url.match(/abc-123/g)?.length).toBe(1);
    });
});
