import { describe, expect, it } from 'vitest';
import { parseDiff } from '../../src/analysis/diff-parse.js';
import { DEFAULT_SUBJECTS, reachAudit } from '../../src/analysis/reach.js';
import { makeRepo } from '../helpers/git.js';
import { ROUTE_DIFF } from './fixtures.js';

describe('reachAudit', () => {
  it('lists new files, exports and routes with the subject files that mention them', () => {
    const worktree = makeRepo({
      'e2e/export.spec.ts': "test('export', () => request('/api/export'));\n",
      'mocks/handlers.ts': "rest.get('/api/export', () => ok());\n",
      'src/routes/export.ts': 'x',
    });
    const surfaces = reachAudit(parseDiff(ROUTE_DIFF), DEFAULT_SUBJECTS, worktree);
    const byName = Object.fromEntries(surfaces.map((s) => [s.surface, s]));
    expect(byName['src/routes/export.ts']).toMatchObject({ kind: 'file', covered_by: ['e2e/export.spec.ts', 'mocks/handlers.ts'] });
    expect(byName['exportRouter']).toMatchObject({ kind: 'export', covered_by: [] });
    expect(byName['/api/export']).toMatchObject({ kind: 'route', covered_by: ['e2e/export.spec.ts', 'mocks/handlers.ts'] });
    expect(byName['/api/export/csv']).toMatchObject({ kind: 'route', covered_by: [] });
  });

  it('respects the given globs', () => {
    const worktree = makeRepo({ 'tests/export.e2e.ts': "visit('/api/export/csv')\n", 'e2e/other.spec.ts': 'nothing\n' });
    const surfaces = reachAudit(parseDiff(ROUTE_DIFF), { e2e_globs: ['tests/**'], mock_globs: [], contract_globs: [] }, worktree);
    expect(surfaces.find((s) => s.surface === '/api/export/csv')!.covered_by).toEqual(['tests/export.e2e.ts']);
    expect(surfaces.find((s) => s.surface === '/api/export')!.covered_by).toEqual([]);
  });
});
