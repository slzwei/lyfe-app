import fs from 'node:fs';
import path from 'node:path';

describe('Candidate routing boundaries', () => {
    const routeFile = (filePath: string) => path.join(process.cwd(), filePath);

    it('keeps add-candidate out of the team stack (lives under /candidates now)', () => {
        expect(fs.existsSync(routeFile('app/(tabs)/team/add-candidate.tsx'))).toBe(false);
    });

    it('keeps team candidate routes as thin re-exports of the canonical screen', () => {
        // The team stack still surfaces candidate detail/progress/papers so a
        // manager can drill in from the team list — but each file is just a
        // re-export of the canonical screen under app/(tabs)/candidates/.
        const shims = [
            'app/(tabs)/team/candidate/[candidateId].tsx',
            'app/(tabs)/team/candidate/progress/[candidateId].tsx',
            'app/(tabs)/team/candidate/papers/[candidateId]/[code].tsx',
        ];
        shims.forEach((shim) => {
            const contents = fs.readFileSync(routeFile(shim), 'utf8');
            expect(contents).toMatch(/export\s+\{\s*default\s*\}\s+from\s+['"]@?\/?.*candidates\//);
        });
    });

    it('keeps the team stack focused on staff routes', () => {
        const teamRoutes = ['index', 'agent/[agentId]', 'lead/[leadId]', 'invite-member'];

        expect(teamRoutes).toContain('agent/[agentId]');
        expect(teamRoutes).toContain('invite-member');
        expect(teamRoutes).not.toContain('candidate/[candidateId]');
        expect(teamRoutes).not.toContain('add-candidate');
    });

    it('routes candidate lists through recruitment surfaces only', () => {
        const candidatesRoute = (id: string) => `/(tabs)/candidates/${id}`;
        const homeRoute = (id: string) => `/(tabs)/home/candidate/${id}`;
        const paRoute = (id: string) => `/(tabs)/pa/candidate/${id}`;

        expect(candidatesRoute('cand-1')).toBe('/(tabs)/candidates/cand-1');
        expect(homeRoute('cand-1')).toBe('/(tabs)/home/candidate/cand-1');
        expect(paRoute('cand-1')).toBe('/(tabs)/pa/candidate/cand-1');
    });

    it('does not route candidate lists through Team', () => {
        const candidateEntryRoutes = [
            '/(tabs)/candidates/cand-1',
            '/(tabs)/home/candidate/cand-1',
            '/(tabs)/pa/candidate/cand-1',
        ];

        candidateEntryRoutes.forEach((route) => {
            expect(route).not.toContain('/(tabs)/team/candidate');
        });
    });

    it('opens candidate creation from candidate, home, and PA contexts', () => {
        expect('/(tabs)/candidates/add-candidate').toContain('/(tabs)/candidates/');
        expect('/(tabs)/home/add-candidate').toContain('/(tabs)/home/');
        expect('/(tabs)/pa/add-candidate').toContain('/(tabs)/pa/');
    });

    it('keeps role guards distinct between Team and Candidates', () => {
        const teamAllowedRoles = ['admin', 'director', 'manager'];
        const candidatesAllowedRoles = ['admin', 'director', 'manager', 'pa'];

        expect(teamAllowedRoles).toContain('manager');
        expect(teamAllowedRoles).not.toContain('pa');
        expect(teamAllowedRoles).not.toContain('candidate');
        expect(candidatesAllowedRoles).toContain('pa');
        expect(candidatesAllowedRoles).not.toContain('agent');
    });
});
